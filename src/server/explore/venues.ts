import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { notFound } from "@/lib/errors";

export const venueQuery = z.object({
  city: z.string().default("bengaluru"),
  q: z.string().trim().max(80).optional(),
  category: z.enum(["restaurant", "pub", "microbrewery", "lounge", "cafe"]).optional(),
  cuisine: z.string().trim().max(40).optional(),
  neighbourhood: z.string().trim().max(60).optional(),
  dineIn: z.enum(["true", "false"]).optional(),
  sort: z.enum(["name", "newest"]).default("name"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
export type VenueQuery = z.infer<typeof venueQuery>;

/** Escape LIKE wildcards so user input is matched literally. */
const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Only venues with status=approved are ever returned by public queries. */
export async function searchVenues(raw: unknown) {
  const q = venueQuery.parse(raw);
  const [city] = await db.select().from(schema.cities).where(and(eq(schema.cities.slug, q.city), eq(schema.cities.active, true))).limit(1);
  if (!city) return { items: [], page: q.page, pageSize: q.pageSize, total: 0 };

  const conds: SQL[] = [eq(schema.venues.cityId, city.id), eq(schema.venues.status, "approved")];
  if (q.q) {
    conds.push(or(ilike(schema.venues.name, like(q.q)), ilike(schema.venues.neighbourhood, like(q.q)), sql`exists (select 1 from unnest(${schema.venues.cuisines}) c where c ilike ${like(q.q)})`)!);
  }
  if (q.category) conds.push(eq(schema.venues.category, q.category));
  if (q.cuisine) conds.push(sql`exists (select 1 from unnest(${schema.venues.cuisines}) c where c ilike ${like(q.cuisine)})`);
  if (q.neighbourhood) conds.push(ilike(schema.venues.neighbourhood, like(q.neighbourhood)));
  if (q.dineIn) conds.push(eq(schema.venues.dineInEnabled, q.dineIn === "true"));
  const where = and(...conds);

  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.venues).where(where);
  const items = await db
    .select({
      slug: schema.venues.slug, name: schema.venues.name, category: schema.venues.category, cuisines: schema.venues.cuisines,
      neighbourhood: schema.venues.neighbourhood, imageUrl: schema.venues.imageUrl, dineInEnabled: schema.venues.dineInEnabled,
    })
    .from(schema.venues)
    .where(where)
    .orderBy(q.sort === "newest" ? desc(schema.venues.createdAt) : asc(schema.venues.name), asc(schema.venues.id))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);
  return { items, page: q.page, pageSize: q.pageSize, total: count?.n ?? 0 };
}

export async function getVenue(slug: string) {
  const [venue] = await db.select().from(schema.venues).where(and(eq(schema.venues.slug, slug), eq(schema.venues.status, "approved"))).limit(1);
  if (!venue) throw notFound("Venue not found");
  const [branches, offers, categories, items, events] = await Promise.all([
    db.select().from(schema.branches).where(eq(schema.branches.venueId, venue.id)),
    db.select().from(schema.offers).where(and(eq(schema.offers.venueId, venue.id), eq(schema.offers.active, true))),
    db.select().from(schema.menuCategories).where(eq(schema.menuCategories.venueId, venue.id)).orderBy(asc(schema.menuCategories.sortOrder)),
    db.select().from(schema.menuItems).where(eq(schema.menuItems.venueId, venue.id)).orderBy(asc(schema.menuItems.name)),
    db.select({ slug: schema.events.slug, title: schema.events.title, startsAt: schema.events.startsAt }).from(schema.events)
      .where(and(eq(schema.events.venueId, venue.id), eq(schema.events.status, "approved"), sql`${schema.events.startsAt} > now()`)).orderBy(asc(schema.events.startsAt)),
  ]);
  // ownerUserId is internal and intentionally not exposed.
  const { ownerUserId: _owner, ...publicVenue } = venue;
  void _owner;
  return { venue: publicVenue, branches, offers, menu: { categories, items }, events };
}

export async function listEvents(raw: unknown) {
  const q = z.object({ city: z.string().default("bengaluru"), page: z.coerce.number().int().min(1).max(1000).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(12) }).parse(raw);
  const [city] = await db.select().from(schema.cities).where(eq(schema.cities.slug, q.city)).limit(1);
  if (!city) return { items: [], page: q.page, pageSize: q.pageSize, total: 0 };
  const where = and(eq(schema.events.cityId, city.id), eq(schema.events.status, "approved"), sql`${schema.events.startsAt} > now()`);
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.events).where(where);
  const items = await db
    .select({
      slug: schema.events.slug, title: schema.events.title, startsAt: schema.events.startsAt, venueName: schema.venues.name, venueSlug: schema.venues.slug,
      minPricePaise: sql<number | null>`(select min(tt.price_paise) from ticket_types tt where tt.event_id = ${schema.events.id})`,
    })
    .from(schema.events).innerJoin(schema.venues, eq(schema.venues.id, schema.events.venueId))
    .where(where).orderBy(asc(schema.events.startsAt), asc(schema.events.id)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
  return { items, page: q.page, pageSize: q.pageSize, total: count?.n ?? 0 };
}

export async function getEvent(slug: string) {
  const [row] = await db
    .select({ event: schema.events, venueName: schema.venues.name, venueSlug: schema.venues.slug })
    .from(schema.events).innerJoin(schema.venues, eq(schema.venues.id, schema.events.venueId))
    .where(and(eq(schema.events.slug, slug), eq(schema.events.status, "approved"))).limit(1);
  if (!row) throw notFound("Event not found");
  const types = await db.select().from(schema.ticketTypes).where(eq(schema.ticketTypes.eventId, row.event.id)).orderBy(asc(schema.ticketTypes.pricePaise));
  const { hostUserId: _h, ...event } = row.event;
  void _h;
  return {
    event, venue: { name: row.venueName, slug: row.venueSlug },
    // Remaining count is derived server-side; raw sold/capacity internals are not exposed.
    ticketTypes: types.map((t) => ({ id: t.id, name: t.name, pricePaise: t.pricePaise, remaining: Math.max(0, t.capacity - t.sold) })),
  };
}

/** Real counts and filters for the home page. Nothing here is hard-coded marketing copy. */
export async function homeSummary() {
  const [city] = await db.select().from(schema.cities).where(and(eq(schema.cities.slug, "bengaluru"), eq(schema.cities.active, true))).limit(1);
  if (!city) return { venues: 0, events: 0, talents: 0, neighbourhoods: [] as string[] };
  const [v] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.venues).where(and(eq(schema.venues.cityId, city.id), eq(schema.venues.status, "approved")));
  const [e] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.events).where(and(eq(schema.events.cityId, city.id), eq(schema.events.status, "approved"), sql`${schema.events.startsAt} > now()`));
  const [t] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.talentProfiles).where(eq(schema.talentProfiles.status, "approved"));
  const hoods = await db.select({ n: schema.venues.neighbourhood, c: sql<number>`count(*)::int` }).from(schema.venues)
    .where(and(eq(schema.venues.cityId, city.id), eq(schema.venues.status, "approved"))).groupBy(schema.venues.neighbourhood).orderBy(desc(sql`count(*)`), asc(schema.venues.neighbourhood)).limit(6);
  return { venues: v?.n ?? 0, events: e?.n ?? 0, talents: t?.n ?? 0, neighbourhoods: hoods.map((h) => h.n).filter(Boolean) as string[] };
}
