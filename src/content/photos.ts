/**
 * Photo library ported from the AI Studio prototype (`curatedImages.ts`, `talentSeedData.ts`).
 *
 * These are Unsplash stock photos that stand in for real venue, event and artist photography
 * until approved images exist. A photo set on a record (`venues.imageUrl`) always wins.
 * Stock photos show the mood of a place, not the real place: replace them with approved
 * photography for every real venue before launch (see docs/DESIGN_PORT.md).
 */

import { localPhotoPath } from "./photo-url";

/** Path of a bundled photo (downloaded at build time into /public/photos). */
export function photo(id: string, w = 1200): string {
  return localPhotoPath(id, w);
}

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick<T>(pool: readonly T[], key: string): T {
  return pool[hash(key) % pool.length] as T;
}

type Set3 = readonly [string, string, string];

// ---------- Venues ----------
const VENUE_SETS = {
  taproom: ["1555396273-367ea4eb4db5", "1608270195610-8631c360c733", "1513104890138-7c749659a591"],
  openAirBrewery: ["1578474846511-04ba529f0b88", "1543007630-9710e4a00a20", "1504674900247-0877df9cc836"],
  heritageBrewery: ["1575037614876-c38a4d44f5b8", "1566633806327-68e152aaf26d", "1568901346375-23c9450c58cd"],
  gardenTaproom: ["1538488881523-2989c1833026", "1566633806327-68e152aaf26d", "1513104890138-7c749659a591"],
  diningRoom: ["1527061011665-3652c757a4d4", "1563227812-0ea4c22e6cc8", "1544025162-d76694265947"],
  zenDining: ["1517248135467-4c7edcad34c4", "1536935338788-846bb9981813", "1579871494447-9811cf80d66c"],
  villaDining: ["1517248135467-4c7edcad34c4", "1510812431401-41d2bd2722f3", "1551183053-bf91a1d81141"],
  modernBistro: ["1550966871-3ed3cdb5ed0c", "1551024709-8f23befc6f87", "1589302168068-964664d93dc0"],
  neighbourhoodPub: ["1543007630-9710e4a00a20", "1608270195610-8631c360c733", "1589302168068-964664d93dc0"],
  nightlifePub: ["1514525253161-7a46d19cd819", "1536935338788-846bb9981813", "1568901346375-23c9450c58cd"],
  rooftopLounge: ["1517457373958-b7bdd4587205", "1510812431401-41d2bd2722f3", "1507525428034-b723cf961d3e"],
  cocktailLounge: ["1514362545857-3bc16c4c7d1b", "1551024709-8f23befc6f87", "1572116469696-31de0f17cc34"],
  cityRooftop: ["1519671482749-fd09be7ccebf", "1556881286-fc6915169721", "1555396273-367ea4eb4db5"],
  skyLounge: ["1570872626485-d8ffea69f463", "1514362545857-3bc16c4c7d1b", "1579871494447-9811cf80d66c"],
  vinylCafe: ["1461360370896-922624d12aa1", "1506377247377-2a5b3b417ebb", "1631452180519-c014fe946bc7"],
  terraceCafe: ["1546768292-fb12f6c92568", "1536935338788-846bb9981813", "1541544741938-0af808871cc0"],
} satisfies Record<string, Set3>;

type VenueSetName = keyof typeof VENUE_SETS;

const BY_CATEGORY: Record<string, readonly VenueSetName[]> = {
  microbrewery: ["taproom", "openAirBrewery", "heritageBrewery", "gardenTaproom"],
  restaurant: ["diningRoom", "zenDining", "villaDining", "modernBistro"],
  pub: ["neighbourhoodPub", "nightlifePub", "heritageBrewery"],
  lounge: ["rooftopLounge", "cocktailLounge", "cityRooftop", "skyLounge"],
  cafe: ["modernBistro", "vinylCafe", "terraceCafe"],
};

/** Hand-picked sets for the seeded demo venues (the same sets the prototype used for its first three). */
const BY_VENUE_SLUG: Record<string, VenueSetName> = {
  "demo-taproom": "taproom",
  "demo-kitchen": "diningRoom",
  "demo-pub": "neighbourhoodPub",
};

export type PhotoSize = "card" | "hero";
const px = (s: PhotoSize) => (s === "card" ? 640 : 1200);

/** Gallery for a venue: its own photo first (if set), then curated stock for its category. */
export function venueGallery(v: { slug: string; category: string; imageUrl?: string | null }, size: PhotoSize = "hero"): string[] {
  const name = BY_VENUE_SLUG[v.slug] ?? pick(BY_CATEGORY[v.category] ?? BY_CATEGORY.lounge!, v.slug);
  const stock = VENUE_SETS[name].map((id) => photo(id, px(size)));
  return v.imageUrl ? [v.imageUrl, ...stock] : stock;
}

// ---------- Events ----------
const EVENT_SETS: readonly Set3[] = [
  ["1516450360452-9312f5e86fc7", "1517457373958-b7bdd4587205", "1514525253161-7a46d19cd819"], // DJ night
  ["1511192336575-5a79af67a629", "1527061011665-3652c757a4d4", "1514525253161-7a46d19cd819"], // jazz and whisky
  ["1585699324551-f6c309eedeca", "1514525253161-7a46d19cd819", "1543007630-9710e4a00a20"], // stand-up
  ["1506377247377-2a5b3b417ebb", "1631452180519-c014fe946bc7", "1461360370896-922624d12aa1"], // wine and cheese
];

const BY_EVENT_SLUG: Record<string, number> = { "demo-friday-night": 0 };

export function eventGallery(e: { slug: string }, size: PhotoSize = "hero"): string[] {
  const set = EVENT_SETS[BY_EVENT_SLUG[e.slug] ?? hash(e.slug) % EVENT_SETS.length] as Set3;
  return set.map((id) => photo(id, px(size)));
}

// ---------- Talent ----------
type TalentPhotos = { profile: string; cover: string };
const TALENT: Record<string, readonly TalentPhotos[]> = {
  dj: [
    { profile: "1571266028243-3716f02d2d2e", cover: "1516450360452-9312f5e86fc7" },
    { profile: "1534528741775-53994a69daeb", cover: "1492684223066-81342ee5ff30" },
  ],
  band: [
    { profile: "1511671782779-c97d3d27a1d4", cover: "1465847899084-d164df4dedc6" },
    { profile: "1520523839898-50712825e3a7", cover: "1514525253161-7a46d19cd819" },
  ],
  kj: [{ profile: "1508700115892-45ecd05ae2ad", cover: "1516450360452-9312f5e86fc7" }],
  other: [
    { profile: "1525201548942-d8732f6617a0", cover: "1510915361894-db8b60106cb1" },
    { profile: "1525994886773-080587e161c2", cover: "1514525253161-7a46d19cd819" },
  ],
};

const BY_TALENT_SLUG: Record<string, TalentPhotos> = {
  "dj-demo": TALENT.dj![0]!,
  "demo-band": TALENT.band![0]!,
};

export function talentPhotos(t: { slug: string; kind: string }): { profile: string; cover: string } {
  const p = BY_TALENT_SLUG[t.slug] ?? pick(TALENT[t.kind] ?? TALENT.other!, t.slug);
  return { profile: photo(p.profile, 640), cover: photo(p.cover, 1200) };
}

/** Wide background for the home hero. */
const HERO_ID = "1517457373958-b7bdd4587205";
export const HERO_PHOTO = photo(HERO_ID, 1600);

// ---------- Menu ----------
const MENU_PHOTO_RULES: ReadonlyArray<[RegExp, string]> = [
  [/lassi|chai|coffee|soda|iced tea|\bcola\b|soft drink/i, "1563227812-0ea4c22e6cc8"],
  [/pizza|risotto|pasta|naan|roti|bread|toast/i, "1513104890138-7c749659a591"],
  [/burger/i, "1568901346375-23c9450c58cd"],
  [/steak|grill|lamb|chicken steak/i, "1544025162-d76694265947"],
  [/biryani|butter chicken|masala|dal |rogan|curry|kebab|tikka|seekh|lollipop|corn|peanut|spring roll|fish/i, "1589302168068-964664d93dc0"],
  [/fries|nacho|wings|bites|starters|bar bites|platter/i, "1504674900247-0877df9cc836"],
  [/brownie|cheesecake|dessert|jamun|kulfi|falooda/i, "1551183053-bf91a1d81141"],
  [/wine/i, "1506377247377-2a5b3b417ebb"],
  [/whisky|gin|cocktail|mojito|fizz|^bar$/i, "1551024709-8f23befc6f87"],
  [/beer|ale|stout|lager|pint|craft/i, "1608270195610-8631c360c733"],
  [/drink|tea/i, "1563227812-0ea4c22e6cc8"],
];

const DEFAULT_MENU_PHOTO = "1504674900247-0877df9cc836";

/** Thumbnail for a menu item: matched on its name first, then its category. Mood stock photo, not the actual dish. */
export function menuPhoto(categoryName: string | null | undefined, itemName: string): string {
  const hit = MENU_PHOTO_RULES.find(([re]) => re.test(itemName)) ?? MENU_PHOTO_RULES.find(([re]) => re.test(categoryName ?? ""));
  return photo(hit ? hit[1] : DEFAULT_MENU_PHOTO, 240);
}


// ---------- Build-time download list ----------
const SET_IDS = (sets: readonly (readonly string[])[]) => sets.flatMap((x) => [...x]);

/** Every file the site expects under /public/photos: { id, w }. Used by scripts/fetch-photos.ts. */
export function allPhotoFiles(): { id: string; w: number }[] {
  const gallery = new Set<string>([
    ...SET_IDS(Object.values(VENUE_SETS)),
    ...SET_IDS(EVENT_SETS),
    ...Object.values(TALENT).flat().flatMap((t) => [t.profile, t.cover]),
  ]);
  const menu = new Set<string>([...MENU_PHOTO_RULES.map(([, id]) => id), DEFAULT_MENU_PHOTO]);
  const files: { id: string; w: number }[] = [];
  for (const id of gallery) files.push({ id, w: 640 }, { id, w: 1200 });
  for (const id of menu) files.push({ id, w: 240 });
  files.push({ id: HERO_ID, w: 1600 });
  const seen = new Set<string>();
  return files.filter((f) => { const k = `${f.id}-${f.w}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
