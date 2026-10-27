import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { audit } from "@/server/audit";
import { enforceRateLimit } from "@/server/auth/rate-limit";

type User = typeof schema.users.$inferSelect;
const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export const talentQuery = z.object({
  kind: z.enum(["dj", "kj", "band", "other"]).optional(),
  genre: z.string().trim().max(40).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

const publicCols = {
  slug: schema.talentProfiles.slug, stageName: schema.talentProfiles.stageName, kind: schema.talentProfiles.kind,
  genres: schema.talentProfiles.genres, bio: schema.talentProfiles.bio, availabilityNote: schema.talentProfiles.availabilityNote, mediaUrl: schema.talentProfiles.mediaUrl,
};

/** Only approved profiles are public. */
export async function searchTalent(raw: unknown) {
  const q = talentQuery.parse(raw);
  const conds: SQL[] = [eq(schema.talentProfiles.status, "approved")];
  if (q.kind) conds.push(eq(schema.talentProfiles.kind, q.kind));
  if (q.genre) conds.push(sql`exists (select 1 from unnest(${schema.talentProfiles.genres}) g where g ilike ${like(q.genre)})`);
  if (q.q) conds.push(ilike(schema.talentProfiles.stageName, like(q.q)));
  const where = and(...conds);
  const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.talentProfiles).where(where);
  const items = await db.select(publicCols).from(schema.talentProfiles).where(where).orderBy(asc(schema.talentProfiles.stageName)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
  return { items, page: q.page, pageSize: q.pageSize, total: c?.n ?? 0 };
}

export async function getTalent(slug: string) {
  const [t] = await db.select(publicCols).from(schema.talentProfiles).where(and(eq(schema.talentProfiles.slug, slug), eq(schema.talentProfiles.status, "approved"))).limit(1);
  if (!t) throw notFound("Talent not found");
  return t;
}

export async function createEnquiry(userId: string, slug: string, i: { message: string; eventDate?: Date }) {
  const [t] = await db.select().from(schema.talentProfiles).where(and(eq(schema.talentProfiles.slug, slug), eq(schema.talentProfiles.status, "approved"))).limit(1);
  if (!t) throw notFound("Talent not found");
  if (i.eventDate && i.eventDate.getTime() < Date.now()) throw badRequest("Event date must be in the future");
  await enforceRateLimit(`enquiry:user:${userId}`, 10, 60 * 60_000);
  const [e] = await db.insert(schema.talentEnquiries).values({ userId, talentId: t.id, message: i.message, eventDate: i.eventDate }).returning();
  // Tell the talent (if they have an account) that something is waiting.
  if (t.userId) await db.insert(schema.notifications).values({ userId: t.userId, kind: "enquiry_received", body: `New booking enquiry for ${t.stageName}.` });
  return e!;
}

export async function listOwnEnquiries(userId: string) {
  return db.select({ e: schema.talentEnquiries, stageName: schema.talentProfiles.stageName }).from(schema.talentEnquiries)
    .innerJoin(schema.talentProfiles, eq(schema.talentProfiles.id, schema.talentEnquiries.talentId))
    .where(eq(schema.talentEnquiries.userId, userId)).orderBy(desc(schema.talentEnquiries.createdAt));
}

/** Talent see enquiries for profiles linked to their account; admins see all. */
export async function listEnquiriesForTalent(actor: User) {
  const scope = actor.role === "admin" ? undefined : eq(schema.talentProfiles.userId, actor.id);
  return db.select({ e: schema.talentEnquiries, stageName: schema.talentProfiles.stageName }).from(schema.talentEnquiries)
    .innerJoin(schema.talentProfiles, eq(schema.talentProfiles.id, schema.talentEnquiries.talentId))
    .where(scope).orderBy(desc(schema.talentEnquiries.createdAt)).limit(200);
}

export async function respondToEnquiry(actor: User, id: string, i: { status: "accepted" | "declined"; response?: string }) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ e: schema.talentEnquiries, talentUserId: schema.talentProfiles.userId })
      .from(schema.talentEnquiries).innerJoin(schema.talentProfiles, eq(schema.talentProfiles.id, schema.talentEnquiries.talentId))
      .where(eq(schema.talentEnquiries.id, id)).for("update", { of: schema.talentEnquiries });
    // Only the talent who owns the profile (or an admin) may respond; everyone else sees "not found".
    if (!row || (actor.role !== "admin" && row.talentUserId !== actor.id)) throw notFound("Enquiry not found");
    if (row.e.status !== "new") throw conflict("This enquiry has already been answered", "invalid_transition");
    await tx.update(schema.talentEnquiries).set({ status: i.status, response: i.response }).where(eq(schema.talentEnquiries.id, id));
    await tx.insert(schema.notifications).values({ userId: row.e.userId, kind: "enquiry_response", body: `Your talent enquiry was ${i.status}.` });
    await audit(tx, { actorUserId: actor.id, action: "enquiry.respond", entityType: "talent_enquiry", entityId: id, metadata: { status: i.status } });
    return { id, status: i.status };
  });
}
