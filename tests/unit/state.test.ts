import { describe, expect, it } from "vitest";
import { canTransitionOrder, canTransitionReservation, orderTotalPaise, type OrderStatus, type ReservationStatus } from "@/server/dinein/state";

const R: ReservationStatus[] = ["requested", "confirmed", "cancelled", "completed", "no_show"];
const O: OrderStatus[] = ["placed", "accepted", "served", "cancelled"];

describe("reservation state machine", () => {
  it("allows only the documented transitions", () => {
    const allowed: [ReservationStatus, ReservationStatus, "customer" | "venue"][] = [
      ["requested", "confirmed", "venue"], ["requested", "cancelled", "customer"], ["requested", "cancelled", "venue"],
      ["confirmed", "completed", "venue"], ["confirmed", "no_show", "venue"], ["confirmed", "cancelled", "customer"], ["confirmed", "cancelled", "venue"],
    ];
    for (const from of R) for (const to of R) for (const actor of ["customer", "venue"] as const) {
      const expected = allowed.some(([f, t, a]) => f === from && t === to && a === actor);
      expect(canTransitionReservation(from, to, actor), `${from}->${to} by ${actor}`).toBe(expected);
    }
  });
  it("terminal states have no exits", () => {
    for (const from of ["cancelled", "completed", "no_show"] as const) for (const to of R) expect(canTransitionReservation(from, to, "venue")).toBe(false);
  });
  it("customers can never confirm their own reservation", () => expect(canTransitionReservation("requested", "confirmed", "customer")).toBe(false));
});

describe("order state machine", () => {
  it("allows only the documented transitions", () => {
    const allowed: [OrderStatus, OrderStatus, "customer" | "venue"][] = [
      ["placed", "accepted", "venue"], ["placed", "cancelled", "customer"], ["placed", "cancelled", "venue"],
      ["accepted", "served", "venue"], ["accepted", "cancelled", "venue"],
    ];
    for (const from of O) for (const to of O) for (const actor of ["customer", "venue"] as const) {
      const expected = allowed.some(([f, t, a]) => f === from && t === to && a === actor);
      expect(canTransitionOrder(from, to, actor), `${from}->${to} by ${actor}`).toBe(expected);
    }
  });
  it("customers cannot mark their own order accepted or served", () => {
    expect(canTransitionOrder("placed", "accepted", "customer")).toBe(false);
    expect(canTransitionOrder("accepted", "served", "customer")).toBe(false);
  });
  it("customers cannot cancel once the venue accepted", () => expect(canTransitionOrder("accepted", "cancelled", "customer")).toBe(false));
});

describe("order totals use exact integer paise", () => {
  it("sums lines exactly", () => expect(orderTotalPaise([{ unitPricePaise: 29900, quantity: 2 }, { unitPricePaise: 38000, quantity: 1 }])).toBe(97800));
  it("avoids floating-point drift (0.1 + 0.2 style)", () => expect(orderTotalPaise([{ unitPricePaise: 10, quantity: 1 }, { unitPricePaise: 20, quantity: 1 }])).toBe(30));
  it("rejects floats, negatives and zero quantity", () => {
    expect(() => orderTotalPaise([{ unitPricePaise: 10.5, quantity: 1 }])).toThrow();
    expect(() => orderTotalPaise([{ unitPricePaise: -1, quantity: 1 }])).toThrow();
    expect(() => orderTotalPaise([{ unitPricePaise: 1, quantity: 0 }])).toThrow();
    expect(() => orderTotalPaise([{ unitPricePaise: 1, quantity: 1.5 }])).toThrow();
  });
});
