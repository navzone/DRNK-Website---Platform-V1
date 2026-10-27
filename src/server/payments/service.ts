import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { randomRef } from "@/lib/crypto";
import { log } from "@/lib/log";
import { audit } from "@/server/audit";
import { confirmBooking } from "@/server/events/booking";
import { getPaymentProvider, type NormalizedWebhook } from "./provider";

/** Server-calculated payment for an owned, unpaid, unexpired booking. The amount is never taken from the client. */
export async function startPayment(userId: string, bookingRef: string) {
  const [booking] = await db
    .select()
    .from(schema.eventBookings)
    .where(and(eq(schema.eventBookings.ref, bookingRef), eq(schema.eventBookings.userId, userId)))
    .limit(1);
  if (!booking) throw notFound("Booking not found");
  if (booking.status !== "pending_payment") throw conflict("This booking is not awaiting payment", "not_payable");
  if (booking.expiresAt.getTime() <= Date.now()) throw conflict("This booking has expired", "booking_expired");
  if (booking.totalPaise <= 0) throw badRequest("Nothing to pay for this booking");

  const provider = getPaymentProvider();
  const [attempt] = await db
    .insert(schema.paymentAttempts)
    .values({ ref: randomRef("PAY"), bookingId: booking.id, userId, amountPaise: booking.totalPaise, provider: provider.name })
    .returning();
  if (!attempt) throw new Error("payment attempt insert failed");
  try {
    const order = await provider.createOrder({ ref: attempt.ref, amountPaise: attempt.amountPaise, currency: attempt.currency });
    await db
      .update(schema.paymentAttempts)
      .set({ status: "pending", providerOrderId: order.providerOrderId, updatedAt: new Date() })
      .where(eq(schema.paymentAttempts.id, attempt.id));
    return { paymentRef: attempt.ref, status: "pending" as const, amountPaise: attempt.amountPaise, checkout: order.checkout };
  } catch (err) {
    await db.update(schema.paymentAttempts).set({ status: "failed", updatedAt: new Date() }).where(eq(schema.paymentAttempts.id, attempt.id));
    throw err;
  }
}

export type WebhookResult = "processed" | "duplicate" | "ignored" | "mismatch";

/**
 * Processes an already signature-verified webhook exactly once. Everything — dedupe record, payment status,
 * booking confirmation, ticket issuance, rewards — commits or rolls back together.
 */
export async function processWebhook(event: NormalizedWebhook, providerName: string): Promise<WebhookResult> {
  return db.transaction(async (tx) => {
    // Concurrent duplicates block on the unique index here and then see a conflict.
    const inserted = await tx
      .insert(schema.webhookEvents)
      .values({ provider: providerName, eventId: event.eventId, payload: event.raw as object })
      .onConflictDoNothing()
      .returning({ id: schema.webhookEvents.id });
    if (inserted.length === 0) return "duplicate";
    const markProcessed = () =>
      tx.update(schema.webhookEvents).set({ processedAt: new Date() }).where(eq(schema.webhookEvents.id, inserted[0]!.id));

    if (event.type === "ignored" || !event.providerOrderId) {
      await markProcessed();
      return "ignored";
    }

    const [attempt] = await tx
      .select()
      .from(schema.paymentAttempts)
      .where(eq(schema.paymentAttempts.providerOrderId, event.providerOrderId))
      .for("update");
    if (!attempt) {
      log.warn("webhook_unknown_order", { eventId: event.eventId });
      await markProcessed();
      return "ignored";
    }

    if (event.type === "payment.failed") {
      if (attempt.status !== "paid") {
        await tx.update(schema.paymentAttempts).set({ status: "failed", updatedAt: new Date() }).where(eq(schema.paymentAttempts.id, attempt.id));
      }
      await markProcessed();
      return "processed";
    }

    // payment.captured
    if (attempt.status === "paid") {
      await markProcessed();
      return "ignored";
    }
    if (event.amountPaise !== attempt.amountPaise || event.currency !== attempt.currency) {
      // Never confirm on an amount we did not ask for. Leave pending and flag for review.
      await audit(tx, { action: "payment.amount_mismatch", entityType: "payment_attempt", entityId: attempt.id, metadata: { expected: attempt.amountPaise, received: event.amountPaise } });
      await markProcessed();
      return "mismatch";
    }

    await tx
      .update(schema.paymentAttempts)
      .set({ status: "paid", providerPaymentId: event.providerPaymentId ?? null, updatedAt: new Date() })
      .where(eq(schema.paymentAttempts.id, attempt.id));

    // Lock the booking row so confirmation cannot race with the expiry job or another attempt.
    await tx.select({ id: schema.eventBookings.id }).from(schema.eventBookings).where(eq(schema.eventBookings.id, attempt.bookingId)).for("update");
    const confirmed = await confirmBooking(tx, attempt.bookingId);
    if (!confirmed) {
      // Money was captured but the booking can no longer be confirmed (expired, cancelled, or paid by another attempt).
      await tx.insert(schema.refunds).values({ paymentAttemptId: attempt.id, amountPaise: attempt.amountPaise, status: "requested" });
      await audit(tx, { action: "payment.refund_required", entityType: "payment_attempt", entityId: attempt.id, metadata: { reason: "booking_not_confirmable" } });
    }
    await markProcessed();
    return "processed";
  });
}
