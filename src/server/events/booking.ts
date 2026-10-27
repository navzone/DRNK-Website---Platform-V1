import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { db, schema, type Executor } from "@/db/client";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { randomRef } from "@/lib/crypto";
import { awardForBooking } from "@/server/rewards/ledger";

export const HOLD_MS = 15 * 60_000;
export const MAX_TICKETS_PER_BOOKING = 10;

export type BookingInput = { eventId: string; lines: { ticketTypeId: string; quantity: number }[] };

/**
 * Creates a pending booking and atomically reserves inventory. Prices come from the database only.
 * Overselling is impossible: the conditional UPDATE and a CHECK constraint both enforce capacity.
 */
export async function createBooking(userId: string, input: BookingInput) {
  const ids = input.lines.map((l) => l.ticketTypeId);
  if (new Set(ids).size !== ids.length) throw badRequest("Each ticket type may appear once");
  const totalQty = input.lines.reduce((n, l) => n + l.quantity, 0);
  if (totalQty < 1 || totalQty > MAX_TICKETS_PER_BOOKING) throw badRequest(`Choose between 1 and ${MAX_TICKETS_PER_BOOKING} tickets`);

  await expireStaleBookings();

  return db.transaction(async (tx) => {
    const [event] = await tx
      .select()
      .from(schema.events)
      .where(and(eq(schema.events.id, input.eventId), eq(schema.events.status, "approved"), gt(schema.events.startsAt, new Date())))
      .limit(1);
    if (!event) throw notFound("Event not available");

    // Lock order is deterministic (sorted by id) so concurrent bookings cannot deadlock.
    const lines = [...input.lines].sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId));
    const priced: { ticketTypeId: string; quantity: number; unitPricePaise: number }[] = [];
    for (const line of lines) {
      const [tt] = await tx
        .select()
        .from(schema.ticketTypes)
        .where(and(eq(schema.ticketTypes.id, line.ticketTypeId), eq(schema.ticketTypes.eventId, event.id)))
        .limit(1);
      if (!tt) throw badRequest("Unknown ticket type for this event");
      const reserved = await tx
        .update(schema.ticketTypes)
        .set({ sold: sql`${schema.ticketTypes.sold} + ${line.quantity}` })
        .where(and(eq(schema.ticketTypes.id, tt.id), sql`${schema.ticketTypes.sold} + ${line.quantity} <= ${schema.ticketTypes.capacity}`))
        .returning({ id: schema.ticketTypes.id });
      if (reserved.length === 0) throw conflict(`"${tt.name}" does not have enough tickets left`, "sold_out");
      priced.push({ ticketTypeId: tt.id, quantity: line.quantity, unitPricePaise: tt.pricePaise });
    }

    const totalPaise = priced.reduce((n, l) => n + l.unitPricePaise * l.quantity, 0);
    const [booking] = await tx
      .insert(schema.eventBookings)
      .values({ ref: randomRef("EVT"), userId, eventId: event.id, totalPaise, expiresAt: new Date(Date.now() + HOLD_MS) })
      .returning();
    if (!booking) throw new Error("booking insert failed");
    await tx.insert(schema.bookingLines).values(priced.map((l) => ({ bookingId: booking.id, ...l })));

    if (totalPaise === 0) await confirmBooking(tx, booking.id);
    const [fresh] = await tx.select().from(schema.eventBookings).where(eq(schema.eventBookings.id, booking.id));
    return fresh!;
  });
}

/** Moves pending_payment -> confirmed exactly once and issues tickets. Returns false if it was not pending. */
export async function confirmBooking(tx: Executor, bookingId: string): Promise<boolean> {
  const [booking] = await tx
    .update(schema.eventBookings)
    .set({ status: "confirmed" })
    .where(and(eq(schema.eventBookings.id, bookingId), eq(schema.eventBookings.status, "pending_payment")))
    .returning();
  if (!booking) return false;

  const lines = await tx.select().from(schema.bookingLines).where(eq(schema.bookingLines.bookingId, bookingId));
  for (const line of lines) {
    for (let seq = 1; seq <= line.quantity; seq++) {
      // The unique index (booking, ticket type, seq) makes duplicate issuance impossible.
      await tx
        .insert(schema.tickets)
        .values({ ref: randomRef("TKT"), bookingId, ticketTypeId: line.ticketTypeId, userId: booking.userId, seq })
        .onConflictDoNothing();
    }
  }
  await awardForBooking(tx, { userId: booking.userId, bookingId, amountPaise: booking.totalPaise });
  await tx.insert(schema.notifications).values({
    userId: booking.userId, kind: "booking_confirmed", body: `Your booking ${booking.ref} is confirmed.`,
  });
  return true;
}

async function releaseInventory(tx: Executor, bookingId: string) {
  const lines = await tx.select().from(schema.bookingLines).where(eq(schema.bookingLines.bookingId, bookingId));
  for (const l of [...lines].sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId))) {
    await tx
      .update(schema.ticketTypes)
      .set({ sold: sql`${schema.ticketTypes.sold} - ${l.quantity}` })
      .where(eq(schema.ticketTypes.id, l.ticketTypeId));
  }
}

/** Releases inventory for unpaid bookings whose hold has lapsed. Safe to run concurrently and repeatedly. */
export async function expireStaleBookings(now = new Date()): Promise<number> {
  return db.transaction(async (tx) => {
    const stale = await tx
      .select({ id: schema.eventBookings.id })
      .from(schema.eventBookings)
      .where(and(eq(schema.eventBookings.status, "pending_payment"), lt(schema.eventBookings.expiresAt, now)))
      .for("update", { skipLocked: true });
    for (const { id } of stale) {
      const done = await tx
        .update(schema.eventBookings)
        .set({ status: "expired" })
        .where(and(eq(schema.eventBookings.id, id), eq(schema.eventBookings.status, "pending_payment")))
        .returning({ id: schema.eventBookings.id });
      if (done.length) await releaseInventory(tx, id);
    }
    return stale.length;
  });
}

export async function cancelPendingBooking(userId: string, ref: string) {
  return db.transaction(async (tx) => {
    const [b] = await tx
      .select()
      .from(schema.eventBookings)
      .where(and(eq(schema.eventBookings.ref, ref), eq(schema.eventBookings.userId, userId)))
      .for("update");
    if (!b) throw notFound("Booking not found");
    if (b.status !== "pending_payment") throw conflict("Only unpaid bookings can be cancelled here", "not_cancellable");
    await tx.update(schema.eventBookings).set({ status: "cancelled" }).where(eq(schema.eventBookings.id, b.id));
    await releaseInventory(tx, b.id);
    return { ...b, status: "cancelled" as const };
  });
}

/** Ownership-enforced read. Other users' bookings are indistinguishable from nonexistent ones. */
export async function getBookingForUser(userId: string, ref: string) {
  const [b] = await db
    .select()
    .from(schema.eventBookings)
    .where(and(eq(schema.eventBookings.ref, ref), eq(schema.eventBookings.userId, userId)))
    .limit(1);
  if (!b) throw notFound("Booking not found");
  const [lines, tickets, payments] = await Promise.all([
    db.select().from(schema.bookingLines).where(eq(schema.bookingLines.bookingId, b.id)),
    db.select({ ref: schema.tickets.ref, ticketTypeId: schema.tickets.ticketTypeId, seq: schema.tickets.seq }).from(schema.tickets).where(eq(schema.tickets.bookingId, b.id)).orderBy(asc(schema.tickets.ref)),
    db.select({ ref: schema.paymentAttempts.ref, status: schema.paymentAttempts.status, amountPaise: schema.paymentAttempts.amountPaise }).from(schema.paymentAttempts).where(eq(schema.paymentAttempts.bookingId, b.id)),
  ]);
  return { booking: b, lines, tickets, payments };
}

export async function listBookingsForUser(userId: string) {
  return db.select().from(schema.eventBookings).where(eq(schema.eventBookings.userId, userId)).orderBy(sql`${schema.eventBookings.createdAt} desc`);
}

