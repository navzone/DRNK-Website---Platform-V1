import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@/db/client";
import { GET as talentsRoute } from "@/app/api/talents/route";
import { GET as talentRoute } from "@/app/api/talents/[slug]/route";
import { POST as enquiryPost } from "@/app/api/talents/[slug]/enquiries/route";
import { GET as ownEnquiries } from "@/app/api/enquiries/route";
import { GET as talentInbox } from "@/app/api/talent/enquiries/route";
import { POST as respondRoute } from "@/app/api/talent/enquiries/[id]/respond/route";
import { GET as accountGet, PATCH as accountPatch } from "@/app/api/account/route";
import { GET as historyRoute } from "@/app/api/account/history/route";
import { GET as rewardsRoute } from "@/app/api/account/rewards/route";
import { POST as supportPost, GET as supportGet } from "@/app/api/support/route";
import { POST as dataReqPost, GET as dataReqGet } from "@/app/api/account/data-requests/route";
import { POST as consentPost } from "@/app/api/account/consents/route";
import { POST as applyRoute } from "@/app/api/merchant/applications/route";
import { POST as venuePost } from "@/app/api/merchant/venues/route";
import { POST as eventPost } from "@/app/api/merchant/events/route";
import { POST as menuItemPost } from "@/app/api/merchant/venues/[slug]/menu-items/route";
import { GET as adminList } from "@/app/api/admin/lists/[kind]/route";
import { POST as approvalsRoute } from "@/app/api/admin/approvals/route";
import { POST as roleRoute } from "@/app/api/admin/users/[id]/role/route";
import { POST as tierRoute } from "@/app/api/admin/users/[id]/tier/route";
import { POST as adminTalentPost } from "@/app/api/admin/talents/route";
import { GET as venuesRoute } from "@/app/api/venues/route";
import { GET as meRoute } from "@/app/api/me/route";
import { POST as expireRoute } from "@/app/api/internal/expire-bookings/route";
import { POST as bookingsPost } from "@/app/api/bookings/route";
import { POST as payRoute } from "@/app/api/bookings/[ref]/pay/route";
import { POST as simulateRoute } from "@/app/api/dev/simulate-payment/route";
import { GET as bookingGet } from "@/app/api/bookings/[ref]/route";
import { appendEntry } from "@/server/rewards/ledger";
import { closeDb, db, DEMO_PHONES, loginAs, makeRequest, ORIGIN, resetAndSeed } from "../helpers";

beforeEach(resetAndSeed);
afterAll(closeDb);

const none = { params: Promise.resolve({}) };
const p = (o: Record<string, string>) => ({ params: Promise.resolve(o) });
const get = (path: string, cookie?: string) => makeRequest(path, { method: "GET", cookie });
const post = (path: string, cookie: string | undefined, body?: unknown) => makeRequest(path, { cookie, body });
const userId = async (phone: string) => (await db.select().from(schema.users).where(eq(schema.users.phoneE164, phone)))[0]!.id;
const future = (h = 72) => new Date(Date.now() + h * 3600_000).toISOString();

describe("Talent discovery", () => {
  it("lists only approved profiles and supports filters", async () => {
    await db.update(schema.talentProfiles).set({ status: "pending" }).where(eq(schema.talentProfiles.slug, "demo-band"));
    expect((await (await talentsRoute(get("/api/talents"), none)).json()).total).toBe(1);
    expect((await talentRoute(get("/api/talents/demo-band"), p({ slug: "demo-band" }))).status).toBe(404);
    await db.update(schema.talentProfiles).set({ status: "approved" });
    expect((await (await talentsRoute(get("/api/talents?kind=dj"), none)).json()).total).toBe(1);
    expect((await (await talentsRoute(get("/api/talents?genre=rock"), none)).json()).total).toBe(1);
    expect((await (await talentsRoute(get("/api/talents?q=demo"), none)).json()).total).toBe(2);
    expect((await talentsRoute(get("/api/talents?kind=magician"), none)).status).toBe(400);
  });
});

describe("Talent enquiries", () => {
  const enquire = (cookie: string | undefined, slug: string, body: unknown) => enquiryPost(post(`/api/talents/${slug}/enquiries`, cookie, body), p({ slug }));

  it("requires auth, validates input, and only approved talent can be enquired", async () => {
    expect((await enquire(undefined, "dj-demo", { message: "Hello there" })).status).toBe(401);
    const c = await loginAs(DEMO_PHONES.customer, "10.7.0.1");
    expect((await enquire(c, "dj-demo", { message: "hi" })).status).toBe(400);
    expect((await enquire(c, "dj-demo", { message: "Looking for a set", eventDate: future(-24) })).status).toBe(400);
    expect((await enquire(c, "nobody", { message: "Looking for a set" })).status).toBe(404);
    await db.update(schema.talentProfiles).set({ status: "pending" }).where(eq(schema.talentProfiles.slug, "dj-demo"));
    expect((await enquire(c, "dj-demo", { message: "Looking for a set" })).status).toBe(404);
  });

  it("persists the enquiry, rate limits spam, and scopes the customer's list", async () => {
    const a = await loginAs(DEMO_PHONES.customer, "10.7.1.1");
    const b = await loginAs(DEMO_PHONES.customer2, "10.7.1.2");
    const first = await enquire(a, "dj-demo", { message: "Friday night set?", eventDate: future() });
    expect(first.status).toBe(201);
    expect((await (await ownEnquiries(get("/api/enquiries", a), none)).json()).enquiries).toHaveLength(1);
    expect((await (await ownEnquiries(get("/api/enquiries", b), none)).json()).enquiries).toHaveLength(0);
    let limited = false;
    for (let i = 0; i < 12; i++) if ((await enquire(a, "dj-demo", { message: "Spam spam spam" })).status === 429) limited = true;
    expect(limited).toBe(true);
  });

  it("only the owning talent (or an admin) can see and answer; answers are final and notify the customer", async () => {
    const [dj] = await db.select().from(schema.talentProfiles).where(eq(schema.talentProfiles.slug, "dj-demo"));
    const [band] = await db.select().from(schema.talentProfiles).where(eq(schema.talentProfiles.slug, "demo-band"));
    const [t1] = await db.insert(schema.users).values({ phoneE164: "+919000000011", role: "talent" }).returning();
    const [t2] = await db.insert(schema.users).values({ phoneE164: "+919000000012", role: "talent" }).returning();
    await db.update(schema.talentProfiles).set({ userId: t1!.id }).where(eq(schema.talentProfiles.id, dj!.id));
    await db.update(schema.talentProfiles).set({ userId: t2!.id }).where(eq(schema.talentProfiles.id, band!.id));
    const cust = await loginAs(DEMO_PHONES.customer, "10.7.2.1");
    const talent1 = await loginAs("+919000000011", "10.7.2.2");
    const talent2 = await loginAs("+919000000012", "10.7.2.3");
    const admin = await loginAs(DEMO_PHONES.admin, "10.7.2.4");
    await enquire(cust, "dj-demo", { message: "Need a DJ on the 14th" });
    const [enq] = await db.select().from(schema.talentEnquiries);
    const respond = (cookie: string | undefined, status: string) => respondRoute(post(`/api/talent/enquiries/${enq!.id}/respond`, cookie, { status, response: "Happy to." }), p({ id: enq!.id }));

    expect((await (await talentInbox(get("/api/talent/enquiries", talent1), none)).json()).enquiries).toHaveLength(1);
    expect((await (await talentInbox(get("/api/talent/enquiries", talent2), none)).json()).enquiries).toHaveLength(0);
    expect((await talentInbox(get("/api/talent/enquiries", cust), none)).status).toBe(403);
    expect((await respond(cust, "accepted")).status).toBe(403);
    expect((await respond(talent2, "accepted")).status).toBe(404);
    expect((await respond(talent1, "maybe")).status).toBe(400);
    expect((await respond(talent1, "accepted")).status).toBe(200);
    expect((await respond(talent1, "declined")).status).toBe(409);
    expect((await respond(admin, "declined")).status).toBe(409);
    const mine = (await (await ownEnquiries(get("/api/enquiries", cust), none)).json()).enquiries[0];
    expect(mine.status).toBe("accepted");
    expect(mine.response).toBe("Happy to.");
    expect(await db.select().from(schema.notifications).where(eq(schema.notifications.kind, "enquiry_response"))).toHaveLength(1);
  });
});

describe("Account, privacy and rewards view", () => {
  it("profile updates cannot touch role or phone", async () => {
    const c = await loginAs(DEMO_PHONES.customer, "10.8.0.1");
    expect((await accountPatch(makeRequest("/api/account", { method: "PATCH", cookie: c, body: { role: "admin" } }), none)).status).toBe(400);
    expect((await accountPatch(makeRequest("/api/account", { method: "PATCH", cookie: c, body: { phoneE164: "+919999999999" } }), none)).status).toBe(400);
    expect((await accountPatch(makeRequest("/api/account", { method: "PATCH", cookie: c, body: { email: "not-an-email" } }), none)).status).toBe(400);
    expect((await accountPatch(makeRequest("/api/account", { method: "PATCH", cookie: c, body: { displayName: "Asha", email: "asha@example.com" } }), none)).status).toBe(200);
    const prof = (await (await accountGet(get("/api/account", c), none)).json()).profile;
    expect(prof.role).toBe("customer");
    expect(prof.displayName).toBe("Asha");
    expect((await accountGet(get("/api/account"), none)).status).toBe(401);
  });

  it("support tickets and data requests are private to their owner; duplicates are blocked", async () => {
    const a = await loginAs(DEMO_PHONES.customer, "10.8.1.1");
    const b = await loginAs(DEMO_PHONES.customer2, "10.8.1.2");
    expect((await supportPost(post("/api/support", a, { subject: "Hi", body: "short" }), none)).status).toBe(400);
    expect((await supportPost(post("/api/support", a, { subject: "Refund query", body: "I was charged twice for an event." }), none)).status).toBe(201);
    expect((await (await supportGet(get("/api/support", a), none)).json()).tickets).toHaveLength(1);
    expect((await (await supportGet(get("/api/support", b), none)).json()).tickets).toHaveLength(0);
    expect((await dataReqPost(post("/api/account/data-requests", a, { kind: "delete" }), none)).status).toBe(201);
    expect((await dataReqPost(post("/api/account/data-requests", a, { kind: "delete" }), none)).status).toBe(409);
    expect((await dataReqPost(post("/api/account/data-requests", a, { kind: "wipe" }), none)).status).toBe(400);
    expect((await (await dataReqGet(get("/api/account/data-requests", b), none)).json()).requests).toHaveLength(0);
    expect(await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.action, "data_request.delete"))).toHaveLength(1);
  });

  it("records consent only for a known notice version", async () => {
    const a = await loginAs(DEMO_PHONES.customer, "10.8.2.1");
    expect((await consentPost(post("/api/account/consents", a, { version: "draft-0" }), none)).status).toBe(201);
    expect((await consentPost(post("/api/account/consents", a, { version: "nope" }), none)).status).toBe(404);
  });

  it("history is scoped to the caller", async () => {
    const a = await loginAs(DEMO_PHONES.customer, "10.8.3.1");
    const b = await loginAs(DEMO_PHONES.customer2, "10.8.3.2");
    const [v] = await db.select().from(schema.venues).where(eq(schema.venues.slug, "demo-taproom"));
    await db.insert(schema.reservations).values({ ref: "RSV-TEST0001", userId: await userId(DEMO_PHONES.customer), venueId: v!.id, partySize: 2, slotAt: new Date(Date.now() + 86400_000) });
    expect((await (await historyRoute(get("/api/account/history", a), none)).json()).reservations).toHaveLength(1);
    expect((await (await historyRoute(get("/api/account/history", b), none)).json()).reservations).toHaveLength(0);
  });

  it("shows no tier until an admin assigns one; points and Alcometer stay separate and match their ledgers", async () => {
    const a = await loginAs(DEMO_PHONES.customer, "10.8.4.1");
    const admin = await loginAs(DEMO_PHONES.admin, "10.8.4.2");
    const uid = await userId(DEMO_PHONES.customer);
    let r = await (await rewardsRoute(get("/api/account/rewards", a), none)).json();
    expect(r.tier).toBeNull();
    expect(r.points.balance).toBe(0);
    await appendEntry(db, "points", { userId: uid, delta: 120, kind: "adjustment", reason: "fixture", idempotencyKey: "fx-1" });
    await appendEntry(db, "points", { userId: uid, delta: -20, kind: "reversal", reason: "fixture reversal", idempotencyKey: "fx-2" });
    await appendEntry(db, "alcometer", { userId: uid, delta: 7, kind: "adjustment", reason: "fixture", idempotencyKey: "fx-3" });
    expect((await tierRoute(post(`/api/admin/users/${uid}/tier`, a, { tier: "gold" }), p({ id: uid }))).status).toBe(403);
    expect((await tierRoute(post(`/api/admin/users/${uid}/tier`, admin, { tier: "platinum" }), p({ id: uid }))).status).toBe(400);
    expect((await tierRoute(post(`/api/admin/users/${uid}/tier`, admin, { tier: "gold" }), p({ id: uid }))).status).toBe(200);
    r = await (await rewardsRoute(get("/api/account/rewards", a), none)).json();
    expect(r.tier.code).toBe("gold");
    expect(r.points.balance).toBe(100);
    expect(r.alcometer.balance).toBe(7);
    const b = await loginAs(DEMO_PHONES.customer2, "10.8.4.3");
    expect((await (await rewardsRoute(get("/api/account/rewards", b), none)).json()).points.balance).toBe(0);
  });
});

describe("Admin authorization", () => {
  const adminEndpoints = ["venues", "events", "talents", "applications", "bookings", "support", "data-requests", "audit"];

  it("rejects anonymous (401) and non-admin (403) callers on every admin list", async () => {
    const cust = await loginAs(DEMO_PHONES.customer, "10.9.0.1");
    const merch = await loginAs(DEMO_PHONES.merchant, "10.9.0.2");
    for (const kind of adminEndpoints) {
      expect((await adminList(get(`/api/admin/lists/${kind}`), p({ kind }))).status).toBe(401);
      expect((await adminList(get(`/api/admin/lists/${kind}`, cust), p({ kind }))).status).toBe(403);
      expect((await adminList(get(`/api/admin/lists/${kind}`, merch), p({ kind }))).status).toBe(403);
    }
    expect((await approvalsRoute(post("/api/admin/approvals", cust, { entity: "venue", id: "00000000-0000-4000-8000-000000000000", status: "approved" }), none)).status).toBe(403);
    expect((await adminTalentPost(post("/api/admin/talents", merch, { stageName: "X Y", kind: "dj" }), none)).status).toBe(403);
  });

  it("admins can read lists; unknown list and invalid status are rejected", async () => {
    const admin = await loginAs(DEMO_PHONES.admin, "10.9.1.1");
    for (const kind of adminEndpoints) expect((await adminList(get(`/api/admin/lists/${kind}`, admin), p({ kind }))).status).toBe(200);
    expect((await adminList(get("/api/admin/lists/secrets", admin), p({ kind: "secrets" }))).status).toBe(404);
    expect((await adminList(get("/api/admin/lists/venues?status=bogus", admin), p({ kind: "venues" }))).status).toBe(400);
  });

  it("an admin cannot change their own role; changing another user's role revokes their sessions and is audited", async () => {
    const admin = await loginAs(DEMO_PHONES.admin, "10.9.2.1");
    const cust = await loginAs(DEMO_PHONES.customer, "10.9.2.2");
    const adminId = await userId(DEMO_PHONES.admin);
    const custId = await userId(DEMO_PHONES.customer);
    expect((await roleRoute(post(`/api/admin/users/${adminId}/role`, admin, { role: "customer" }), p({ id: adminId }))).status).toBe(403);
    expect((await meRoute(get("/api/me", cust), none)).status).toBe(200);
    expect((await roleRoute(post(`/api/admin/users/${custId}/role`, admin, { role: "host" }), p({ id: custId }))).status).toBe(200);
    expect((await meRoute(get("/api/me", cust), none)).status).toBe(401);
    const audits = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.action, "user.role"));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actorUserId).toBe(adminId);
  });

  it("a customer cannot self-promote through any endpoint (role stays customer)", async () => {
    const cust = await loginAs(DEMO_PHONES.customer, "10.9.3.1");
    const id = await userId(DEMO_PHONES.customer);
    expect((await roleRoute(post(`/api/admin/users/${id}/role`, cust, { role: "admin" }), p({ id }))).status).toBe(403);
    expect((await accountPatch(makeRequest("/api/account", { method: "PATCH", cookie: cust, body: { role: "admin" } }), none)).status).toBe(400);
    expect((await db.select().from(schema.users).where(eq(schema.users.id, id)))[0]?.role).toBe("customer");
  });
});

describe("Merchant onboarding and approval workflow", () => {
  it("application → approval → venue → approval → event → approval → bookable, with every step audited", async () => {
    const cust = await loginAs(DEMO_PHONES.customer2, "10.10.0.1");
    const admin = await loginAs(DEMO_PHONES.admin, "10.10.0.2");
    const uid = await userId(DEMO_PHONES.customer2);

    // Customers cannot create venues until approved as a merchant.
    expect((await venuePost(post("/api/merchant/venues", cust, { name: "Nope", category: "pub", neighbourhood: "X", address: "Somewhere 1" }), none)).status).toBe(403);
    expect((await applyRoute(post("/api/merchant/applications", cust, { businessName: "Brew House" }), none)).status).toBe(201);
    expect((await applyRoute(post("/api/merchant/applications", cust, { businessName: "Brew House" }), none)).status).toBe(409);
    const [app] = await db.select().from(schema.merchantApplications);
    expect((await approvalsRoute(post("/api/admin/approvals", admin, { entity: "merchant_application", id: app!.id, status: "approved" }), none)).status).toBe(200);
    expect((await db.select().from(schema.users).where(eq(schema.users.id, uid)))[0]?.role).toBe("merchant");

    // New venue is hidden until approved.
    const v = await (await venuePost(post("/api/merchant/venues", cust, { name: "Brew House", category: "microbrewery", cuisines: ["Continental"], neighbourhood: "Indiranagar", address: "12 Example Road", dineInEnabled: true }), none)).json();
    expect(v.venue.status).toBe("pending");
    const slug = v.venue.slug as string;
    expect((await (await venuesRoute(get("/api/venues?q=brew"), none)).json()).total).toBe(0);
    expect((await eventPost(post("/api/merchant/events", cust, { venueSlug: slug, title: "Launch Night", startsAt: future(), ticketTypes: [{ name: "GA", pricePaise: 50000, capacity: 10 }] }), none)).status).toBe(409);
    await approvalsRoute(post("/api/admin/approvals", admin, { entity: "venue", id: v.venue.id, status: "approved" }), none);
    expect((await (await venuesRoute(get("/api/venues?q=brew"), none)).json()).total).toBe(1);

    // Event is hidden until approved, then bookable.
    expect((await eventPost(post("/api/merchant/events", cust, { venueSlug: slug, title: "Launch Night", startsAt: future(-5), ticketTypes: [{ name: "GA", pricePaise: 50000, capacity: 10 }] }), none)).status).toBe(400);
    const e = await (await eventPost(post("/api/merchant/events", cust, { venueSlug: slug, title: "Launch Night", startsAt: future(), ticketTypes: [{ name: "GA", pricePaise: 50000, capacity: 10 }] }), none)).json();
    expect(e.event.status).toBe("pending");
    const [tt] = await db.select().from(schema.ticketTypes).where(eq(schema.ticketTypes.eventId, e.event.id));
    const buyer = await loginAs(DEMO_PHONES.customer, "10.10.0.3");
    const body = { eventId: e.event.id, lines: [{ ticketTypeId: tt!.id, quantity: 1 }] };
    expect((await bookingsPost(post("/api/bookings", buyer, body), none)).status).toBe(404);
    await approvalsRoute(post("/api/admin/approvals", admin, { entity: "event", id: e.event.id, status: "approved" }), none);
    expect((await bookingsPost(post("/api/bookings", buyer, body), none)).status).toBe(201);

    const actions = (await db.select().from(schema.auditEvents)).map((a) => a.action);
    for (const a of ["merchant_application.approved", "venue.create", "venue.approved", "event.create", "event.approved"]) expect(actions).toContain(a);
  });

  it("a merchant cannot add events or menu items to someone else's venue, and bad prices are rejected", async () => {
    const owner = await loginAs(DEMO_PHONES.merchant, "10.10.1.1");
    await db.insert(schema.users).values({ phoneE164: "+919000000021", role: "merchant" });
    const other = await loginAs("+919000000021", "10.10.1.2");
    const ev = { venueSlug: "demo-taproom", title: "Hijack", startsAt: future(), ticketTypes: [{ name: "GA", pricePaise: 100, capacity: 5 }] };
    expect((await eventPost(post("/api/merchant/events", other, ev), none)).status).toBe(404);
    expect((await eventPost(post("/api/merchant/events", owner, ev), none)).status).toBe(201);
    expect((await menuItemPost(post("/api/merchant/venues/demo-taproom/menu-items", other, { name: "Free beer", pricePaise: 0 }), p({ slug: "demo-taproom" }))).status).toBe(404);
    expect((await menuItemPost(post("/api/merchant/venues/demo-taproom/menu-items", owner, { name: "Fries", pricePaise: -5 }), p({ slug: "demo-taproom" }))).status).toBe(400);
    expect((await menuItemPost(post("/api/merchant/venues/demo-taproom/menu-items", owner, { name: "Fries", pricePaise: 10.5 }), p({ slug: "demo-taproom" }))).status).toBe(400);
    expect((await menuItemPost(post("/api/merchant/venues/demo-taproom/menu-items", owner, { name: "Soup", pricePaise: 18000 }), p({ slug: "demo-taproom" }))).status).toBe(201);
  });
});

describe("Operational endpoints", () => {
  it("the expiry cron endpoint requires the shared secret", async () => {
    const call = (auth?: string) => expireRoute(new Request(`${ORIGIN}/api/internal/expire-bookings`, { method: "POST", headers: auth ? { authorization: auth } : {} }), none);
    expect((await call()).status).toBe(404);
    expect((await call("Bearer wrong")).status).toBe(404);
    const ok = await call(`Bearer ${process.env.CRON_SECRET}`);
    expect(ok.status).toBe(200);
    expect((await ok.json()).expired).toBe(0);
  });

  it("the dev payment simulator drives the real webhook pipeline and only for the payment's owner", async () => {
    const a = await loginAs(DEMO_PHONES.customer, "10.11.0.1");
    const b = await loginAs(DEMO_PHONES.customer2, "10.11.0.2");
    const [event] = await db.select().from(schema.events);
    const [tt] = await db.select().from(schema.ticketTypes).where(eq(schema.ticketTypes.name, "General"));
    const booking = (await (await bookingsPost(post("/api/bookings", a, { eventId: event!.id, lines: [{ ticketTypeId: tt!.id, quantity: 1 }] }), none)).json()).booking;
    const pay = await (await payRoute(post(`/api/bookings/${booking.ref}/pay`, a), p({ ref: booking.ref }))).json();
    expect((await simulateRoute(post("/api/dev/simulate-payment", b, { paymentRef: pay.paymentRef, outcome: "captured" }), none)).status).toBe(404);
    expect((await simulateRoute(post("/api/dev/simulate-payment", undefined, { paymentRef: pay.paymentRef, outcome: "captured" }), none)).status).toBe(401);
    expect((await (await simulateRoute(post("/api/dev/simulate-payment", a, { paymentRef: pay.paymentRef, outcome: "captured" }), none)).json()).result).toBe("processed");
    const view = await (await bookingGet(get(`/api/bookings/${booking.ref}`, a), p({ ref: booking.ref }))).json();
    expect(view.booking.status).toBe("confirmed");
    expect(view.tickets).toHaveLength(1);
  });
});
