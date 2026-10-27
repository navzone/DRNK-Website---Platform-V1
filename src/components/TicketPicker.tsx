"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { formatINR } from "@/lib/format";
import { btn, Panel } from "@/components/ui";

type TT = { id: string; name: string; pricePaise: number; remaining: number };

export function TicketPicker({ eventId, eventSlug, types, loggedIn }: { eventId: string; eventSlug: string; types: TT[]; loggedIn: boolean }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = types.reduce((n, t) => n + t.pricePaise * (qty[t.id] ?? 0), 0);
  const count = Object.values(qty).reduce((n, q) => n + q, 0);
  const set = (t: TT, q: number) => setQty((s) => ({ ...s, [t.id]: Math.max(0, Math.min(q, t.remaining, 10)) }));

  async function book() {
    setBusy(true); setError(null);
    const lines = types.filter((t) => (qty[t.id] ?? 0) > 0).map((t) => ({ ticketTypeId: t.id, quantity: qty[t.id]! }));
    const res = await api<{ booking: { ref: string } }>("/api/bookings", { body: { eventId, lines } });
    setBusy(false);
    if (res.ok) router.push(`/bookings/${res.data.booking.ref}`);
    else { setError(res.message); router.refresh(); }
  }
  return (
    <Panel>
      <h2 className="font-display text-2xl">Tickets</h2>
      <ul className="mt-4 divide-y divide-paper/10">
        {types.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><p>{t.name}</p><p className="text-sm text-ash">{t.remaining > 0 ? `${t.remaining} left` : "Sold out"}</p></div>
            <div className="flex items-center gap-3">
              <span className="text-brass">{t.pricePaise === 0 ? "Free" : formatINR(t.pricePaise)}</span>
              <div className="flex items-center gap-2" role="group" aria-label={`Quantity for ${t.name}`}>
                <button type="button" aria-label={`Remove one ${t.name} ticket`} disabled={!qty[t.id]} onClick={() => set(t, (qty[t.id] ?? 0) - 1)} className="h-8 w-8 rounded-full border border-paper/25 disabled:opacity-40">-</button>
                <span className="w-6 text-center" aria-live="polite">{qty[t.id] ?? 0}</span>
                <button type="button" aria-label={`Add one ${t.name} ticket`} disabled={t.remaining === 0 || (qty[t.id] ?? 0) >= Math.min(t.remaining, 10)} onClick={() => set(t, (qty[t.id] ?? 0) + 1)} className="h-8 w-8 rounded-full border border-paper/25 disabled:opacity-40">+</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex justify-between border-t border-paper/10 pt-4"><span>Total</span><span className="text-brass">{formatINR(total)}</span></p>
      <p className="mt-1 text-sm text-ash">DRNK confirms the final price when you book. Tickets are held for 15 minutes while you pay.</p>
      {error && <p role="alert" className="mt-3 text-sm text-ember-hi">{error}</p>}
      <div className="mt-4">
        {loggedIn ? <button disabled={busy || count === 0} onClick={book} className={btn}>{busy ? "Booking" : "Book tickets"}</button>
          : <Link href={`/login?next=/events/${eventSlug}`} className={btn}>Log in to book</Link>}
      </div>
    </Panel>
  );
}
