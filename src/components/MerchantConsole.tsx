"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { formatDateTime, formatINR } from "@/lib/format";
import { btn, btnGhost, input, label, Panel } from "@/components/ui";

type Order = { id: string; ref: string; status: string; totalPaise: number; createdAt: string };
type Reservation = { id: string; ref: string; status: string; partySize: number; slotAt: string };
type Venue = { id: string; slug: string; name: string; status: string };

const nextOrder: Record<string, string[]> = { placed: ["accepted", "cancelled"], accepted: ["served", "cancelled"] };
const nextRes: Record<string, string[]> = { requested: ["confirmed", "cancelled"], confirmed: ["completed", "no_show", "cancelled"] };

export function MerchantConsole() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [vName, setVName] = useState(""); const [vNeighbourhood, setVNeighbourhood] = useState(""); const [vAddress, setVAddress] = useState(""); const [vCategory, setVCategory] = useState("pub");
  const [evVenue, setEvVenue] = useState(""); const [evTitle, setEvTitle] = useState(""); const [evStart, setEvStart] = useState(""); const [tName, setTName] = useState("General"); const [tPrice, setTPrice] = useState("500"); const [tCap, setTCap] = useState("50");

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [o, r, v] = await Promise.all([api<{ orders: Order[] }>("/api/merchant/orders"), api<{ reservations: Reservation[] }>("/api/merchant/reservations"), api<{ venues: Venue[] }>("/api/merchant/venues")]);
      if (!alive) return;
      if (o.ok) { setOrders(o.data.orders); setError(null); } else setError(o.message);
      if (r.ok) setReservations(r.data.reservations);
      if (v.ok) setVenues(v.data.venues);
    })();
    return () => { alive = false; };
  }, [reload]);

  async function setStatus(kind: "orders" | "reservations", ref: string, status: string) {
    setNote(null); setError(null);
    const res = await api(`/api/merchant/${kind}/${ref}/status`, { body: { status } });
    if (res.ok) { setNote("Updated."); setReload((k) => k + 1); } else setError(res.message);
  }
  async function createVenue(e: React.FormEvent) {
    e.preventDefault(); setNote(null); setError(null);
    const res = await api("/api/merchant/venues", { body: { name: vName, category: vCategory, neighbourhood: vNeighbourhood, address: vAddress, cuisines: [], dineInEnabled: true } });
    if (res.ok) { setNote("Venue submitted. It goes live after DRNK approves it."); setVName(""); setVNeighbourhood(""); setVAddress(""); setReload((k) => k + 1); } else setError(res.message);
  }
  async function createEvent(e: React.FormEvent) {
    e.preventDefault(); setNote(null); setError(null);
    const pricePaise = Math.round(Number(tPrice) * 100);
    const res = await api("/api/merchant/events", { body: { venueSlug: evVenue, title: evTitle, startsAt: new Date(evStart).toISOString(), ticketTypes: [{ name: tName, pricePaise, capacity: Number(tCap) }] } });
    if (res.ok) { setNote("Event submitted. It goes live after DRNK approves it."); setEvTitle(""); } else setError(res.message);
  }

  return (
    <div className="space-y-12">
      {note && <p role="status" className="text-sm text-brass">{note}</p>}
      {error && <p role="alert" className="text-sm text-ember-hi">{error}</p>}

      <section><h2 className="font-display text-2xl">Orders</h2>
        {orders.length === 0 ? <Panel className="mt-3 text-ash">No orders for your venues yet.</Panel> : (
          <ul className="mt-3 space-y-3">{orders.map((o) => <li key={o.id}><Panel className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-display text-lg">{o.ref}</p><p className="text-sm text-ash">{o.status}, {formatINR(o.totalPaise)}, {formatDateTime(o.createdAt)}</p></div><div className="flex gap-2">{(nextOrder[o.status] ?? []).map((s) => <button key={s} className={s === "cancelled" ? btnGhost : btn} onClick={() => setStatus("orders", o.ref, s)}>{s === "accepted" ? "Accept" : s === "served" ? "Mark served" : "Cancel"}</button>)}</div></Panel></li>)}</ul>
        )}
      </section>

      <section><h2 className="font-display text-2xl">Reservations</h2>
        {reservations.length === 0 ? <Panel className="mt-3 text-ash">No reservations yet.</Panel> : (
          <ul className="mt-3 space-y-3">{reservations.map((r) => <li key={r.id}><Panel className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-display text-lg">{r.ref}</p><p className="text-sm text-ash">{r.partySize} guests, {formatDateTime(r.slotAt)}, {r.status.replace("_", " ")}</p></div><div className="flex flex-wrap gap-2">{(nextRes[r.status] ?? []).map((s) => <button key={s} className={s === "confirmed" ? btn : btnGhost} onClick={() => setStatus("reservations", r.ref, s)}>{s === "confirmed" ? "Confirm" : s === "completed" ? "Mark completed" : s === "no_show" ? "No-show" : "Cancel"}</button>)}</div></Panel></li>)}</ul>
        )}
      </section>

      <section><h2 className="font-display text-2xl">Your venues</h2>
        {venues.length > 0 && <ul className="mt-3 space-y-2">{venues.map((v) => <li key={v.id} className="flex justify-between"><span>{v.name}</span><span className="text-brass">{v.status}</span></li>)}</ul>}
        <Panel className="mt-4"><form onSubmit={createVenue} className="grid gap-4 sm:grid-cols-2" aria-label="Add a venue">
          <div><label className={label} htmlFor="vn">Venue name</label><input id="vn" required minLength={2} value={vName} onChange={(e) => setVName(e.target.value)} className={input} /></div>
          <div><label className={label} htmlFor="vc">Category</label><select id="vc" value={vCategory} onChange={(e) => setVCategory(e.target.value)} className={input}>{["restaurant", "pub", "microbrewery", "lounge", "cafe"].map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className={label} htmlFor="vh">Neighbourhood</label><input id="vh" required value={vNeighbourhood} onChange={(e) => setVNeighbourhood(e.target.value)} className={input} /></div>
          <div><label className={label} htmlFor="va">Address</label><input id="va" required minLength={5} value={vAddress} onChange={(e) => setVAddress(e.target.value)} className={input} /></div>
          <div className="sm:col-span-2"><button className={btn}>Submit venue for approval</button></div>
        </form></Panel>
      </section>

      <section><h2 className="font-display text-2xl">Create an event</h2>
        <Panel className="mt-3"><form onSubmit={createEvent} className="grid gap-4 sm:grid-cols-2" aria-label="Create an event">
          <div><label className={label} htmlFor="ev">Venue</label><select id="ev" required value={evVenue} onChange={(e) => setEvVenue(e.target.value)} className={input}><option value="">Choose a venue</option>{venues.filter((v) => v.status === "approved").map((v) => <option key={v.id} value={v.slug}>{v.name}</option>)}</select></div>
          <div><label className={label} htmlFor="et">Title</label><input id="et" required minLength={3} value={evTitle} onChange={(e) => setEvTitle(e.target.value)} className={input} /></div>
          <div><label className={label} htmlFor="es">Starts</label><input id="es" type="datetime-local" required value={evStart} onChange={(e) => setEvStart(e.target.value)} className={input} /></div>
          <div><label className={label} htmlFor="tn">Ticket type</label><input id="tn" required value={tName} onChange={(e) => setTName(e.target.value)} className={input} /></div>
          <div><label className={label} htmlFor="tp">Price in rupees</label><input id="tp" type="number" min={0} step="1" required value={tPrice} onChange={(e) => setTPrice(e.target.value)} className={input} /></div>
          <div><label className={label} htmlFor="tc">Capacity</label><input id="tc" type="number" min={1} step="1" required value={tCap} onChange={(e) => setTCap(e.target.value)} className={input} /></div>
          <div className="sm:col-span-2"><button className={btn}>Submit event for approval</button></div>
        </form></Panel>
      </section>
    </div>
  );
}
