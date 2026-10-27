import { and, eq, sql } from "drizzle-orm";
import { schema, type Executor } from "@/db/client";
import { z } from "zod";

/**
 * Rewards ledger primitives. Rates, tier thresholds, multipliers and expiry are NOT defined here:
 * they come only from reward_rules rows that an operator enables from the approved specification.
 * With no active rule, nothing is earned. Points and Alcometer credits are separate ledgers.
 */
type LedgerKind = "points" | "alcometer";
const tableFor = (k: LedgerKind) => (k === "points" ? schema.pointsLedger : schema.alcometerLedger);

export async function getBalance(exec: Executor, userId: string, ledger: LedgerKind): Promise<number> {
  const t = tableFor(ledger);
  const [row] = await exec
    .select({ total: sql<number>`coalesce(sum(${t.delta}), 0)::int` })
    .from(t)
    .where(eq(t.userId, userId));
  return row?.total ?? 0;
}

/** Idempotent append. Returns false when the idempotency key already exists (duplicate delivery). */
export async function appendEntry(
  exec: Executor,
  ledger: LedgerKind,
  e: { userId: string; delta: number; kind: "earn" | "redeem" | "reversal" | "adjustment"; reason: string; refType?: string; refId?: string; reversesId?: string; idempotencyKey: string },
): Promise<boolean> {
  if (!Number.isInteger(e.delta)) throw new Error("ledger delta must be an integer");
  const rows = await exec.insert(tableFor(ledger)).values(e).onConflictDoNothing().returning({ id: tableFor(ledger).id });
  return rows.length > 0;
}

const earnRule = z.object({ pointsPerRupee: z.number().int().min(0) });

/** Points earned for a paid amount under the active `earn.event_booking` rule, or 0 if no active rule exists. */
export async function pointsForEventPayment(exec: Executor, amountPaise: number): Promise<number> {
  const [rule] = await exec
    .select()
    .from(schema.rewardRules)
    .where(and(eq(schema.rewardRules.key, "earn.event_booking"), eq(schema.rewardRules.active, true)))
    .limit(1);
  if (!rule) return 0;
  const parsed = earnRule.safeParse(rule.value);
  if (!parsed.success) return 0; // a malformed rule must never award points
  return Math.floor((amountPaise * parsed.data.pointsPerRupee) / 100); // integer math only
}

export async function awardForBooking(exec: Executor, b: { userId: string; bookingId: string; amountPaise: number }) {
  const points = await pointsForEventPayment(exec, b.amountPaise);
  if (points <= 0) return 0;
  const inserted = await appendEntry(exec, "points", {
    userId: b.userId, delta: points, kind: "earn", reason: "Event booking", refType: "event_booking", refId: b.bookingId,
    idempotencyKey: `earn:booking:${b.bookingId}`,
  });
  return inserted ? points : 0;
}
