import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { AppError, badRequest } from "@/lib/errors";
import { safeEqual } from "@/lib/crypto";

export type ProviderOrder = { providerOrderId: string; checkout: Record<string, unknown> };

export type NormalizedWebhook = {
  eventId: string;
  type: "payment.captured" | "payment.failed" | "ignored";
  providerOrderId?: string;
  providerPaymentId?: string;
  amountPaise?: number;
  currency?: string;
  raw: unknown;
};

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: { ref: string; amountPaise: number; currency: string }): Promise<ProviderOrder>;
  /** Verifies the signature over the RAW body and returns a normalized event. Throws on any failure. */
  parseWebhook(rawBody: string, headers: Headers): NormalizedWebhook;
}

/** Razorpay-compatible signature: hex HMAC-SHA256 of the raw body keyed with the webhook secret. */
export function signWebhookBody(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

function parseRazorpayShapedWebhook(rawBody: string, headers: Headers): NormalizedWebhook {
  const secret = env().RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new AppError(503, "webhook_unconfigured", "Webhook secret is not configured");
  const signature = headers.get("x-razorpay-signature") ?? "";
  if (!signature || !safeEqual(signature, signWebhookBody(rawBody, secret))) {
    throw new AppError(401, "invalid_signature", "Invalid signature");
  }
  let body: { event?: string; payload?: { payment?: { entity?: Record<string, unknown> } } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw badRequest("Malformed webhook body");
  }
  const entity = body.payload?.payment?.entity ?? {};
  const eventId = headers.get("x-razorpay-event-id");
  if (!eventId) throw badRequest("Missing event id");
  const type = body.event === "payment.captured" ? "payment.captured" : body.event === "payment.failed" ? "payment.failed" : "ignored";
  return {
    eventId,
    type,
    providerOrderId: typeof entity.order_id === "string" ? entity.order_id : undefined,
    providerPaymentId: typeof entity.id === "string" ? entity.id : undefined,
    amountPaise: typeof entity.amount === "number" ? entity.amount : undefined,
    currency: typeof entity.currency === "string" ? entity.currency : undefined,
    raw: body,
  };
}

/**
 * Local deterministic sandbox. It creates no real charges. It never reports success by itself:
 * a payment becomes "paid" only when a correctly signed webhook is processed by the same pipeline
 * used for the real provider.
 */
export class FakeSandboxProvider implements PaymentProvider {
  readonly name = "fake-sandbox";
  async createOrder(input: { ref: string; amountPaise: number; currency: string }): Promise<ProviderOrder> {
    const providerOrderId = `order_fake_${input.ref}`;
    return { providerOrderId, checkout: { provider: this.name, orderId: providerOrderId, amountPaise: input.amountPaise, currency: input.currency, sandbox: true } };
  }
  parseWebhook = parseRazorpayShapedWebhook;
}

/**
 * Razorpay adapter (Orders API + signed webhooks).
 * UNVERIFIED: not exercised against a Razorpay account in this repository. Requires test keys and a
 * dashboard-configured webhook before it can be claimed to work. See docs/PRODUCTION_READINESS.md.
 */
export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay";
  async createOrder(input: { ref: string; amountPaise: number; currency: string }): Promise<ProviderOrder> {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new AppError(503, "payments_unavailable", "Payments are temporarily unavailable");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` },
      body: JSON.stringify({ amount: input.amountPaise, currency: input.currency, receipt: input.ref }),
    });
    if (!res.ok) throw new AppError(502, "payments_unavailable", "Payment provider error");
    const data = (await res.json()) as { id?: string };
    if (!data.id) throw new AppError(502, "payments_unavailable", "Payment provider error");
    // Only the public key id is sent to the browser. The key secret never leaves the server.
    return { providerOrderId: data.id, checkout: { provider: this.name, keyId, orderId: data.id, amountPaise: input.amountPaise, currency: input.currency } };
  }
  parseWebhook = parseRazorpayShapedWebhook;
}

export function getPaymentProvider(): PaymentProvider {
  return env().PAYMENT_PROVIDER === "razorpay" ? new RazorpayProvider() : new FakeSandboxProvider();
}
