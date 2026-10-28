import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@/db/client";
import { GET as venuesRoute } from "@/app/api/venues/route";
import { GET as venueRoute } from "@/app/api/venues/[slug]/route";
import { GET as eventsRoute } from "@/app/api/events/route";
import { GET as eventRoute } from "@/app/api/events/[slug]/route";
import { GET as ordersGet, POST as ordersPost } from "@/app/api/orders/route";
import { GET as orderGet } from "@/app/api/orders/[ref]/route";
import { POST as orderCancel } from "@/app/api/orders/[ref]/cancel/route";
import { POST as sessionRoute } from "@/app/api/table-sessions/route";
import { GET as merchantOrders } from "@/app/api/merchant/orders/route";
import { POST as merchantOrderStatus } from "@/app/api/merchant/orders/[ref]/status/route";
import { POST as reservationsPost, GET as reservationsGet } from "@/app/api/reservations/route";
import { POST as reservationCancel } from "@/app/api/reservations/[ref]/cancel/route";
import { POST as merchantResStatus } from "@/app/api/merchant/reservations/[ref]/status/route";
import { seedDemo } from "@/db/seed-data";
import { closeDb, db, DEMO_PHONES, loginAs, makeRequest, resetAndSeed } from "../helpers";

beforeEach(async () => {
  await resetAndSeed();
  // The seeded pub takes dine-in orders too. These tests need one venue that does not, so switch it off here.
  await db.update(schema.venues).set({ dineInEnabled: false, tableSessionsEnabled: false }).where(eq(schema.venues.slug, "demo-pub"));
});
afterAll(closeDb);

const withRef = (ref: string) => ({ params: Promise.resolve({ ref }) });
const withSlug = (slug: string) => ({ params: Promise.resolve({ slug }) });
const none = { params: Promise.resolve({}) };
const get = (path: string) => makeRequest(path, { method: "GET" });

describe("Explore (public)", () => {
  it("lists approved venues without authentication", async () => {
    const res = await venuesRoute(get("/api/venues"), none);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(3);
  });

  it("hides venues that are not approved (list and detail)", async () => {
    await db.update(schema.venues).set({ status: "pending" }).where(eq(schema.venues.slug, "demo-pub"));
    expect((await (await venuesRoute(get("/api/venues"), none)).json()).total).toBe(2);
    expect((await venueRoute(get("/api/venues/demo-pub"), withSlug("demo-pub"))).status).toBe(404);
    await db.update(schema.venues).set({ status: "suspended" }).where(eq(schema.venues.slug, "demo-kitchen"));
    expect((await (await venuesRoute(get("/api/venues"), none)).json()).total).toBe(1);
  });

  it.each([
    ["q=taproom", 1], ["q=indiranagar", 1], ["q=north", 1], ["category=pub", 1], ["category=restaurant", 1],
    ["cuisine=bar", 2], ["neighbourhood=koramangala", 1], ["dineIn=true", 2], ["dineIn=false", 1], ["q=zzzz", 0],
  ])("filters by %s", async (qs, expected) => {
    const body = await (await venuesRoute(get(`/api/venues?${qs}`), none)).json();
    expect(body.total).toBe(expected);
  });

  it("paginates and sorts deterministically", async () => {
    const p1 = await (await venuesRoute(get("/api/venues?pageSize=2&page=1"), none)).json();
    const p2 = await (await venuesRoute(get("/api/venues?pageSize=2&page=2"), none)).json();
    expect(p1.items).toHaveLength(2);
    expect(p2.items).toHaveLength(1);
    expect(p1.total).toBe(3);
    const names = [...p1.items, ...p2.items].map((v: { name: string }) => v.name);
    expect(names).toEqual([...names].sort());
  });

  it("validates query parameters", async () => {
    expect((await venuesRoute(get("/api/venues?category=spaceship"), none)).status).toBe(400);
    expect((await venuesRoute(get("/api/venues?pageSize=500"), none)).status).toBe(400);
    expect((await venuesRoute(get("/api/venues?page=0"), none)).status).toBe(400);
  });

  it("treats LIKE wildcards and SQL metacharacters literally", async () => {
    expect((await (await venuesRoute(get("/api/venues?q=%25"), none)).json()).total).toBe(0);
    expect((await (await venuesRoute(get("/api/venues?q=" + encodeURIComponent("'; drop table venues;--")), none)).json()).total).toBe(0);
    expect((await (await venuesRoute(get("/api/venues"), none)).json()).total).toBe(3);
  });

  it("returns an empty page for an unknown city", async () => {
    const body = await (await venuesRoute(get("/api/venues?city=atlantis"), none)).json();
    expect(body.items).toEqual([]);
  });

  it("venue detail exposes menu and prices from the server, but not internal owner ids", async () => {
    const body = await (await venueRoute(get("/api/venues/demo-taproom"), withSlug("demo-taproom"))).json();
    expect(body.menu.items.length).toBe(18);
    expect(body.menu.categories.map((c: { name: string }) => c.name)).toEqual(["Bites", "Pizza and mains", "Desserts", "Soft drinks", "Craft beers"]);
    expect(body.menu.items.filter((i: { containsAlcohol: boolean }) => i.containsAlcohol)).toHaveLength(3);
    expect(body.menu.items.find((i: { name: string }) => i.name === "Peri-peri fries").pricePaise).toBe(29900);
    expect(body.venue.ownerUserId).toBeUndefined();
    expect(body.events).toHaveLength(1);
  });

  it("lists events and shows remaining tickets without raw inventory internals", async () => {
    const list = await (await eventsRoute(get("/api/events"), none)).json();
    expect(list.total).toBe(1);
    const detail = await (await eventRoute(get("/api/events/demo-friday-night"), withSlug("demo-friday-night"))).json();
    expect(detail.ticketTypes.map((t: { remaining: number }) => t.remaining).sort((a: number, b: number) => a - b)).toEqual([5, 100]);
    expect(detail.ticketTypes[0].capacity).toBeUndefined();
    expect(detail.event.hostUserId).toBeUndefined();
  });

  it("does not list unapproved events", async () => {
    await db.update(schema.events).set({ status: "pending" });
    expect((await (await eventsRoute(get("/api/events"), none)).json()).total).toBe(0);
    expect((await eventRoute(get("/api/events/demo-friday-night"), withSlug("demo-friday-night"))).status).toBe(404);
  });
});

// ---------- Dine-in ----------
async function menu(slug = "demo-taproom") {
  const [v] = await db.select().from(schema.venues).where(eq(schema.venues.slug, slug));
  return db.select().from(schema.menuItems).where(eq(schema.menuItems.venueId, v!.id));
}
const order = (cookie: string, body: unknown) => ordersPost(makeRequest("/api/orders", { cookie, body }), none);

describe("Dine-in orders", () => {
  it("requires authentication", async () => {
    const items = await menu();
    expect((await order("", { venueSlug: "demo-taproom", items: [{ menuItemId: items[0]!.id, quantity: 1 }] })).status).toBe(401);
  });

  it("prices on the server and ignores client-sent prices and totals", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer, "10.3.0.1");
    const fries = (await menu()).find((i) => i.name === "Peri-peri fries")!;
    const res = await order(cookie, { venueSlug: "demo-taproom", items: [{ menuItemId: fries.id, quantity: 2, pricePaise: 1 }], totalPaise: 1 });
    expect(res.status).toBe(201);
    const { order: o } = await res.json();
    expect(o.totalPaise).toBe(29900 * 2);
    const detail = await (await orderGet(makeRequest(`/api/orders/${o.ref}`, { method: "GET", cookie }), withRef(o.ref))).json();
    expect(detail.items[0].nameSnapshot).toBe("Peri-peri fries");
    expect(detail.items[0].unitPricePaise).toBe(29900);
  });

  it("order history keeps the price snapshot even if the menu price later changes", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer, "10.3.0.2");
    const fries = (await menu()).find((i) => i.name === "Peri-peri fries")!;
    const { order: o } = await (await order(cookie, { venueSlug: "demo-taproom", items: [{ menuItemId: fries.id, quantity: 1 }] })).json();
    await db.update(schema.menuItems).set({ pricePaise: 99900 }).where(eq(schema.menuItems.id, fries.id));
    const detail = await (await orderGet(makeRequest(`/api/orders/${o.ref}`, { method: "GET", cookie }), withRef(o.ref))).json();
    expect(detail.order.totalPaise).toBe(29900);
  });

  it("rejects unavailable items, alcohol items, foreign-venue items, duplicates and bad quantities", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer, "10.3.0.3");
    const items = await menu();
    const soldOut = items.find((i) => !i.available)!;
    const ok = items.find((i) => i.available)!;
    expect((await order(cookie, { venueSlug: "demo-taproom", items: [{ menuItemId: soldOut.id, quantity: 1 }] })).status).toBe(409);
    await db.update(schema.menuItems).set({ containsAlcohol: true }).where(eq(schema.menuItems.id, ok.id));
    const alc = await order(cookie, { venueSlug: "demo-taproom", items: [{ menuItemId: ok.id, quantity: 1 }] });
    expect(alc.status).toBe(409);
    expect((await alc.json()).error.code).toBe("alcohol_not_orderable");
    await db.update(schema.menuItems).set({ containsAlcohol: false }).where(eq(schema.menuItems.id, ok.id));
    const [kitchen] = await db.select().from(schema.venues).where(eq(schema.venues.slug, "demo-kitchen"));
    const [foreign] = await db.insert(schema.menuItems).values({ venueId: kitchen!.id, name: "Dal", pricePaise: 20000 }).returning();
    expect((await order(cookie, { venueSlug: "demo-taproom", items: [{ menuItemId: foreign!.id, quantity: 1 }] })).status).toBe(400);
    expect((await order(cookie, { venueSlug: "demo-taproom", items: [{ menuItemId: ok.id, quantity: 1 }, { menuItemId: ok.id, quantity: 1 }] })).status).toBe(400);
    expect((await order(cookie, { venueSlug: "demo-taproom", items: [{ menuItemId: ok.id, quantity: 0 }] })).status).toBe(400);
    expect((await order(cookie, { venueSlug: "demo-taproom", items: [{ menuItemId: ok.id, quantity: 1.5 }] })).status).toBe(400);
  });

  it("refuses orders at a venue without dine-in", async () => {
    const cookie = await loginAs(DEMO_PHONES.customer, "10.3.0.4");
    const [pub] = await db.select().from(schema.venues).where(eq(schema.venues.slug, "demo-pub"));
    const [item] = await db.insert(schema.menuItems).values({ venueId: pub!.id, name: "Nachos", pricePaise: 25000 }).returning();
    expect((await order(cookie, { venueSlug: "demo-pub", items: [{ menuItemId: item!.id, quantity: 1 }] })).status).toBe(409);
  });

  it("customers cannot read or cancel each other's orders, and lists are scoped", async () => {
    const a = await loginAs(DEMO_PHONES.customer, "10.3.1.1");
    const b = await loginAs(DEMO_PHONES.customer2, "10.3.1.2");
    const item = (await menu()).find((i) => i.available)!;
    const { order: o } = await (await order(a, { venueSlug: "demo-taproom", items: [{ menuItemId: item.id, quantity: 1 }] })).json();
    expect((await orderGet(makeRequest(`/api/orders/${o.ref}`, { method: "GET", cookie: b }), withRef(o.ref))).status).toBe(404);
    expect((await orderCancel(makeRequest(`/api/orders/${o.ref}/cancel`, { cookie: b }), withRef(o.ref))).status).toBe(404);
    expect((await (await ordersGet(makeRequest("/api/orders", { method: "GET", cookie: b }), none)).json()).orders).toHaveLength(0);
    expect((await (await ordersGet(makeRequest("/api/orders", { method: "GET", cookie: a }), none)).json()).orders).toHaveLength(1);
  });

  it("owner can cancel while placed, but not once the venue has accepted", async () => {
    const cust = await loginAs(DEMO_PHONES.customer, "10.3.2.1");
    const merch = await loginAs(DEMO_PHONES.merchant, "10.3.2.2");
    const item = (await menu()).find((i) => i.available)!;
    const place = async () => (await (await order(cust, { venueSlug: "demo-taproom", items: [{ menuItemId: item.id, quantity: 1 }] })).json()).order.ref as string;
    const r1 = await place();
    expect((await orderCancel(makeRequest(`/api/orders/${r1}/cancel`, { cookie: cust }), withRef(r1))).status).toBe(200);
    const r2 = await place();
    await merchantOrderStatus(makeRequest(`/api/merchant/orders/${r2}/status`, { cookie: merch, body: { status: "accepted" } }), withRef(r2));
    expect((await orderCancel(makeRequest(`/api/orders/${r2}/cancel`, { cookie: cust }), withRef(r2))).status).toBe(409);
  });
});

describe("Table sessions", () => {
  it("lets the owner add orders to their open session, and nobody else", async () => {
    const a = await loginAs(DEMO_PHONES.customer, "10.4.0.1");
    const b = await loginAs(DEMO_PHONES.customer2, "10.4.0.2");
    const item = (await menu()).find((i) => i.available)!;
    const s = await (await sessionRoute(makeRequest("/api/table-sessions", { cookie: a, body: { venueSlug: "demo-taproom", tableLabel: "T4" } }), none)).json();
    const sid = s.tableSession.id as string;
    expect((await order(a, { venueSlug: "demo-taproom", tableSessionId: sid, items: [{ menuItemId: item.id, quantity: 1 }] })).status).toBe(201);
    expect((await order(a, { venueSlug: "demo-taproom", tableSessionId: sid, items: [{ menuItemId: item.id, quantity: 2 }] })).status).toBe(201); // add more
    expect((await order(b, { venueSlug: "demo-taproom", tableSessionId: sid, items: [{ menuItemId: item.id, quantity: 1 }] })).status).toBe(404);
  });

  it("rejects a session at a different venue, a closed session, and venues without sessions", async () => {
    const a = await loginAs(DEMO_PHONES.customer, "10.4.1.1");
    const item = (await menu()).find((i) => i.available)!;
    const s = await (await sessionRoute(makeRequest("/api/table-sessions", { cookie: a, body: { venueSlug: "demo-taproom", tableLabel: "T1" } }), none)).json();
    const [kitchen] = await db.select().from(schema.venues).where(eq(schema.venues.slug, "demo-kitchen"));
    const [dal] = await db.insert(schema.menuItems).values({ venueId: kitchen!.id, name: "Dal", pricePaise: 20000 }).returning();
    expect((await order(a, { venueSlug: "demo-kitchen", tableSessionId: s.tableSession.id, items: [{ menuItemId: dal!.id, quantity: 1 }] })).status).toBe(404);
    await db.update(schema.tableSessions).set({ status: "closed" });
    expect((await order(a, { venueSlug: "demo-taproom", tableSessionId: s.tableSession.id, items: [{ menuItemId: item.id, quantity: 1 }] })).status).toBe(409);
    expect((await sessionRoute(makeRequest("/api/table-sessions", { cookie: a, body: { venueSlug: "demo-pub", tableLabel: "T1" } }), none)).status).toBe(409);
  });
});

describe("Merchant isolation and role checks", () => {
  async function secondMerchant() {
    const [u] = await db.insert(schema.users).values({ phoneE164: "+919000000005", role: "merchant", displayName: "Other Merchant" }).returning();
    const [city] = await db.select().from(schema.cities);
    await db.insert(schema.venues).values({ cityId: city!.id, ownerUserId: u!.id, slug: "other-venue", name: "Other Venue [Demo]", category: "cafe", neighbourhood: "Whitefield", address: "x", status: "approved", dineInEnabled: true });
    return loginAs("+919000000005", "10.5.0.9");
  }

  it("a merchant can act only on their own venue's orders; others get 404", async () => {
    const cust = await loginAs(DEMO_PHONES.customer, "10.5.0.1");
    const owner = await loginAs(DEMO_PHONES.merchant, "10.5.0.2");
    const other = await secondMerchant();
    const item = (await menu()).find((i) => i.available)!;
    const ref = (await (await order(cust, { venueSlug: "demo-taproom", items: [{ menuItemId: item.id, quantity: 1 }] })).json()).order.ref as string;
    const upd = (cookie: string, status: string) => merchantOrderStatus(makeRequest(`/api/merchant/orders/${ref}/status`, { cookie, body: { status } }), withRef(ref));
    expect((await upd(other, "accepted")).status).toBe(404);
    expect((await (await merchantOrders(makeRequest("/api/merchant/orders", { method: "GET", cookie: other }), none)).json()).orders).toHaveLength(0);
    expect((await (await merchantOrders(makeRequest("/api/merchant/orders", { method: "GET", cookie: owner }), none)).json()).orders).toHaveLength(1);
    expect((await upd(owner, "accepted")).status).toBe(200);
    expect((await upd(owner, "served")).status).toBe(200);
    expect((await upd(owner, "accepted")).status).toBe(409); // cannot go backwards
    const audits = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.action, "order.status"));
    expect(audits).toHaveLength(2);
  });

  it("customers and anonymous users are rejected from merchant APIs", async () => {
    const cust = await loginAs(DEMO_PHONES.customer, "10.5.1.1");
    expect((await merchantOrders(makeRequest("/api/merchant/orders", { method: "GET", cookie: cust }), none)).status).toBe(403);
    expect((await merchantOrders(makeRequest("/api/merchant/orders", { method: "GET" }), none)).status).toBe(401);
    expect((await merchantOrderStatus(makeRequest("/api/merchant/orders/ORD-X/status", { cookie: cust, body: { status: "accepted" } }), withRef("ORD-X"))).status).toBe(403);
  });

  it("an admin can manage any venue's orders", async () => {
    const cust = await loginAs(DEMO_PHONES.customer, "10.5.2.1");
    const admin = await loginAs(DEMO_PHONES.admin, "10.5.2.2");
    const item = (await menu()).find((i) => i.available)!;
    const ref = (await (await order(cust, { venueSlug: "demo-taproom", items: [{ menuItemId: item.id, quantity: 1 }] })).json()).order.ref as string;
    expect((await merchantOrderStatus(makeRequest(`/api/merchant/orders/${ref}/status`, { cookie: admin, body: { status: "accepted" } }), withRef(ref))).status).toBe(200);
  });
});

describe("Reservations", () => {
  const future = (h = 48) => new Date(Date.now() + h * 3600_000).toISOString();
  const reserve = (cookie: string, body: unknown) => reservationsPost(makeRequest("/api/reservations", { cookie, body }), none);

  it("creates a reservation with a booking reference and lists it for the owner only", async () => {
    const a = await loginAs(DEMO_PHONES.customer, "10.6.0.1");
    const b = await loginAs(DEMO_PHONES.customer2, "10.6.0.2");
    const res = await reserve(a, { venueSlug: "demo-taproom", partySize: 4, slotAt: future() });
    expect(res.status).toBe(201);
    expect((await res.json()).reservation.ref).toMatch(/^RSV-/);
    expect((await (await reservationsGet(makeRequest("/api/reservations", { method: "GET", cookie: a }), none)).json()).reservations).toHaveLength(1);
    expect((await (await reservationsGet(makeRequest("/api/reservations", { method: "GET", cookie: b }), none)).json()).reservations).toHaveLength(0);
  });

  it("validates party size, time, venue and duplicates", async () => {
    const a = await loginAs(DEMO_PHONES.customer, "10.6.1.1");
    expect((await reserve(a, { venueSlug: "demo-taproom", partySize: 0, slotAt: future() })).status).toBe(400);
    expect((await reserve(a, { venueSlug: "demo-taproom", partySize: 51, slotAt: future() })).status).toBe(400);
    expect((await reserve(a, { venueSlug: "demo-taproom", partySize: 2, slotAt: future(-5) })).status).toBe(400);
    expect((await reserve(a, { venueSlug: "demo-taproom", partySize: 2, slotAt: "tomorrow" })).status).toBe(400);
    expect((await reserve(a, { venueSlug: "nope", partySize: 2, slotAt: future() })).status).toBe(404);
    const slot = future();
    expect((await reserve(a, { venueSlug: "demo-taproom", partySize: 2, slotAt: slot })).status).toBe(201);
    expect((await reserve(a, { venueSlug: "demo-taproom", partySize: 2, slotAt: slot })).status).toBe(409);
  });

  it("owner can cancel; others cannot; the venue confirms; customers cannot self-confirm", async () => {
    const a = await loginAs(DEMO_PHONES.customer, "10.6.2.1");
    const b = await loginAs(DEMO_PHONES.customer2, "10.6.2.2");
    const m = await loginAs(DEMO_PHONES.merchant, "10.6.2.3");
    const mk = async (h: number) => (await (await reserve(a, { venueSlug: "demo-taproom", partySize: 2, slotAt: future(h) })).json()).reservation.ref as string;
    const r1 = await mk(48);
    expect((await reservationCancel(makeRequest(`/api/reservations/${r1}/cancel`, { cookie: b }), withRef(r1))).status).toBe(404);
    expect((await merchantResStatus(makeRequest(`/api/merchant/reservations/${r1}/status`, { cookie: a, body: { status: "confirmed" } }), withRef(r1))).status).toBe(403);
    expect((await merchantResStatus(makeRequest(`/api/merchant/reservations/${r1}/status`, { cookie: m, body: { status: "confirmed" } }), withRef(r1))).status).toBe(200);
    expect((await reservationCancel(makeRequest(`/api/reservations/${r1}/cancel`, { cookie: a }), withRef(r1))).status).toBe(200);
    expect((await merchantResStatus(makeRequest(`/api/merchant/reservations/${r1}/status`, { cookie: m, body: { status: "confirmed" } }), withRef(r1))).status).toBe(409); // cancelled is terminal
    expect((await reservationCancel(makeRequest(`/api/reservations/${r1}/cancel`, { cookie: a }), withRef(r1))).status).toBe(409);
  });
});

describe("Seeded demo menus", () => {
  it("gives every demo venue a full menu and dine-in, and re-seeding changes nothing", async () => {
    await seedDemo(db); // beforeEach switched the pub's dine-in off: re-seeding restores it
    const count = async () => {
      const rows = await db.select({ slug: schema.venues.slug, dine: schema.venues.dineInEnabled, sessions: schema.venues.tableSessionsEnabled, id: schema.venues.id }).from(schema.venues);
      const out: Record<string, { items: number; categories: number; dine: boolean; sessions: boolean }> = {};
      for (const v of rows) {
        out[v.slug] = {
          items: (await db.select().from(schema.menuItems).where(eq(schema.menuItems.venueId, v.id))).length,
          categories: (await db.select().from(schema.menuCategories).where(eq(schema.menuCategories.venueId, v.id))).length,
          dine: v.dine, sessions: v.sessions,
        };
      }
      return out;
    };
    const first = await count();
    for (const slug of ["demo-taproom", "demo-kitchen", "demo-pub"]) {
      expect(first[slug]?.items).toBeGreaterThanOrEqual(10);
      expect(first[slug]?.categories).toBeGreaterThanOrEqual(4);
      expect(first[slug]).toMatchObject({ dine: true, sessions: true });
    }
    await seedDemo(db);
    expect(await count()).toEqual(first);
  });

  it("a customer can order non-alcohol items at each demo venue, and alcohol items are still refused", async () => {
    await seedDemo(db);
    const cookie = await loginAs(DEMO_PHONES.customer);
    for (const slug of ["demo-taproom", "demo-kitchen", "demo-pub"]) {
      const [v] = await db.select().from(schema.venues).where(eq(schema.venues.slug, slug));
      const items = await db.select().from(schema.menuItems).where(eq(schema.menuItems.venueId, v!.id));
      const food = items.find((i) => i.available && !i.containsAlcohol)!;
      const drink = items.find((i) => i.containsAlcohol)!;
      const ok = await ordersPost(makeRequest("/api/orders", { cookie, body: { venueSlug: slug, items: [{ menuItemId: food.id, quantity: 2 }] } }), none);
      expect(ok.status).toBe(201);
      expect((await ok.json()).order.totalPaise).toBe(food.pricePaise * 2);
      const refused = await ordersPost(makeRequest("/api/orders", { cookie, body: { venueSlug: slug, items: [{ menuItemId: drink.id, quantity: 1 }] } }), none);
      expect(refused.status).toBeGreaterThanOrEqual(400);
    }
  });
});
