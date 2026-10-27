"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { formatINR } from "@/lib/format";
import { btn, btnGhost, input, label, Panel } from "@/components/ui";

type Item = { id: string; name: string; description: string | null; pricePaise: number; available: boolean; containsAlcohol: boolean };

/** Cart lives in the browser for convenience only. The server re-reads every price and computes the real total. */
export function OrderPanel({ venueSlug, items, loggedIn, dineIn, sessionsEnabled }: { venueSlug: string; items: Item[]; loggedIn: boolean; dineIn: boolean; sessionsEnabled: boolean }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ ref: string; totalPaise: number } | null>(null);
  const [tableLabel, setTableLabel] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const lines = items.filter((i) => cart[i.id]);
  const estimate = lines.reduce((n, i) => n + i.pricePaise * (cart[i.id] ?? 0), 0);
  const setQty = (id: string, q: number) => setCart((c) => { const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = Math.min(50, q); return n; });

  async function openSession() {
    setError(null);
    const res = await api<{ tableSession: { id: string } }>("/api/table-sessions", { body: { venueSlug, tableLabel } });
    if (res.ok) setSessionId(res.data.tableSession.id); else setError(res.message);
  }
  async function place() {
    setBusy(true); setError(null);
    const res = await api<{ order: { ref: string; totalPaise: number } }>("/api/orders", {
      body: { venueSlug, tableSessionId: sessionId ?? undefined, items: lines.map((i) => ({ menuItemId: i.id, quantity: cart[i.id] })) },
    });
    setBusy(false);
    if (res.ok) { setPlaced(res.data.order); setCart({}); } else setError(res.message);
  }

  return (
    <section aria-labelledby="menu-h">
      <h2 id="menu-h" className="font-display text-3xl">Menu</h2>
      {items.length === 0 && <p className="mt-3 text-ash">This venue hasn&apos;t published a menu yet.</p>}
      <ul className="mt-4 divide-y divide-paper/10 rounded-xl border border-paper/10">
        {items.map((i) => {
          const orderable = dineIn && i.available && !i.containsAlcohol;
          return (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className={i.available ? "" : "text-ash line-through"}>{i.name}</p>
                {i.description && <p className="text-sm text-ash">{i.description}</p>}
                {!i.available && <p className="text-sm text-ash">Unavailable right now</p>}
                {i.available && i.containsAlcohol && <p className="text-sm text-ash">Not available to order online</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-brass">{formatINR(i.pricePaise)}</span>
                {orderable && loggedIn && (
                  <div className="flex items-center gap-2" role="group" aria-label={`Quantity for ${i.name}`}>
                    <button type="button" aria-label={`Remove one ${i.name}`} disabled={!cart[i.id]} onClick={() => setQty(i.id, (cart[i.id] ?? 0) - 1)} className="h-8 w-8 rounded-full border border-paper/25 disabled:opacity-40">-</button>
                    <span className="w-6 text-center" aria-live="polite">{cart[i.id] ?? 0}</span>
                    <button type="button" aria-label={`Add one ${i.name}`} onClick={() => setQty(i.id, (cart[i.id] ?? 0) + 1)} className="h-8 w-8 rounded-full border border-paper/25">+</button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {dineIn && !loggedIn && <p className="mt-4 text-ash"><Link href={`/login?next=/venues/${venueSlug}`} className="text-brass underline">Log in</Link> to order at your table.</p>}
      {!dineIn && <p className="mt-4 text-ash">This venue doesn&apos;t take dine-in orders through DRNK yet.</p>}

      {dineIn && loggedIn && (
        <Panel className="mt-6">
          {placed ? (
            <div role="status"><p className="font-display text-xl">Order placed</p><p className="mt-2">Reference <strong className="text-brass">{placed.ref}</strong>, total {formatINR(placed.totalPaise)}. The venue will accept it shortly.</p><button className={`${btnGhost} mt-4`} onClick={() => setPlaced(null)}>Order more</button></div>
          ) : (
            <>
              <p className="font-display text-xl">Your order</p>
              {lines.length === 0 ? <p className="mt-2 text-ash">Add items from the menu to start an order.</p> : (
                <>
                  <ul className="mt-3 space-y-1">{lines.map((i) => <li key={i.id} className="flex justify-between"><span>{cart[i.id]} x {i.name}</span><span>{formatINR(i.pricePaise * (cart[i.id] ?? 0))}</span></li>)}</ul>
                  <p className="mt-3 flex justify-between border-t border-paper/10 pt-3"><span>Estimated total</span><span className="text-brass">{formatINR(estimate)}</span></p>
                  <p className="mt-1 text-sm text-ash">The final total is confirmed by DRNK when you place the order.</p>
                </>
              )}
              {sessionsEnabled && (
                <div className="mt-4">
                  {sessionId ? <p className="text-sm text-brass">Adding to your open table session.</p> : (
                    <div className="flex items-end gap-2"><div className="flex-1"><label className={label} htmlFor="tbl">Table (optional)</label><input id="tbl" value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} maxLength={20} className={input} /></div><button type="button" disabled={!tableLabel.trim()} onClick={openSession} className={btnGhost}>Start table session</button></div>
                  )}
                </div>
              )}
              {error && <p role="alert" className="mt-3 text-sm text-ember-hi">{error}</p>}
              <div className="mt-4 flex gap-3"><button disabled={busy || lines.length === 0} onClick={place} className={btn}>{busy ? "Placing order" : "Place order"}</button>{lines.length > 0 && <button className={btnGhost} onClick={() => setCart({})}>Clear</button>}</div>
            </>
          )}
        </Panel>
      )}
    </section>
  );
}
