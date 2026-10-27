import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/server/audit";
import { revokeAllSessionsForUser } from "@/server/auth/session";

type User = typeof schema.users.$inferSelect;
type Approval = "approved" | "rejected" | "suspended";
export type ApprovalEntity = "venue" | "event" | "talent" | "merchant_application";

const tables = {
  venue: schema.venues, event: schema.events, talent: schema.talentProfiles, merchant_application: schema.merchantApplications,
} as const;

/** Every privileged mutation below writes an audit event in the same transaction. */
export async function setApproval(admin: User, entity: ApprovalEntity, id: string, status: Approval) {
  const table = tables[entity];
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(table).where(eq(table.id, id)).for("update");
    if (!row) throw notFound(`${entity} not found`);
    await tx.update(table).set({ status }).where(eq(table.id, id));
    if (entity === "merchant_application" && status === "approved") {
      const app = row as typeof schema.merchantApplications.$inferSelect;
      const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, app.userId));
      // Promotion only from customer; an admin is never downgraded by an application.
      if (u?.role === "customer") await tx.update(schema.users).set({ role: "merchant" }).where(eq(schema.users.id, u.id));
    }
    await audit(tx, { actorUserId: admin.id, action: `${entity}.${status}`, entityType: entity, entityId: id, metadata: { from: (row as { status: string }).status } });
    return { id, status };
  });
}

/** Explicit administrator/role assignment. An admin cannot change their own role (prevents lock-out and silent self-escalation paths). */
export async function setUserRole(admin: User, userId: string, role: User["role"]) {
  if (admin.id === userId) throw forbidden("You cannot change your own role");
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!u) throw notFound("User not found");
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ role }).where(eq(schema.users.id, userId));
    await audit(tx, { actorUserId: admin.id, action: "user.role", entityType: "user", entityId: userId, metadata: { from: u.role, to: role } });
  });
  await revokeAllSessionsForUser(userId); // force re-authentication under the new role
  return { id: userId, role };
}

export async function assignTier(admin: User, userId: string, code: string) {
  const [tier] = await db.select().from(schema.membershipTiers).where(eq(schema.membershipTiers.code, code));
  if (!tier) throw badRequest("Unknown tier");
  const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId));
  if (!u) throw notFound("User not found");
  await db.transaction(async (tx) => {
    await tx.insert(schema.userMemberships).values({ userId, tierId: tier.id }).onConflictDoUpdate({ target: schema.userMemberships.userId, set: { tierId: tier.id, assignedAt: new Date() } });
    await audit(tx, { actorUserId: admin.id, action: "membership.assign", entityType: "user", entityId: userId, metadata: { tier: code } });
  });
  return { userId, tier: code };
}

export async function createTalentProfile(admin: User, i: { stageName: string; kind: "dj" | "kj" | "band" | "other"; genres: string[]; bio?: string; userId?: string; status: "pending" | "approved" }) {
  const slug = `${i.stageName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
  const [t] = await db.insert(schema.talentProfiles).values({ ...i, slug }).returning();
  await audit(db, { actorUserId: admin.id, action: "talent.create", entityType: "talent", entityId: t!.id });
  return t!;
}

export async function setSupportStatus(admin: User, id: string, status: "open" | "in_progress" | "resolved" | "rejected") {
  const [t] = await db.update(schema.supportTickets).set({ status }).where(eq(schema.supportTickets.id, id)).returning({ id: schema.supportTickets.id });
  if (!t) throw notFound("Ticket not found");
  await audit(db, { actorUserId: admin.id, action: "support.status", entityType: "support_ticket", entityId: id, metadata: { status } });
  return { id, status };
}

export async function setDataRequestStatus(admin: User, id: string, status: "open" | "in_progress" | "resolved" | "rejected") {
  const [r] = await db.update(schema.dataRequests).set({ status }).where(eq(schema.dataRequests.id, id)).returning({ id: schema.dataRequests.id });
  if (!r) throw notFound("Request not found");
  await audit(db, { actorUserId: admin.id, action: "data_request.status", entityType: "data_request", entityId: id, metadata: { status } });
  return { id, status };
}

const pageLimit = (n: unknown) => Math.min(200, Math.max(1, Number(n) || 50));

export const adminLists = {
  venues: (status?: string) => db.select().from(schema.venues).where(status ? sql`${schema.venues.status} = ${status}` : undefined).orderBy(desc(schema.venues.createdAt)).limit(200),
  events: (status?: string) => db.select().from(schema.events).where(status ? sql`${schema.events.status} = ${status}` : undefined).orderBy(desc(schema.events.createdAt)).limit(200),
  talents: (status?: string) => db.select().from(schema.talentProfiles).where(status ? sql`${schema.talentProfiles.status} = ${status}` : undefined).orderBy(desc(schema.talentProfiles.createdAt)).limit(200),
  applications: (status?: string) => db.select().from(schema.merchantApplications).where(status ? sql`${schema.merchantApplications.status} = ${status}` : undefined).orderBy(desc(schema.merchantApplications.createdAt)).limit(200),
  bookings: () => db.select().from(schema.eventBookings).orderBy(desc(schema.eventBookings.createdAt)).limit(200),
  support: () => db.select().from(schema.supportTickets).orderBy(desc(schema.supportTickets.createdAt)).limit(200),
  dataRequests: () => db.select().from(schema.dataRequests).orderBy(desc(schema.dataRequests.createdAt)).limit(200),
  audit: (limit?: unknown) => db.select().from(schema.auditEvents).orderBy(desc(schema.auditEvents.createdAt)).limit(pageLimit(limit)),
};
