import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { schema } from "@/db/client";
import { POST as createBookingRoute } from "@/app/api/bookings/route";
import { GET as getBookingRoute } from "@/app/api/bookings/[ref]/route";
import { POST as payRoute } from "@/app/api/bookings/[ref]/pay/route";
import { POST as cancelRoute } from "@/app/api/bookings/[ref]/cancel/route";
import { POST as webhookRoute } from "@/app/api/webhooks/payments/route";
import { signWebhookBody } from "@/server/payments/provider";
import { expireStaleBookings } from "@/server/events/booking";
import { getBalance } from "@/server/rewards/ledger";
import { closeDb, db, DEMO_PHONES, loginAs, makeRequest, ORIGIN, resetAndSeed } from "../helpers";

beforeEach(resetAndSeed);
afterAll(closeDb);

const withRef = (ref: string) => ({ params: Promise.resolve({ ref }) });
const noParams = { params: Promise.resolve({}) };

async function fixtures() {
  const [event] = await db.select().from(schema.events);
  const types = await db.select().from(schema.ticketTypes).where(eq(schema.ticketTypes.eventId, event!.id));
  return {
    event: event!,
    general: types.find((t) => t.name === "General")!,
    limited: types.find((t) => t.name === "Limited")!,
  };
}

const book = (cookie: string, body: unknown, ip = "10.0.0.1") =>
  createBookingRoute(makeRequest("/api/bookings", { cookie, body, ip }), noParams);

async function bookOk(cookie: string, ticketTypeId: string, quantity: number) {
  const { event } = await fixtures();
  const res = await book(cookie, { eventId: event.id, lines: [{ ticketTypeId, quantity }] });
  expect(res.status).toBe(201);
  return (await res.json()).booking as typeof schema.eventBookings.$inferSelect;
}

async function startPay(cookie: string, ref: string) {
  const res = await payRoute(makeRequest(`/api/bookings/${ref}/pay`, { cookie }), withRef(ref));
  expect(res.status).toBe(201);
  const data = await res.json();
  return { paymentRef: data.paymentRef as string, orderId: data.checkout.orderId as string, amountPaise: data.amountPaise as number };
}

let eventCounter = 0;
function webhookReq(orderId: string, o: { type?: string; amount: number; eventId?: string; currency?: string; paymentId?: string; signature?: string | null }) {
  const body = JSON.stringify({
    event: o.type ?? "payment.captured",
    payload: { payment: { entity: { id: o.paymentId ?? `pay_${++eventCounter}`, order_id: orderId, amount: o.amount, currency: o.currency ?? "INR" } } },
  });
  const headers: Record<string, string> = { "x-razorpay-event-id": o.eventId ?? `evt_${++eventCounter}` };
  if (o.signature !== null) headers["x-razorpay-signature"] = o.signature ?? signWebhookBody(body, process.env.RAZORPAY_WEBHOOK_SECRET!);
  return new Request(`${ORIGIN}/api/webhooks/payments`, { method: "POST", headers, body });
}
const sendWebhook = (...a: Parameters<typeof webhookReq>) => webhookRoute(webhookReq(...a), noParams);

const ticketCount = async () => (await db.select().from(schema.tickets)).length;
const soldOf = async (id: string) => (await db.select().from(schema.ticketTypes).where(eq(schema.ticketTypes.id, id)))[0]!.sold;
const statusOf = async (id: string) => (await db.select().from(schema.eventBookings).where(eq(schema.eventBookings.id, id)))[0]!.status;

describe("booking creation", () => {
  it("requires authentication", async () => {
    const { event, general } = await fixtures();
    const res = await book("", { eventId: event.id, lines: [{ ticketTypeId: general.id, quantity: 1 }] });
    expect(res.status).toBe(401);
  });

  it("prices on the server and ignores any client-supplied price or total", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { event, general } = await fixtures();
    const res = await book(cookie, { eventId: event.id, lines: [{ ticketTypeId: general.id, quantity: 2, pricePaise: 1, unitPricePaise: 1 }], totalPaise: 1 });
    expect(res.status).toBe(201);
    const { booking } = await res.json();
    expect(booking.totalPaise).toBe(general.pricePaise * 2);
    expect(booking.status).toBe("pending_payment");
  });

  it("rejects invalid quantities and unknown ticket types", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { event, general } = await fixtures();
    expect((await book(cookie, { eventId: event.id, lines: [{ ticketTypeId: general.id, quantity: 0 }] })).status).toBe(400);
    expect((await book(cookie, { eventId: event.id, lines: [{ ticketTypeId: general.id, quantity: 11 }] })).status).toBe(400);
    expect((await book(cookie, { eventId: event.id, lines: [{ ticketTypeId: "00000000-0000-4000-8000-000000000000", quantity: 1 }] })).status).toBe(400);
    expect((await book(cookie, { eventId: event.id, lines: [] })).status).toBe(400);
  });

  it("does not allow booking an unapproved event", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { event, general } = await fixtures();
    await db.update(schema.events).set({ status: "pending" }).where(eq(schema.events.id, event.id));
    expect((await book(cookie, { eventId: event.id, lines: [{ ticketTypeId: general.id, quantity: 1 }] })).status).toBe(404);
  });
});

describe("inventory", () => {
  it("never sells more than capacity", async () => {
    const c1 = await loginAs(DEMO_PHONES.customer, "10.0.1.1");
    const c2 = await loginAs(DEMO_PHONES.customer2, "10.0.1.2");
    const { event, limited } = await fixtures(); // capacity 5
    expect((await book(c1, { eventId: event.id, lines: [{ ticketTypeId: limited.id, quantity: 5 }] })).status).toBe(201);
    const over = await book(c2, { eventId: event.id, lines: [{ ticketTypeId: limited.id, quantity: 1 }] });
    expect(over.status).toBe(409);
    expect((await over.json()).error.code).toBe("sold_out");
    expect(await soldOf(limited.id)).toBe(5);
  });

  it("concurrent bookings cannot oversell (20 racers, capacity 5)", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { event, limited } = await fixtures();
    const results = await Promise.all(Array.from({ length: 20 }, () => book(cookie, { eventId: event.id, lines: [{ ticketTypeId: limited.id, quantity: 1 }] })));
    const ok = results.filter((r) => r.status === 201).length;
    expect(ok).toBe(5);
    expect(results.filter((r) => r.status === 409)).toHaveLength(15);
    expect(await soldOf(limited.id)).toBe(5);
  });

  it("releases held inventory when an unpaid booking expires", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { limited } = await fixtures();
    const b = await bookOk(cookie, limited.id, 3);
    expect(await soldOf(limited.id)).toBe(3);
    await db.update(schema.eventBookings).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.eventBookings.id, b.id));
    expect(await expireStaleBookings()).toBe(1);
    expect(await soldOf(limited.id)).toBe(0);
    expect(await statusOf(b.id)).toBe("expired");
    expect(await expireStaleBookings()).toBe(0); // idempotent
    expect(await soldOf(limited.id)).toBe(0);
  });

  it("releases inventory when the owner cancels an unpaid booking", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { limited } = await fixtures();
    const b = await bookOk(cookie, limited.id, 2);
    const res = await cancelRoute(makeRequest(`/api/bookings/${b.ref}/cancel`, { cookie }), withRef(b.ref));
    expect(res.status).toBe(200);
    expect(await soldOf(limited.id)).toBe(0);
    const again = await cancelRoute(makeRequest(`/api/bookings/${b.ref}/cancel`, { cookie }), withRef(b.ref));
    expect(again.status).toBe(409);
    expect(await soldOf(limited.id)).toBe(0);
  });
});

describe("ownership", () => {
  it("other customers cannot read, pay for or cancel a booking", async () => {
    const owner = await loginAs(DEMO_PHONES.customer, "10.0.2.1");
    const other = await loginAs(DEMO_PHONES.customer2, "10.0.2.2");
    const { general } = await fixtures();
    const b = await bookOk(owner, general.id, 1);
    expect((await getBookingRoute(makeRequest(`/api/bookings/${b.ref}`, { method: "GET", cookie: other }), withRef(b.ref))).status).toBe(404);
    expect((await payRoute(makeRequest(`/api/bookings/${b.ref}/pay`, { cookie: other }), withRef(b.ref))).status).toBe(404);
    expect((await cancelRoute(makeRequest(`/api/bookings/${b.ref}/cancel`, { cookie: other }), withRef(b.ref))).status).toBe(404);
    expect((await getBookingRoute(makeRequest(`/api/bookings/${b.ref}`, { method: "GET", cookie: owner }), withRef(b.ref))).status).toBe(200);
  });
});

describe("payment webhooks", () => {
  it("a started payment stays pending: no booking confirmation without a verified webhook", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 1);
    const p = await startPay(cookie, b.ref);
    expect(p.amountPaise).toBe(general.pricePaise);
    const [attempt] = await db.select().from(schema.paymentAttempts);
    expect(attempt?.status).toBe("pending");
    expect(await statusOf(b.id)).toBe("pending_payment");
    expect(await ticketCount()).toBe(0);
  });

  it("a verified capture confirms the booking and issues exactly the right tickets", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 3);
    const p = await startPay(cookie, b.ref);
    const res = await sendWebhook(p.orderId, { amount: p.amountPaise });
    expect(res.status).toBe(200);
    expect((await res.json()).result).toBe("processed");
    expect(await statusOf(b.id)).toBe("confirmed");
    expect(await ticketCount()).toBe(3);
    const [attempt] = await db.select().from(schema.paymentAttempts);
    expect(attempt?.status).toBe("paid");
    const view = await (await getBookingRoute(makeRequest(`/api/bookings/${b.ref}`, { method: "GET", cookie }), withRef(b.ref))).json();
    expect(view.booking.status).toBe("confirmed");
    expect(view.tickets).toHaveLength(3);
  });

  it("a failed payment never produces a paid booking, and the user can retry", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 1);
    const p1 = await startPay(cookie, b.ref);
    await sendWebhook(p1.orderId, { type: "payment.failed", amount: p1.amountPaise });
    expect((await db.select().from(schema.paymentAttempts))[0]?.status).toBe("failed");
    expect(await statusOf(b.id)).toBe("pending_payment");
    expect(await ticketCount()).toBe(0);
    const p2 = await startPay(cookie, b.ref); // retry
    await sendWebhook(p2.orderId, { amount: p2.amountPaise });
    expect(await statusOf(b.id)).toBe("confirmed");
    expect(await ticketCount()).toBe(1);
  });

  it("rejects bad or missing signatures without changing any state", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 1);
    const p = await startPay(cookie, b.ref);
    expect((await sendWebhook(p.orderId, { amount: p.amountPaise, signature: "deadbeef" })).status).toBe(401);
    expect((await sendWebhook(p.orderId, { amount: p.amountPaise, signature: null })).status).toBe(401);
    expect(await statusOf(b.id)).toBe("pending_payment");
    expect(await ticketCount()).toBe(0);
    expect(await db.select().from(schema.webhookEvents)).toHaveLength(0);
  });

  it("a duplicate delivery of the same event does not duplicate tickets", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 2);
    const p = await startPay(cookie, b.ref);
    const first = await (await sendWebhook(p.orderId, { amount: p.amountPaise, eventId: "evt_same" })).json();
    const second = await (await sendWebhook(p.orderId, { amount: p.amountPaise, eventId: "evt_same" })).json();
    expect(first.result).toBe("processed");
    expect(second.result).toBe("duplicate");
    expect(await ticketCount()).toBe(2);
  });

  it("concurrent duplicate deliveries process exactly once", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 2);
    const p = await startPay(cookie, b.ref);
    const res = await Promise.all(Array.from({ length: 8 }, () => sendWebhook(p.orderId, { amount: p.amountPaise, eventId: "evt_race" })));
    const results = await Promise.all(res.map(async (r) => (await r.json()).result));
    expect(results.filter((r) => r === "processed")).toHaveLength(1);
    expect(results.filter((r) => r === "duplicate")).toHaveLength(7);
    expect(await ticketCount()).toBe(2);
    expect(await db.select().from(schema.webhookEvents)).toHaveLength(1);
  });

  it("a second capture event (different id) for an already paid order changes nothing", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 1);
    const p = await startPay(cookie, b.ref);
    await sendWebhook(p.orderId, { amount: p.amountPaise });
    const again = await (await sendWebhook(p.orderId, { amount: p.amountPaise })).json();
    expect(again.result).toBe("ignored");
    expect(await ticketCount()).toBe(1);
    expect(await db.select().from(schema.refunds)).toHaveLength(0);
  });

  it("a capture with the wrong amount does not confirm the booking and is flagged", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 1);
    const p = await startPay(cookie, b.ref);
    const res = await (await sendWebhook(p.orderId, { amount: 100 })).json();
    expect(res.result).toBe("mismatch");
    expect(await statusOf(b.id)).toBe("pending_payment");
    expect(await ticketCount()).toBe(0);
    const audits = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.action, "payment.amount_mismatch"));
    expect(audits).toHaveLength(1);
  });

  it("an unknown order id is acknowledged but changes nothing", async () => {
    const res = await (await sendWebhook("order_unknown", { amount: 100 })).json();
    expect(res.result).toBe("ignored");
  });

  it("a capture that arrives after the hold expired requests a refund instead of confirming", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { limited } = await fixtures();
    const b = await bookOk(cookie, limited.id, 1);
    const p = await startPay(cookie, b.ref);
    await db.update(schema.eventBookings).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.eventBookings.id, b.id));
    await expireStaleBookings();
    expect(await soldOf(limited.id)).toBe(0);
    await sendWebhook(p.orderId, { amount: p.amountPaise });
    expect(await statusOf(b.id)).toBe("expired");
    expect(await ticketCount()).toBe(0);
    const refunds = await db.select().from(schema.refunds);
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.amountPaise).toBe(p.amountPaise);
    expect(refunds[0]?.status).toBe("requested");
  });

  it("when two attempts are both captured, one confirms and the other is queued for refund", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 1);
    const p1 = await startPay(cookie, b.ref);
    const p2 = await startPay(cookie, b.ref);
    await Promise.all([sendWebhook(p1.orderId, { amount: p1.amountPaise }), sendWebhook(p2.orderId, { amount: p2.amountPaise })]);
    expect(await statusOf(b.id)).toBe("confirmed");
    expect(await ticketCount()).toBe(1);
    expect(await db.select().from(schema.refunds)).toHaveLength(1);
  });

  it("cannot pay for an expired, cancelled or already confirmed booking", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 1);
    await db.update(schema.eventBookings).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.eventBookings.id, b.id));
    expect((await payRoute(makeRequest(`/api/bookings/${b.ref}/pay`, { cookie }), withRef(b.ref))).status).toBe(409);
  });
});

describe("rewards ledger", () => {
  const enableRule = () => db.insert(schema.rewardRules).values({ key: "earn.event_booking", value: { pointsPerRupee: 1 }, active: true });

  it("awards nothing when no approved rule is configured", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 1);
    const p = await startPay(cookie, b.ref);
    await sendWebhook(p.orderId, { amount: p.amountPaise });
    expect(await db.select().from(schema.pointsLedger)).toHaveLength(0);
  });

  it("awards points by the configured rule exactly once, and the balance equals the ledger", async () => {
    await enableRule();
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 2);
    const p = await startPay(cookie, b.ref);
    await sendWebhook(p.orderId, { amount: p.amountPaise, eventId: "e1" });
    await sendWebhook(p.orderId, { amount: p.amountPaise, eventId: "e1" }); // duplicate
    await sendWebhook(p.orderId, { amount: p.amountPaise, eventId: "e2" }); // replay with new id
    const ledger = await db.select().from(schema.pointsLedger);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.delta).toBe(Math.floor((p.amountPaise * 1) / 100));
    const [user] = await db.select().from(schema.users).where(eq(schema.users.phoneE164, DEMO_PHONES.customer));
    const [sum] = await db.select({ s: sql<number>`sum(${schema.pointsLedger.delta})::int` }).from(schema.pointsLedger).where(eq(schema.pointsLedger.userId, user!.id));
    expect(await getBalance(db, user!.id, "points")).toBe(sum?.s);
  });

  it("a malformed rule never awards points", async () => {
    await db.insert(schema.rewardRules).values({ key: "earn.event_booking", value: { pointsPerRupee: -5.5 }, active: true });
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 1);
    const p = await startPay(cookie, b.ref);
    await sendWebhook(p.orderId, { amount: p.amountPaise });
    expect(await db.select().from(schema.pointsLedger)).toHaveLength(0);
  });

  it("keeps Alcometer credits separate from points", async () => {
    await enableRule();
    const cookie = await loginAs(DEMO_PHONES.customer);
    const { general } = await fixtures();
    const b = await bookOk(cookie, general.id, 1);
    const p = await startPay(cookie, b.ref);
    await sendWebhook(p.orderId, { amount: p.amountPaise });
    expect(await db.select().from(schema.alcometerLedger)).toHaveLength(0);
  });
});
