import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { randomRef } from "@/lib/crypto";
import { audit } from "@/server/audit";
import { canTransitionOrder, canTransitionReservation, orderTotalPaise, type OrderStatus, type ReservationStatus } from "./state";

type User = typeof schema.users.$inferSelect;

async function approvedVenue(slug: string) {
  const [v] = await db.select().from(schema.venues).where(and(eq(schema.venues.slug, slug), eq(schema.venues.status, "approved"))).limit(1);
  if (!v) throw notFound("Venue not found");
  return v;
}

/** Admins may act on any venue; merchants only on venues they own. */
function canManageVenue(user: User, venue: { ownerUserId: string | null }) {
  return user.role === "admin" || (user.role === "merchant" && venue.ownerUserId === user.id);
}

// ---------- Reservations ----------
export async function createReservation(userId: string, i: { venueSlug: string; partySize: number; slotAt: Date; notes?: string }) {
  const venue = await approvedVenue(i.venueSlug);
  if (i.slotAt.getTime() < Date.now() + 30 * 60_000) throw badRequest("Choose a time at least 30 minutes from now");
  const dup = await db.select({ id: schema.reservations.id }).from(schema.reservations).where(
    and(eq(schema.reservations.userId, userId), eq(schema.reservations.venueId, venue.id), eq(schema.reservations.slotAt, i.slotAt), inArray(schema.reservations.status, ["requested", "confirmed"])),
  ).limit(1);
  if (dup.length) throw conflict("You already have a reservation for this time", "duplicate_reservation");
  const [r] = await db.insert(schema.reservations).values({
    ref: randomRef("RSV"), userId, venueId: venue.id, partySize: i.partySize, slotAt: i.slotAt, notes: i.notes,
  }).returning();
  return r!;
}

export async function listReservationsForUser(userId: string) {
  return db.select().from(schema.reservations).where(eq(schema.reservations.userId, userId)).orderBy(desc(schema.reservations.createdAt));
}

export async function cancelOwnReservation(userId: string, ref: string) {
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(schema.reservations).where(and(eq(schema.reservations.ref, ref), eq(schema.reservations.userId, userId))).for("update");
    if (!r) throw notFound("Reservation not found");
    if (!canTransitionReservation(r.status, "cancelled", "customer")) throw conflict("This reservation can no longer be cancelled", "invalid_transition");
    await tx.update(schema.reservations).set({ status: "cancelled" }).where(eq(schema.reservations.id, r.id));
    return { ...r, status: "cancelled" as ReservationStatus };
  });
}

export async function venueSetReservationStatus(actor: User, ref: string, to: ReservationStatus) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ r: schema.reservations, ownerUserId: schema.venues.ownerUserId })
      .from(schema.reservations).innerJoin(schema.venues, eq(schema.venues.id, schema.reservations.venueId))
      .where(eq(schema.reservations.ref, ref)).for("update", { of: schema.reservations });
    // A merchant probing another merchant's records gets the same answer as for a nonexistent record.
    if (!row || !canManageVenue(actor, row)) throw notFound("Reservation not found");
    if (!canTransitionReservation(row.r.status, to, "venue")) throw conflict(`Cannot move a ${row.r.status} reservation to ${to}`, "invalid_transition");
    await tx.update(schema.reservations).set({ status: to }).where(eq(schema.reservations.id, row.r.id));
    await audit(tx, { actorUserId: actor.id, action: "reservation.status", entityType: "reservation", entityId: row.r.id, metadata: { from: row.r.status, to } });
    return { ref, status: to };
  });
}

export async function listVenueReservations(actor: User) {
  const scope = actor.role === "admin" ? undefined : eq(schema.venues.ownerUserId, actor.id);
  return db.select({ r: schema.reservations }).from(schema.reservations).innerJoin(schema.venues, eq(schema.venues.id, schema.reservations.venueId)).where(scope).orderBy(desc(schema.reservations.createdAt)).limit(200);
}

// ---------- Table sessions ----------
export async function openTableSession(userId: string, venueSlug: string, tableLabel: string) {
  const venue = await approvedVenue(venueSlug);
  if (!venue.tableSessionsEnabled) throw conflict("This venue does not support table sessions", "sessions_disabled");
  const [s] = await db.insert(schema.tableSessions).values({ venueId: venue.id, userId, tableLabel }).returning();
  return s!;
}

// ---------- Orders ----------
export type OrderInput = { venueSlug: string; items: { menuItemId: string; quantity: number }[]; tableSessionId?: string };

/**
 * Places a dine-in order. Item names and prices are read from the database; the client sends only ids and quantities.
 * Alcohol items are refused: the policy for online alcohol-related sales is not approved (see docs/PRODUCTION_READINESS.md).
 */
export async function createOrder(userId: string, input: OrderInput) {
  const venue = await approvedVenue(input.venueSlug);
  if (!venue.dineInEnabled) throw conflict("This venue is not accepting dine-in orders", "dine_in_disabled");
  const ids = input.items.map((i) => i.menuItemId);
  if (new Set(ids).size !== ids.length) throw badRequest("Each item may appear once");

  const menu = await db.select().from(schema.menuItems).where(and(eq(schema.menuItems.venueId, venue.id), inArray(schema.menuItems.id, ids)));
  if (menu.length !== ids.length) throw badRequest("One or more items are not on this venue's menu");
  for (const m of menu) {
    if (!m.available) throw conflict(`"${m.name}" is currently unavailable`, "item_unavailable");
    if (m.containsAlcohol) throw conflict(`"${m.name}" cannot be ordered online`, "alcohol_not_orderable");
  }
  const byId = new Map(menu.map((m) => [m.id, m]));
  const lines = input.items.map((i) => ({ menuItem: byId.get(i.menuItemId)!, quantity: i.quantity }));
  const totalPaise = orderTotalPaise(lines.map((l) => ({ unitPricePaise: l.menuItem.pricePaise, quantity: l.quantity })));

  return db.transaction(async (tx) => {
    if (input.tableSessionId) {
      const [s] = await tx.select().from(schema.tableSessions).where(eq(schema.tableSessions.id, input.tableSessionId)).for("share");
      // Only the user who opened the session, at this venue, while it is open and enabled.
      if (!s || s.userId !== userId || s.venueId !== venue.id) throw notFound("Table session not found");
      if (s.status !== "open") throw conflict("This table session is closed", "session_closed");
      if (!venue.tableSessionsEnabled) throw conflict("This venue does not support table sessions", "sessions_disabled");
    }
    const [order] = await tx.insert(schema.orders).values({
      ref: randomRef("ORD"), userId, venueId: venue.id, tableSessionId: input.tableSessionId, totalPaise,
    }).returning();
    await tx.insert(schema.orderItems).values(lines.map((l) => ({
      orderId: order!.id, menuItemId: l.menuItem.id, nameSnapshot: l.menuItem.name, unitPricePaise: l.menuItem.pricePaise, quantity: l.quantity,
    })));
    return order!;
  });
}

export async function getOrderForUser(userId: string, ref: string) {
  const [o] = await db.select().from(schema.orders).where(and(eq(schema.orders.ref, ref), eq(schema.orders.userId, userId))).limit(1);
  if (!o) throw notFound("Order not found");
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, o.id));
  return { order: o, items };
}

export async function listOrdersForUser(userId: string) {
  return db.select().from(schema.orders).where(eq(schema.orders.userId, userId)).orderBy(desc(schema.orders.createdAt));
}

export async function cancelOwnOrder(userId: string, ref: string) {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(schema.orders).where(and(eq(schema.orders.ref, ref), eq(schema.orders.userId, userId))).for("update");
    if (!o) throw notFound("Order not found");
    if (!canTransitionOrder(o.status, "cancelled", "customer")) throw conflict("This order can no longer be cancelled", "invalid_transition");
    await tx.update(schema.orders).set({ status: "cancelled" }).where(eq(schema.orders.id, o.id));
    return { ref, status: "cancelled" as OrderStatus };
  });
}

export async function venueSetOrderStatus(actor: User, ref: string, to: OrderStatus) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ o: schema.orders, ownerUserId: schema.venues.ownerUserId })
      .from(schema.orders).innerJoin(schema.venues, eq(schema.venues.id, schema.orders.venueId))
      .where(eq(schema.orders.ref, ref)).for("update", { of: schema.orders });
    if (!row || !canManageVenue(actor, row)) throw notFound("Order not found");
    if (!canTransitionOrder(row.o.status, to, "venue")) throw conflict(`Cannot move a ${row.o.status} order to ${to}`, "invalid_transition");
    await tx.update(schema.orders).set({ status: to }).where(eq(schema.orders.id, row.o.id));
    await audit(tx, { actorUserId: actor.id, action: "order.status", entityType: "order", entityId: row.o.id, metadata: { from: row.o.status, to } });
    return { ref, status: to };
  });
}

export async function listVenueOrders(actor: User) {
  if (actor.role !== "admin" && actor.role !== "merchant") throw forbidden();
  const scope = actor.role === "admin" ? undefined : eq(schema.venues.ownerUserId, actor.id);
  return db.select({ o: schema.orders }).from(schema.orders).innerJoin(schema.venues, eq(schema.venues.id, schema.orders.venueId)).where(scope).orderBy(desc(schema.orders.createdAt)).limit(200);
}

