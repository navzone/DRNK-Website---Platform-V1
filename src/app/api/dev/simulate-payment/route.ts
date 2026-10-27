import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { env } from "@/lib/env";
import { AppError, notFound } from "@/lib/errors";
import { handle, json, requireUser } from "@/server/api";
import { FakeSandboxProvider, signWebhookBody } from "@/server/payments/provider";
import { processWebhook } from "@/server/payments/service";

/**
 * DEV/TEST ONLY. Feeds a correctly signed sandbox webhook into the SAME verification + processing path
 * that real provider webhooks use. It cannot exist in production: the route 404s unless APP_ENV is
 * development/test AND the fake sandbox provider is active, and loadEnv() forbids fake-sandbox in production.
 */
export const POST = handle(async (req) => {
  const e = env();
  if ((e.APP_ENV !== "development" && e.APP_ENV !== "test") || e.PAYMENT_PROVIDER !== "fake-sandbox") throw new AppError(404, "not_found", "Not found");
  const user = await requireUser(req);
  const { paymentRef, outcome } = z.object({ paymentRef: z.string().min(1), outcome: z.enum(["captured", "failed"]) }).parse(await req.json().catch(() => ({})));
  const [attempt] = await db.select().from(schema.paymentAttempts).where(and(eq(schema.paymentAttempts.ref, paymentRef), eq(schema.paymentAttempts.userId, user.id))).limit(1);
  if (!attempt?.providerOrderId) throw notFound("Payment not found");
  const raw = JSON.stringify({ event: outcome === "captured" ? "payment.captured" : "payment.failed", payload: { payment: { entity: { id: `pay_sim_${Date.now()}`, order_id: attempt.providerOrderId, amount: attempt.amountPaise, currency: attempt.currency } } } });
  const headers = new Headers({ "x-razorpay-signature": signWebhookBody(raw, e.RAZORPAY_WEBHOOK_SECRET), "x-razorpay-event-id": `sim_${crypto.randomUUID()}` });
  const provider = new FakeSandboxProvider();
  return json({ result: await processWebhook(provider.parseWebhook(raw, headers), provider.name) });
});
