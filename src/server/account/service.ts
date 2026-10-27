import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { conflict, notFound } from "@/lib/errors";
import { audit } from "@/server/audit";
import { getBalance } from "@/server/rewards/ledger";

export async function updateProfile(userId: string, i: { displayName?: string; email?: string }) {
  const [u] = await db.update(schema.users).set({ ...(i.displayName !== undefined && { displayName: i.displayName }), ...(i.email !== undefined && { email: i.email }) }).where(eq(schema.users.id, userId)).returning();
  return u!;
}

export async function history(userId: string) {
  const [reservations, orders, bookings, tickets] = await Promise.all([
    db.select().from(schema.reservations).where(eq(schema.reservations.userId, userId)).orderBy(desc(schema.reservations.createdAt)),
    db.select().from(schema.orders).where(eq(schema.orders.userId, userId)).orderBy(desc(schema.orders.createdAt)),
    db.select().from(schema.eventBookings).where(eq(schema.eventBookings.userId, userId)).orderBy(desc(schema.eventBookings.createdAt)),
    db.select({ ref: schema.tickets.ref, bookingId: schema.tickets.bookingId }).from(schema.tickets).where(eq(schema.tickets.userId, userId)),
  ]);
  return { reservations, orders, bookings, tickets };
}

/** Tier is shown only if an operator has assigned one. No thresholds are invented. Points and Alcometer stay separate. */
export async function rewardsSummary(userId: string) {
  const [membership] = await db.select({ code: schema.membershipTiers.code, name: schema.membershipTiers.name }).from(schema.userMemberships)
    .innerJoin(schema.membershipTiers, eq(schema.membershipTiers.id, schema.userMemberships.tierId)).where(eq(schema.userMemberships.userId, userId)).limit(1);
  const [points, alcometer, recentPoints, recentAlcometer] = await Promise.all([
    getBalance(db, userId, "points"),
    getBalance(db, userId, "alcometer"),
    db.select({ delta: schema.pointsLedger.delta, kind: schema.pointsLedger.kind, reason: schema.pointsLedger.reason, createdAt: schema.pointsLedger.createdAt }).from(schema.pointsLedger).where(eq(schema.pointsLedger.userId, userId)).orderBy(desc(schema.pointsLedger.createdAt)).limit(20),
    db.select({ delta: schema.alcometerLedger.delta, kind: schema.alcometerLedger.kind, reason: schema.alcometerLedger.reason, createdAt: schema.alcometerLedger.createdAt }).from(schema.alcometerLedger).where(eq(schema.alcometerLedger.userId, userId)).orderBy(desc(schema.alcometerLedger.createdAt)).limit(20),
  ]);
  return { tier: membership ?? null, points: { balance: points, recent: recentPoints }, alcometer: { balance: alcometer, recent: recentAlcometer } };
}

export async function createSupportTicket(userId: string, i: { subject: string; body: string }) {
  const [t] = await db.insert(schema.supportTickets).values({ userId, ...i }).returning();
  return t!;
}
export const listSupportTickets = (userId: string) => db.select().from(schema.supportTickets).where(eq(schema.supportTickets.userId, userId)).orderBy(desc(schema.supportTickets.createdAt));

/** Records an access/export or deletion request. Fulfilment is a manual, audited admin process (see docs). */
export async function createDataRequest(userId: string, kind: "export" | "delete") {
  const open = await db.select().from(schema.dataRequests).where(eq(schema.dataRequests.userId, userId));
  if (open.some((r) => r.kind === kind && (r.status === "open" || r.status === "in_progress"))) throw conflict("You already have an open request of this type", "duplicate_request");
  const [r] = await db.insert(schema.dataRequests).values({ userId, kind }).returning();
  await audit(db, { actorUserId: userId, action: `data_request.${kind}`, entityType: "data_request", entityId: r!.id });
  return r!;
}
export const listDataRequests = (userId: string) => db.select().from(schema.dataRequests).where(eq(schema.dataRequests.userId, userId)).orderBy(desc(schema.dataRequests.createdAt));

export async function recordConsent(userId: string, version: string) {
  const [v] = await db.select().from(schema.privacyNoticeVersions).where(eq(schema.privacyNoticeVersions.version, version)).limit(1);
  if (!v) throw notFound("Unknown privacy notice version");
  await db.insert(schema.consents).values({ userId, noticeVersionId: v.id });
  return { version };
}

export const listNotifications = (userId: string) => db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId)).orderBy(desc(schema.notifications.createdAt)).limit(50);
