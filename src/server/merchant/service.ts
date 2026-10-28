import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { randomToken } from "@/lib/crypto";
import { audit } from "@/server/audit";

type User = typeof schema.users.$inferSelect;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "venue";
const suffix = () => randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, "x").slice(0, 5);

export async function applyAsMerchant(userId: string, i: { businessName: string; neighbourhood?: string; details?: string }) {
  const existing = await db.select().from(schema.merchantApplications).where(and(eq(schema.merchantApplications.userId, userId), eq(schema.merchantApplications.status, "pending"))).limit(1);
  if (existing.length) throw conflict("You already have a pending application", "duplicate_application");
  const [a] = await db.insert(schema.merchantApplications).values({ userId, ...i }).returning();
  return a!;
}

async function ownedVenue(actor: User, slug: string) {
  const [v] = await db.select().from(schema.venues).where(eq(schema.venues.slug, slug)).limit(1);
  // Non-owners get the same answer as for a missing venue.
  if (!v || (actor.role !== "admin" && v.ownerUserId !== actor.id)) throw notFound("Venue not found");
  return v;
}

/** New venues always start as "pending"; only an admin approval makes them public. */
export async function createVenue(actor: User, i: { name: string; category: typeof schema.venues.$inferInsert["category"]; cuisines: string[]; neighbourhood: string; address: string; description?: string; amenities?: string[]; dineInEnabled?: boolean }) {
  const [city] = await db.select().from(schema.cities).where(eq(schema.cities.slug, "bengaluru")).limit(1);
  if (!city) throw badRequest("City not available");
  const [v] = await db.insert(schema.venues).values({
    cityId: city.id, ownerUserId: actor.id, slug: `${slugify(i.name)}-${suffix()}`, name: i.name, category: i.category, cuisines: i.cuisines,
    neighbourhood: i.neighbourhood, address: i.address, description: i.description, amenities: i.amenities ?? [], dineInEnabled: i.dineInEnabled ?? false, status: "pending",
  }).returning();
  await audit(db, { actorUserId: actor.id, action: "venue.create", entityType: "venue", entityId: v!.id });
  return v!;
}

export async function createEvent(actor: User, i: { venueSlug: string; title: string; description?: string; startsAt: Date; ticketTypes: { name: string; pricePaise: number; capacity: number }[] }) {
  const venue = await ownedVenue(actor, i.venueSlug);
  if (venue.status !== "approved") throw conflict("The venue must be approved before it can host events", "venue_not_approved");
  if (i.startsAt.getTime() <= Date.now()) throw badRequest("Event start must be in the future");
  return db.transaction(async (tx) => {
    const [e] = await tx.insert(schema.events).values({
      cityId: venue.cityId, venueId: venue.id, hostUserId: actor.id, slug: `${slugify(i.title)}-${suffix()}`, title: i.title, description: i.description, startsAt: i.startsAt, status: "pending",
    }).returning();
    await tx.insert(schema.ticketTypes).values(i.ticketTypes.map((t) => ({ eventId: e!.id, ...t })));
    await audit(tx, { actorUserId: actor.id, action: "event.create", entityType: "event", entityId: e!.id });
    return e!;
  });
}

export async function createMenuItem(actor: User, venueSlug: string, i: { name: string; description?: string; pricePaise: number; containsAlcohol?: boolean; category?: string }) {
  const venue = await ownedVenue(actor, venueSlug);
  let categoryId: string | undefined;
  if (i.category) {
    const cats = await db.select().from(schema.menuCategories).where(eq(schema.menuCategories.venueId, venue.id));
    const found = cats.find((c) => c.name.toLowerCase() === i.category!.toLowerCase());
    categoryId = found?.id ?? (await db.insert(schema.menuCategories).values({ venueId: venue.id, name: i.category, sortOrder: cats.length }).returning())[0]?.id;
  }
  const [m] = await db.insert(schema.menuItems).values({ venueId: venue.id, categoryId, name: i.name, description: i.description, pricePaise: i.pricePaise, containsAlcohol: i.containsAlcohol ?? false }).returning();
  return m!;
}

/** Full menu of a venue the actor manages, including unavailable items. */
export async function listOwnMenu(actor: User, venueSlug: string) {
  const venue = await ownedVenue(actor, venueSlug);
  const [categories, items] = await Promise.all([
    db.select().from(schema.menuCategories).where(eq(schema.menuCategories.venueId, venue.id)).orderBy(asc(schema.menuCategories.sortOrder)),
    db.select().from(schema.menuItems).where(eq(schema.menuItems.venueId, venue.id)).orderBy(asc(schema.menuItems.name)),
  ]);
  return { venue: { slug: venue.slug, name: venue.name }, categories, items };
}

export async function setMenuItemAvailability(actor: User, itemId: string, available: boolean) {
  const [row] = await db.select({ m: schema.menuItems, ownerUserId: schema.venues.ownerUserId }).from(schema.menuItems).innerJoin(schema.venues, eq(schema.venues.id, schema.menuItems.venueId)).where(eq(schema.menuItems.id, itemId)).limit(1);
  if (!row || (actor.role !== "admin" && row.ownerUserId !== actor.id)) throw notFound("Menu item not found");
  await db.update(schema.menuItems).set({ available }).where(eq(schema.menuItems.id, itemId));
  return { id: itemId, available };
}

export async function listOwnVenues(actor: User) {
  return db.select().from(schema.venues).where(actor.role === "admin" ? undefined : eq(schema.venues.ownerUserId, actor.id));
}
