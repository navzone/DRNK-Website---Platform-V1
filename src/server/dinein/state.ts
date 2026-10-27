// Pure transition rules — no I/O — so they can be unit-tested exhaustively.
export type ReservationStatus = "requested" | "confirmed" | "cancelled" | "completed" | "no_show";
export type OrderStatus = "placed" | "accepted" | "served" | "cancelled";
export type Actor = "customer" | "venue";

const reservationRules: Record<ReservationStatus, Partial<Record<ReservationStatus, Actor[]>>> = {
  requested: { confirmed: ["venue"], cancelled: ["customer", "venue"] },
  confirmed: { completed: ["venue"], no_show: ["venue"], cancelled: ["customer", "venue"] },
  cancelled: {},
  completed: {},
  no_show: {},
};

const orderRules: Record<OrderStatus, Partial<Record<OrderStatus, Actor[]>>> = {
  placed: { accepted: ["venue"], cancelled: ["customer", "venue"] },
  accepted: { served: ["venue"], cancelled: ["venue"] },
  served: {},
  cancelled: {},
};

export const canTransitionReservation = (from: ReservationStatus, to: ReservationStatus, actor: Actor) =>
  reservationRules[from][to]?.includes(actor) ?? false;

export const canTransitionOrder = (from: OrderStatus, to: OrderStatus, actor: Actor) =>
  orderRules[from][to]?.includes(actor) ?? false;

/** Sum of integer paise. Throws on non-integers so a float can never reach a financial total. */
export function orderTotalPaise(lines: { unitPricePaise: number; quantity: number }[]): number {
  let total = 0;
  for (const l of lines) {
    if (!Number.isInteger(l.unitPricePaise) || !Number.isInteger(l.quantity) || l.unitPricePaise < 0 || l.quantity < 1) {
      throw new Error("invalid order line");
    }
    total += l.unitPricePaise * l.quantity;
  }
  return total;
}
