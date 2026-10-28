"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock, UtensilsCrossed, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { formatDateTime, formatINR } from "@/lib/format";
import { btnGhost, Panel } from "@/components/ui";

export type TrackedOrder = {
  order: { ref: string; status: string; totalPaise: number; createdAt: string };
  items: { id: string; nameSnapshot: string; unitPricePaise: number; quantity: number }[];
  venue: { name: string; slug: string };
  tableLabel: string | null;
};

const steps = [
  { key: "placed", label: "Order sent", help: "Waiting for the venue to accept it.", Icon: Clock },
  { key: "accepted", label: "Being prepared", help: "The venue accepted your order and is preparing it.", Icon: UtensilsCrossed },
  { key: "served", label: "Served", help: "Enjoy. Pay the bill at the venue.", Icon: Check },
] as const;

/** Shows where an order is and refreshes by itself until it is served or cancelled. */
export function OrderTracker({ initial }: { initial: TrackedOrder }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const status = data.order.status;
  const live = status === "placed" || status === "accepted";

  useEffect(() => {
    if (!live) return;
    const t = setInterval(async () => {
      const res = await api<TrackedOrder>(`/api/orders/${initial.order.ref}`);
      if (res.ok) setData(res.data);
    }, 5000);
    return () => clearInterval(t);
  }, [live, initial.order.ref]);

  async function cancel() {
    setBusy(true); setError(null);
    const res = await api(`/api/orders/${data.order.ref}/cancel`, { body: {} });
    if (res.ok) {
      const fresh = await api<TrackedOrder>(`/api/orders/${data.order.ref}`);
      if (fresh.ok) setData(fresh.data);
    } else setError(res.message);
    setBusy(false);
  }

  const at = steps.findIndex((s) => s.key === status);
  return (
    <div className="space-y-6">
      <Panel>
        {status === "cancelled" ? (
          <p role="status" className="flex items-center gap-2 font-display text-xl font-bold text-rose"><X className="h-5 w-5" aria-hidden="true" /> Order cancelled</p>
        ) : (
          <>
            <ol className="grid gap-4 sm:grid-cols-3" aria-label="Order progress">
              {steps.map((s, i) => {
                const done = i < at, current = i === at;
                return (
                  <li key={s.key} aria-current={current ? "step" : undefined} className={`rounded-xl border p-4 ${current ? "border-gold bg-gold/10" : done ? "border-jade/40 bg-jade/5" : "border-snow/10 opacity-60"}`}>
                    <s.Icon className={`h-5 w-5 ${current ? "text-gold" : done ? "text-jade" : "text-mist"}`} aria-hidden="true" />
                    <p className="mt-2 font-display text-lg font-semibold">{s.label}</p>
                    {current && <p className="mt-1 text-sm text-mist">{s.help}</p>}
                  </li>
                );
              })}
            </ol>
            <p role="status" aria-live="polite" className="mt-4 text-sm text-mist">{live ? "This page updates by itself." : "All done."}</p>
          </>
        )}
      </Panel>

      <Panel>
        <p className="flex flex-wrap items-baseline justify-between gap-2">
          <Link href={`/venues/${data.venue.slug}`} className="font-display text-xl font-bold hover:text-gold">{data.venue.name.replace(/\s*\[Demo\]$/, "")}</Link>
          {data.tableLabel && <span className="tag rounded-full border border-snow/15 px-3 py-1 text-snow">Table {data.tableLabel}</span>}
        </p>
        <p className="mt-1 text-sm text-mist">{data.order.ref}, placed {formatDateTime(data.order.createdAt)}</p>
        <ul className="mt-4 divide-y divide-snow/10">
          {data.items.map((i) => <li key={i.id} className="flex justify-between gap-4 py-2"><span>{i.quantity} x {i.nameSnapshot}</span><span className="text-mist">{formatINR(i.unitPricePaise * i.quantity)}</span></li>)}
        </ul>
        <p className="mt-3 flex justify-between border-t border-snow/10 pt-3 font-semibold"><span>Total</span><span className="text-gold">{formatINR(data.order.totalPaise)}</span></p>
        <p className="mt-1 text-sm text-mist">Dine-in orders are paid at the venue.</p>
      </Panel>

      {error && <p role="alert" className="text-sm text-rose">{error}</p>}
      <div className="flex flex-wrap gap-3">
        {status === "placed" && <button type="button" onClick={cancel} disabled={busy} className={btnGhost}>{busy ? "Cancelling" : "Cancel order"}</button>}
        <Link href={`/venues/${data.venue.slug}`} className={btnGhost}>Order more</Link>
        <Link href="/account" className={btnGhost}>Your account</Link>
      </div>
    </div>
  );
}
