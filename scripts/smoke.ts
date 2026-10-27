/**
 * HTTP smoke test against a RUNNING server (e.g. `next start`). Not a browser test.
 * Usage: BASE_URL=http://localhost:3100 tsx scripts/smoke.ts
 * Expects demo seed data and the dev OTP adapter + fake-sandbox payments (development/test only).
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const ORIGIN = new URL(BASE).origin;
let failed = 0;
let passed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) { passed++; console.log(`PASS  ${name}`); } else { failed++; console.log(`FAIL  ${name} ${detail}`); }
}
const get = (path: string, cookie = "") => fetch(BASE + path, { redirect: "manual", headers: cookie ? { cookie } : {} });
const post = (path: string, body: unknown, cookie = "", origin: string | null = ORIGIN) =>
  fetch(BASE + path, { method: "POST", redirect: "manual", headers: { "content-type": "application/json", ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });

async function login(phone: string): Promise<string> {
  const r1 = await post("/api/auth/otp/request", { phone });
  if (r1.status !== 200) throw new Error(`otp request ${r1.status}`);
  const r2 = await post("/api/auth/otp/verify", { phone, code: "123456" });
  if (r2.status !== 200) throw new Error(`otp verify ${r2.status}`);
  return (r2.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

async function main() {
  const health = await get("/api/health");
  check("health endpoint reports ok", health.status === 200 && (await health.json()).db === "ok");

  for (const path of ["/", "/explore", "/events", "/talents", "/venues/demo-taproom", "/events/demo-friday-night", "/talents/dj-demo", "/login", "/legal"]) {
    const r = await get(path);
    check(`GET ${path} renders without login`, r.status === 200, `status ${r.status}`);
  }
  const home = await (await get("/")).text();
  check("home page has DRNK branding and search", home.includes("DRNK") && home.includes("role=\"search\""));

  const explore = await (await get("/explore?q=taproom")).text();
  check("explore search finds the seeded venue", explore.includes("Demo Taproom") || explore.includes("Taproom"));
  const none = await (await get("/explore?q=zzzzzz")).text();
  check("explore shows an empty state for no results", none.includes("No venues match"));
  const bad = await get("/explore?category=bogus");
  check("explore handles invalid filters with a message, not a crash", bad.status === 200 && (await bad.text()).includes("aren&#x27;t valid"));
  check("unknown venue is a 404", (await get("/venues/does-not-exist")).status === 404);

  const slugs = ["terms", "privacy", "cookies", "refunds", "payment-terms", "merchant-terms", "host-talent-terms", "rewards-terms", "grievance", "about", "accessibility", "data-requests"];
  for (const s of slugs) {
    const r = await get(`/legal/${s}`);
    const t = await r.text();
    check(`policy page /legal/${s}`, r.status === 200 && t.includes("Draft for review"));
  }
  const footer = await (await get("/")).text();
  check("footer links to every policy page", slugs.every((s) => footer.includes(`/legal/${s}`)));

  const h = (await get("/")).headers;
  check("security headers are set", h.get("x-content-type-options") === "nosniff" && h.get("x-frame-options") === "DENY" && !!h.get("strict-transport-security") && h.get("x-powered-by") === null);

  for (const p of ["/account", "/admin", "/merchant", "/bookings/EVT-NOPE"]) {
    const r = await get(p);
    check(`protected page ${p} redirects anonymous users to login`, r.status >= 300 && r.status < 400 && (r.headers.get("location") ?? "").includes("/login"), `status ${r.status}`);
  }
  check("protected API rejects anonymous callers", (await get("/api/me")).status === 401);
  check("admin API rejects anonymous callers", (await get("/api/admin/lists/venues")).status === 401);
  check("cross-origin POST is rejected", (await post("/api/auth/otp/request", { phone: "9000000002" }, "", "https://evil.example")).status === 403);
  check("dev simulator is hidden without a session", (await post("/api/dev/simulate-payment", { paymentRef: "x", outcome: "captured" })).status === 401);

  // Customer journey: login -> account -> book -> pay (sandbox) -> confirmed
  const cust = await login("9000000002");
  const acct = await get("/account", cust);
  check("customer can open their account page", acct.status === 200 && (await acct.text()).includes("Support"));
  const admin404 = await (await get("/admin", cust)).text();
  check("customer sees 'Admins only' on /admin", admin404.includes("Admins only"));
  check("customer is rejected by admin API (403)", (await get("/api/admin/lists/venues", cust)).status === 403);

  const ev = await (await get("/api/events/demo-friday-night")).json();
  const general = ev.ticketTypes.find((t: { name: string }) => t.name === "General");
  const booked = await post("/api/bookings", { eventId: ev.event.id, lines: [{ ticketTypeId: general.id, quantity: 1 }] }, cust);
  check("customer can create a booking", booked.status === 201);
  const booking = (await booked.json()).booking;
  const pay = await (await post(`/api/bookings/${booking.ref}/pay`, {}, cust)).json();
  const pending = await (await get(`/api/bookings/${booking.ref}`, cust)).json();
  check("booking stays pending until a verified webhook arrives", pending.booking.status === "pending_payment");
  const sim = await (await post("/api/dev/simulate-payment", { paymentRef: pay.paymentRef, outcome: "captured" }, cust)).json();
  check("signed sandbox webhook is processed", sim.result === "processed");
  const done = await (await get(`/api/bookings/${booking.ref}`, cust)).json();
  check("booking is confirmed and a ticket is issued", done.booking.status === "confirmed" && done.tickets.length === 1);
  const page = await (await get(`/bookings/${booking.ref}`, cust)).text();
  check("booking page shows Confirmed and the ticket", page.includes("Confirmed") && page.includes("TKT-"));

  // Isolation: another customer cannot see it
  const other = await login("9000000003");
  check("another customer cannot read the booking (404)", (await get(`/api/bookings/${booking.ref}`, other)).status === 404);
  check("another customer's booking page is a 404", (await get(`/bookings/${booking.ref}`, other)).status === 404);

  // Logout revokes
  const out = await post("/api/auth/logout", {}, cust);
  check("logout succeeds", out.status === 200);
  check("revoked session can no longer reach /api/me", (await get("/api/me", cust)).status === 401);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
