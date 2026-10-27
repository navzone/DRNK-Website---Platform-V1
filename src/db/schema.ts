import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// All money columns are integer paise. No floats anywhere.

export const roleEnum = pgEnum("role", ["customer", "merchant", "host", "talent", "admin"]);
export const approvalEnum = pgEnum("approval_status", ["pending", "approved", "rejected", "suspended"]);
export const venueCategoryEnum = pgEnum("venue_category", ["restaurant", "pub", "microbrewery", "lounge", "cafe"]);
export const reservationStatusEnum = pgEnum("reservation_status", ["requested", "confirmed", "cancelled", "completed", "no_show"]);
export const orderStatusEnum = pgEnum("order_status", ["placed", "accepted", "served", "cancelled"]);
export const bookingStatusEnum = pgEnum("booking_status", ["pending_payment", "confirmed", "cancelled", "expired"]);
export const paymentStatusEnum = pgEnum("payment_status", ["created", "pending", "paid", "failed", "refunded"]);
export const talentKindEnum = pgEnum("talent_kind", ["dj", "kj", "band", "other"]);
export const enquiryStatusEnum = pgEnum("enquiry_status", ["new", "accepted", "declined", "closed"]);
export const ledgerKindEnum = pgEnum("ledger_kind", ["earn", "redeem", "reversal", "adjustment"]);
export const requestStatusEnum = pgEnum("request_status", ["open", "in_progress", "resolved", "rejected"]);

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------- Identity ----------
export const users = pgTable("users", {
  id: id(),
  phoneE164: text("phone_e164").notNull().unique(),
  role: roleEnum("role").notNull().default("customer"),
  displayName: text("display_name"),
  email: text("email"),
  createdAt: createdAt(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: id(),
    phoneE164: text("phone_e164").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("otp_phone_created_idx").on(t.phoneE164, t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    id: id(),
    key: text("key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("rate_limit_key_idx").on(t.key, t.createdAt)],
);

// ---------- Discovery ----------
export const cities = pgTable("cities", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
});

export const venues = pgTable(
  "venues",
  {
    id: id(),
    cityId: uuid("city_id").notNull().references(() => cities.id),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: venueCategoryEnum("category").notNull(),
    cuisines: text("cuisines").array().notNull().default(sql`'{}'::text[]`),
    neighbourhood: text("neighbourhood").notNull(),
    address: text("address").notNull(),
    description: text("description"),
    amenities: text("amenities").array().notNull().default(sql`'{}'::text[]`),
    hours: jsonb("hours"),
    imageUrl: text("image_url"),
    dineInEnabled: boolean("dine_in_enabled").notNull().default(false),
    tableSessionsEnabled: boolean("table_sessions_enabled").notNull().default(false),
    status: approvalEnum("status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [index("venues_city_status_idx").on(t.cityId, t.status), index("venues_owner_idx").on(t.ownerUserId)],
);

export const branches = pgTable("branches", {
  id: id(),
  venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address").notNull(),
  neighbourhood: text("neighbourhood").notNull(),
});

export const offers = pgTable("offers", {
  id: id(),
  venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
});

export const menuCategories = pgTable("menu_categories", {
  id: id(),
  venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const menuItems = pgTable(
  "menu_items",
  {
    id: id(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => menuCategories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    pricePaise: integer("price_paise").notNull(),
    available: boolean("available").notNull().default(true),
    containsAlcohol: boolean("contains_alcohol").notNull().default(false),
  },
  (t) => [check("menu_price_nonneg", sql`${t.pricePaise} >= 0`), index("menu_items_venue_idx").on(t.venueId)],
);

// ---------- Dine-in ----------
export const reservations = pgTable(
  "reservations",
  {
    id: id(),
    ref: text("ref").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id),
    venueId: uuid("venue_id").notNull().references(() => venues.id),
    partySize: integer("party_size").notNull(),
    slotAt: timestamp("slot_at", { withTimezone: true }).notNull(),
    status: reservationStatusEnum("status").notNull().default("requested"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    check("reservation_party_size", sql`${t.partySize} between 1 and 50`),
    index("reservations_user_idx").on(t.userId),
    index("reservations_venue_slot_idx").on(t.venueId, t.slotAt),
  ],
);

export const tableSessions = pgTable("table_sessions", {
  id: id(),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  tableLabel: text("table_label").notNull(),
  status: text("status").notNull().default("open"),
  openedAt: createdAt(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const orders = pgTable(
  "orders",
  {
    id: id(),
    ref: text("ref").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id),
    venueId: uuid("venue_id").notNull().references(() => venues.id),
    tableSessionId: uuid("table_session_id").references(() => tableSessions.id),
    status: orderStatusEnum("status").notNull().default("placed"),
    totalPaise: integer("total_paise").notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("order_total_nonneg", sql`${t.totalPaise} >= 0`), index("orders_user_idx").on(t.userId)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
    nameSnapshot: text("name_snapshot").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [check("order_item_qty", sql`${t.quantity} between 1 and 50`)],
);

// ---------- Events & tickets ----------
export const events = pgTable(
  "events",
  {
    id: id(),
    cityId: uuid("city_id").notNull().references(() => cities.id),
    venueId: uuid("venue_id").notNull().references(() => venues.id),
    hostUserId: uuid("host_user_id").references(() => users.id),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    status: approvalEnum("status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [index("events_city_start_idx").on(t.cityId, t.startsAt)],
);

export const ticketTypes = pgTable(
  "ticket_types",
  {
    id: id(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    pricePaise: integer("price_paise").notNull(),
    capacity: integer("capacity").notNull(),
    // sold + held are reserved against capacity atomically. DB constraint prevents overselling.
    sold: integer("sold").notNull().default(0),
  },
  (t) => [
    check("ticket_price_nonneg", sql`${t.pricePaise} >= 0`),
    check("ticket_no_oversell", sql`${t.sold} >= 0 and ${t.sold} <= ${t.capacity}`),
  ],
);

export const eventBookings = pgTable(
  "event_bookings",
  {
    id: id(),
    ref: text("ref").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id),
    eventId: uuid("event_id").notNull().references(() => events.id),
    status: bookingStatusEnum("status").notNull().default("pending_payment"),
    totalPaise: integer("total_paise").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("bookings_user_idx").on(t.userId)],
);

export const bookingLines = pgTable(
  "booking_lines",
  {
    id: id(),
    bookingId: uuid("booking_id").notNull().references(() => eventBookings.id, { onDelete: "cascade" }),
    ticketTypeId: uuid("ticket_type_id").notNull().references(() => ticketTypes.id),
    quantity: integer("quantity").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
  },
  (t) => [check("line_qty", sql`${t.quantity} between 1 and 10`), unique("booking_line_unique").on(t.bookingId, t.ticketTypeId)],
);

export const tickets = pgTable(
  "tickets",
  {
    id: id(),
    ref: text("ref").notNull().unique(),
    bookingId: uuid("booking_id").notNull().references(() => eventBookings.id),
    ticketTypeId: uuid("ticket_type_id").notNull().references(() => ticketTypes.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    seq: integer("seq").notNull(),
    createdAt: createdAt(),
  },
  // Duplicate issuance guard: one ticket per (booking, ticket type, seq).
  (t) => [uniqueIndex("tickets_issue_unique").on(t.bookingId, t.ticketTypeId, t.seq)],
);

// ---------- Talent ----------
export const talentProfiles = pgTable("talent_profiles", {
  id: id(),
  userId: uuid("user_id").references(() => users.id),
  stageName: text("stage_name").notNull(),
  slug: text("slug").notNull().unique(),
  kind: talentKindEnum("kind").notNull(),
  genres: text("genres").array().notNull().default(sql`'{}'::text[]`),
  bio: text("bio"),
  availabilityNote: text("availability_note"),
  mediaUrl: text("media_url"),
  status: approvalEnum("status").notNull().default("pending"),
  createdAt: createdAt(),
});

export const talentEnquiries = pgTable(
  "talent_enquiries",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    talentId: uuid("talent_id").notNull().references(() => talentProfiles.id),
    eventDate: timestamp("event_date", { withTimezone: true }),
    message: text("message").notNull(),
    status: enquiryStatusEnum("status").notNull().default("new"),
    response: text("response"),
    createdAt: createdAt(),
  },
  (t) => [index("enquiries_talent_idx").on(t.talentId), index("enquiries_user_idx").on(t.userId)],
);

// ---------- Rewards ----------
// Tier codes exist; thresholds, multipliers and expiry are intentionally NOT defined here.
// They come from reward_rules, populated only from the approved specification.
export const membershipTiers = pgTable("membership_tiers", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  rank: integer("rank").notNull(),
});

export const userMemberships = pgTable("user_memberships", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  tierId: uuid("tier_id").notNull().references(() => membershipTiers.id),
  assignedAt: createdAt(),
});

export const rewardRules = pgTable("reward_rules", {
  id: id(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  active: boolean("active").notNull().default(false),
  description: text("description"),
});

// Immutable ledgers (UPDATE/DELETE blocked by trigger). Corrections are reversal/adjustment rows.
export const pointsLedger = pgTable(
  "points_ledger",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    delta: integer("delta").notNull(),
    kind: ledgerKindEnum("kind").notNull(),
    reason: text("reason").notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    reversesId: uuid("reverses_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index("points_user_idx").on(t.userId)],
);

export const alcometerLedger = pgTable(
  "alcometer_ledger",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    delta: integer("delta").notNull(),
    kind: ledgerKindEnum("kind").notNull(),
    reason: text("reason").notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    reversesId: uuid("reverses_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index("alcometer_user_idx").on(t.userId)],
);

// ---------- Payments ----------
export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: id(),
    ref: text("ref").notNull().unique(),
    bookingId: uuid("booking_id").notNull().references(() => eventBookings.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: paymentStatusEnum("status").notNull().default("created"),
    provider: text("provider").notNull(),
    providerOrderId: text("provider_order_id").unique(),
    providerPaymentId: text("provider_payment_id").unique(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("payment_amount_positive", sql`${t.amountPaise} >= 0`), index("payments_booking_idx").on(t.bookingId)],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique("webhook_event_unique").on(t.provider, t.eventId)],
);

export const refunds = pgTable("refunds", {
  id: id(),
  paymentAttemptId: uuid("payment_attempt_id").notNull().references(() => paymentAttempts.id),
  amountPaise: integer("amount_paise").notNull(),
  status: text("status").notNull().default("requested"),
  providerRefundId: text("provider_refund_id"),
  createdAt: createdAt(),
});

// ---------- Support, privacy, notifications, audit ----------
export const notifications = pgTable("notifications", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const supportTickets = pgTable("support_tickets", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: requestStatusEnum("status").notNull().default("open"),
  createdAt: createdAt(),
});

export const privacyNoticeVersions = pgTable("privacy_notice_versions", {
  id: id(),
  version: text("version").notNull().unique(),
  publishedAt: createdAt(),
});

export const consents = pgTable("consents", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  noticeVersionId: uuid("notice_version_id").notNull().references(() => privacyNoticeVersions.id),
  acceptedAt: createdAt(),
});

export const dataRequests = pgTable("data_requests", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  kind: text("kind").notNull(), // "export" | "delete"
  status: requestStatusEnum("status").notNull().default("open"),
  createdAt: createdAt(),
});

export const merchantApplications = pgTable("merchant_applications", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  businessName: text("business_name").notNull(),
  neighbourhood: text("neighbourhood"),
  details: text("details"),
  status: approvalEnum("status").notNull().default("pending"),
  createdAt: createdAt(),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_actor_idx").on(t.actorUserId), index("audit_created_idx").on(t.createdAt)],
);
