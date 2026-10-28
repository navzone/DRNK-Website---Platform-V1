import { and, eq, sql } from "drizzle-orm";
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

/** `withUsers: false` seeds public demo content only (venues, events, talent) and creates no accounts. Use it anywhere real SMS is on. */
type DemoItem = { name: string; description: string; rupees: number; alcohol?: boolean; unavailable?: boolean };
type DemoCategory = { name: string; items: DemoItem[] };

const DEMO_MENUS: Record<string, DemoCategory[]> = {
  "demo-taproom": [
    { name: "Bites", items: [
      { name: "Peri-peri fries", description: "Skin-on fries tossed in peri-peri salt, with garlic mayo.", rupees: 299 },
      { name: "Paneer tikka", description: "Charred cottage cheese, mint chutney, onion salad.", rupees: 380 },
      { name: "Crispy corn", description: "Fried sweet corn with pepper and spring onion.", rupees: 260 },
      { name: "Loaded nachos", description: "Corn chips, cheese sauce, salsa, jalapeño, sour cream.", rupees: 340 },
      { name: "Crispy chicken wings", description: "Six wings in a smoky barbecue glaze.", rupees: 440 },
      { name: "Sold-out special", description: "Chef's special. Back soon.", rupees: 450, unavailable: true },
    ] },
    { name: "Pizza and mains", items: [
      { name: "Margherita pizza", description: "Wood-fired base, tomato, mozzarella, basil.", rupees: 460 },
      { name: "Smoked chicken pizza", description: "Smoked chicken, caramelised onion, mozzarella.", rupees: 560 },
      { name: "Mushroom risotto", description: "Arborio rice, wild mushrooms, parmesan.", rupees: 480 },
      { name: "Grilled chicken steak", description: "Herb-marinated chicken, mash, seasonal vegetables.", rupees: 620 },
    ] },
    { name: "Desserts", items: [
      { name: "Chocolate brownie", description: "Warm brownie with vanilla ice cream.", rupees: 280 },
      { name: "Baked cheesecake", description: "New York style with berry compote.", rupees: 320 },
    ] },
    { name: "Soft drinks", items: [
      { name: "Fresh lime soda", description: "Sweet, salted or mixed.", rupees: 120 },
      { name: "Cold coffee", description: "Blended with ice cream.", rupees: 180 },
      { name: "Virgin mojito", description: "Mint, lime and soda.", rupees: 220 },
    ] },
    { name: "Craft beers", items: [
      { name: "Wheat ale pint", description: "Light, citrusy house wheat ale.", rupees: 380, alcohol: true },
      { name: "Pale ale pint", description: "Hoppy house pale ale.", rupees: 400, alcohol: true },
      { name: "Stout pint", description: "Roasty, chocolatey house stout.", rupees: 420, alcohol: true },
    ] },
  ],
  "demo-kitchen": [
    { name: "Starters", items: [
      { name: "Hara bhara kebab", description: "Spinach and green pea patties, mint chutney.", rupees: 320 },
      { name: "Chicken seekh kebab", description: "Minced chicken skewers from the tandoor.", rupees: 380 },
      { name: "Paneer malai tikka", description: "Creamy marinated paneer, charred.", rupees: 400 },
    ] },
    { name: "Mains", items: [
      { name: "Butter chicken", description: "Tandoori chicken in a tomato-butter gravy.", rupees: 460 },
      { name: "Dal makhani", description: "Black lentils simmered overnight with cream.", rupees: 340 },
      { name: "Paneer butter masala", description: "Cottage cheese in a rich tomato gravy.", rupees: 400 },
      { name: "Lamb rogan josh", description: "Slow-cooked lamb, Kashmiri chilli, whole spices.", rupees: 560 },
      { name: "Vegetable biryani", description: "Basmati dum biryani with raita.", rupees: 360 },
      { name: "Chicken biryani", description: "Basmati dum biryani with raita.", rupees: 420 },
    ] },
    { name: "Breads", items: [
      { name: "Butter naan", description: "Soft tandoori bread brushed with butter.", rupees: 80 },
      { name: "Garlic naan", description: "Tandoori bread with garlic and coriander.", rupees: 100 },
      { name: "Tandoori roti", description: "Whole-wheat bread from the tandoor.", rupees: 50 },
    ] },
    { name: "Desserts", items: [
      { name: "Gulab jamun", description: "Two warm milk dumplings in cardamom syrup.", rupees: 160 },
      { name: "Kulfi falooda", description: "Pistachio kulfi, vermicelli, rose syrup.", rupees: 200 },
    ] },
    { name: "Soft drinks", items: [
      { name: "Sweet lassi", description: "Chilled yoghurt drink.", rupees: 140 },
      { name: "Masala chai", description: "Spiced milk tea.", rupees: 90 },
      { name: "Fresh lime soda", description: "Sweet, salted or mixed.", rupees: 120 },
    ] },
    { name: "Wine", items: [
      { name: "Red wine glass", description: "House red, 150 ml.", rupees: 480, alcohol: true },
    ] },
  ],
  "demo-pub": [
    { name: "Bar bites", items: [
      { name: "Masala peanuts", description: "Roasted peanuts, onion, tomato, chaat masala.", rupees: 140 },
      { name: "Chilli cheese toast", description: "Grilled bread, green chilli, melted cheese.", rupees: 240 },
      { name: "Chicken lollipop", description: "Six pieces, schezwan glaze.", rupees: 360 },
      { name: "Fish fingers", description: "Crumb-fried fish, tartare sauce.", rupees: 420 },
      { name: "Veg spring rolls", description: "Crisp rolls with sweet chilli dip.", rupees: 260 },
      { name: "Loaded fries", description: "Fries, cheese sauce, jalapeño, spring onion.", rupees: 300 },
    ] },
    { name: "Burgers", items: [
      { name: "Classic burger", description: "Veg patty, cheddar, lettuce, house sauce.", rupees: 340 },
      { name: "Chicken burger", description: "Crispy chicken, slaw, pickles, mayo.", rupees: 380 },
    ] },
    { name: "Soft drinks", items: [
      { name: "Iced tea", description: "Lemon or peach.", rupees: 150 },
      { name: "Cola", description: "300 ml.", rupees: 90 },
    ] },
    { name: "Bar", items: [
      { name: "Draught beer pint", description: "Lager on tap.", rupees: 350, alcohol: true },
      { name: "Whisky 60 ml", description: "House blended whisky.", rupees: 450, alcohol: true },
      { name: "Gin and tonic", description: "Gin, tonic, lime.", rupees: 420, alcohol: true },
    ] },
  ],
};

/** Adds any missing categories and items by name. Never deletes or edits what is already there. */
async function ensureMenu(db: Db, venueId: string, menu: DemoCategory[]) {
  const cats = await db.select().from(s.menuCategories).where(eq(s.menuCategories.venueId, venueId));
  const items = await db.select().from(s.menuItems).where(eq(s.menuItems.venueId, venueId));
  for (const [i, c] of menu.entries()) {
    let cat = cats.find((x) => x.name === c.name);
    if (!cat) {
      const [row] = await db.insert(s.menuCategories).values({ venueId, name: c.name, sortOrder: i }).returning();
      cat = row;
      if (cat) cats.push(cat);
    }
    for (const it of c.items) {
      const existing = items.find((x) => x.name === it.name);
      if (!existing) {
        await db.insert(s.menuItems).values({
          venueId, categoryId: cat?.id, name: it.name, description: it.description, pricePaise: it.rupees * 100,
          containsAlcohol: !!it.alcohol, available: !it.unavailable,
        });
      } else if (!existing.categoryId && cat) {
        await db.update(s.menuItems).set({ categoryId: cat.id }).where(and(eq(s.menuItems.id, existing.id), eq(s.menuItems.venueId, venueId)));
      }
    }
  }
}

/**
 * withUsers: true creates all four fixture accounts (development and test only).
 * "demo-login" creates only the two demo customers and the demo merchant, for the staging demo login. Never the admin.
 */
export async function seedDemo(db: Db, opts: { withUsers?: boolean | "demo-login" } = {}) {
  const withUsers = opts.withUsers ?? true;
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
  // "demo-login" never creates the admin: that account must not be reachable through the staging demo login.
  if (withUsers) for (const u of userRows) if (withUsers !== "demo-login" || u.role !== "admin") await db.insert(s.users).values(u).onConflictDoNothing();
  const [merchant] = withUsers ? await db.select().from(s.users).where(eq(s.users.phoneE164, DEMO_PHONES.merchant)) : [];

  const venueDefs = [
    { slug: "demo-taproom", name: "Demo Taproom [Demo]", category: "microbrewery" as const, cuisines: ["Continental", "Bar bites"], neighbourhood: "Indiranagar", dineIn: true },
    { slug: "demo-kitchen", name: "Demo Kitchen [Demo]", category: "restaurant" as const, cuisines: ["North Indian"], neighbourhood: "Koramangala", dineIn: true },
    { slug: "demo-pub", name: "Demo Pub [Demo]", category: "pub" as const, cuisines: ["Bar bites", "Burgers"], neighbourhood: "HSR Layout", dineIn: true },
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
      .onConflictDoUpdate({ target: s.venues.slug, set: { name: v.name, cuisines: v.cuisines, dineInEnabled: v.dineIn, tableSessionsEnabled: v.dineIn, ...(merchant ? { ownerUserId: merchant.id } : {}) } })
      .returning();
    if (row) venues[v.slug] = row;
  }

  // Fictional menus for the three demo venues. Dishes and prices are invented demo content, not any real venue's menu.
  // Alcohol items are listed but the platform refuses to take them in online orders (policy decision still open).
  for (const [slug, menu] of Object.entries(DEMO_MENUS)) {
    const venue = venues[slug];
    if (venue) await ensureMenu(db, venue.id, menu);
  }

  const taproom = venues["demo-taproom"];
  if (taproom) {
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
      // Re-seeding must not leave the demo event in the past (public pages only list upcoming events).
      .onConflictDoUpdate({
        target: s.events.slug,
        set: { startsAt: sql`case when ${s.events.startsAt} < now() then excluded.starts_at else ${s.events.startsAt} end` },
      })
      .returning();
    const hasTickets = event ? (await db.select({ id: s.ticketTypes.id }).from(s.ticketTypes).where(eq(s.ticketTypes.eventId, event.id)).limit(1)).length > 0 : true;
    if (event && !hasTickets) {
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
