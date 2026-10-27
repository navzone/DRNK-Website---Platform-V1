import { eq } from "drizzle-orm";
import type { Db } from "./client";
import * as s from "./schema";

/**
 * Repeatable DEMO seed. All venue/event/talent names are fictional placeholders (suffix "[Demo]")
 * and must be replaced by verified data before launch. Reward thresholds/multipliers are NOT seeded:
 * they are not defined in an approved specification yet.
 */
export const DEMO_PHONES = {
  admin: "+919000000001",
  customer: "+919000000002",
  customer2: "+919000000003",
  merchant: "+919000000004",
};

export async function seedDemo(db: Db) {
  const [city] = await db
    .insert(s.cities)
    .values({ slug: "bengaluru", name: "Bengaluru" })
    .onConflictDoUpdate({ target: s.cities.slug, set: { name: "Bengaluru" } })
    .returning();
  if (!city) throw new Error("city seed failed");

  for (const [rank, code, name] of [
    [1, "silver", "Silver"],
    [2, "gold", "Gold"],
    [3, "black", "Black"],
  ] as const) {
    await db.insert(s.membershipTiers).values({ code, name, rank }).onConflictDoNothing();
  }
  await db.insert(s.privacyNoticeVersions).values({ version: "draft-0" }).onConflictDoNothing();

  const userRows = [
    { phoneE164: DEMO_PHONES.admin, role: "admin" as const, displayName: "Demo Admin" },
    { phoneE164: DEMO_PHONES.customer, role: "customer" as const, displayName: "Demo Customer" },
    { phoneE164: DEMO_PHONES.customer2, role: "customer" as const, displayName: "Demo Customer Two" },
    { phoneE164: DEMO_PHONES.merchant, role: "merchant" as const, displayName: "Demo Merchant" },
  ];
  for (const u of userRows) await db.insert(s.users).values(u).onConflictDoNothing();
  const [merchant] = await db.select().from(s.users).where(eq(s.users.phoneE164, DEMO_PHONES.merchant));

  const venueDefs = [
    { slug: "demo-taproom", name: "Demo Taproom [Demo]", category: "microbrewery" as const, cuisines: ["Continental", "Bar bites"], neighbourhood: "Indiranagar", dineIn: true },
    { slug: "demo-kitchen", name: "Demo Kitchen [Demo]", category: "restaurant" as const, cuisines: ["North Indian"], neighbourhood: "Koramangala", dineIn: true },
    { slug: "demo-pub", name: "Demo Pub [Demo]", category: "pub" as const, cuisines: ["Bar bites"], neighbourhood: "HSR Layout", dineIn: false },
  ];
  const venues: Record<string, typeof s.venues.$inferSelect> = {};
  for (const v of venueDefs) {
    const [row] = await db
      .insert(s.venues)
      .values({
        cityId: city.id,
        ownerUserId: merchant?.id,
        slug: v.slug,
        name: v.name,
        category: v.category,
        cuisines: v.cuisines,
        neighbourhood: v.neighbourhood,
        address: "Placeholder address — replace with verified data",
        description: "Demo venue for development. Not a real listing.",
        amenities: ["Live music area", "Air conditioning"],
        dineInEnabled: v.dineIn,
        tableSessionsEnabled: v.dineIn,
        status: "approved",
      })
      .onConflictDoUpdate({ target: s.venues.slug, set: { name: v.name } })
      .returning();
    if (row) venues[v.slug] = row;
  }

  const taproom = venues["demo-taproom"];
  if (taproom) {
    const existing = await db.select().from(s.menuItems).where(eq(s.menuItems.venueId, taproom.id));
    if (existing.length === 0) {
      const [cat] = await db.insert(s.menuCategories).values({ venueId: taproom.id, name: "Bites" }).returning();
      await db.insert(s.menuItems).values([
        { venueId: taproom.id, categoryId: cat?.id, name: "Peri-peri fries", pricePaise: 29900 },
        { venueId: taproom.id, categoryId: cat?.id, name: "Paneer tikka", pricePaise: 38000 },
        { venueId: taproom.id, categoryId: cat?.id, name: "Sold-out special", pricePaise: 45000, available: false },
      ]);
    }
    const [event] = await db
      .insert(s.events)
      .values({
        cityId: city.id,
        venueId: taproom.id,
        slug: "demo-friday-night",
        title: "Demo Friday Night [Demo]",
        description: "Demo event for development.",
        startsAt: new Date(Date.now() + 14 * 86400_000),
        status: "approved",
      })
      .onConflictDoNothing()
      .returning();
    if (event) {
      await db.insert(s.ticketTypes).values([
        { eventId: event.id, name: "General", pricePaise: 49900, capacity: 100 },
        { eventId: event.id, name: "Limited", pricePaise: 99900, capacity: 5 },
      ]);
    }
  }

  await db
    .insert(s.talentProfiles)
    .values([
      { stageName: "DJ Demo [Demo]", slug: "dj-demo", kind: "dj", genres: ["House", "Techno"], bio: "Demo profile.", status: "approved" },
      { stageName: "Demo Band [Demo]", slug: "demo-band", kind: "band", genres: ["Rock"], bio: "Demo profile.", status: "approved" },
    ])
    .onConflictDoNothing();
}
