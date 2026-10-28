"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { formatDateTime, formatINR } from "@/lib/format";
import { btn, btnGhost, Chip, input, label, Panel } from "@/components/ui";

type OrderItem = { name: string; quantity: number; unitPricePaise: number };
type Order = { id: string; ref: string; status: string; totalPaise: number; createdAt: string; venueName: string; tableLabel: string | null; guest: string; items: OrderItem[] };
type Reservation = { id: string; ref: string; status: string; partySize: number; slotAt: string };
type Venue = { id: string; slug: string; name: string; status: string };
type MenuItem = { id: string; name: string; description: string | null; pricePaise: number; available: boolean; containsAlcohol: boolean; categoryId: string | null };
type MenuData = { venue: { slug: string; name: string }; categories: { id: string; name: string }[]; items: MenuItem[] };

const nextRes: Record<string, string[]> = { requested: ["confirmed", "cancelled"], confirmed: ["completed", "no_show", "cancelled"] };
const tabs = [["orders", "Orders"], ["reservations", "Reservations"], ["menu", "Menu"], ["venues", "Venues and events"]] as const;
type Tab = (typeof tabs)[number][0];

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`;
}

export function MerchantConsole() {
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);

  // Orders refresh on their own so a new table order shows up without touching the page.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [o, r, v] = await Promise.all([api<{ orders: Order[] }>("/api/merchant/orders"), api<{ reservations: Reservation[] }>("/api/merchant/reservations"), api<{ venues: Venue[] }>("/api/merchant/venues")]);
      if (!alive) return;
      if (o.ok) { setOrders(o.data.orders); setError(null); } else setError(o.message);
      if (r.ok) setReservations(r.data.reservations);
      if (v.ok) setVenues(v.data.venues);
      setLoaded(true);
    };
    load();
    const t = setInterval(load, 6000);
    return () => { alive = false; clearInterval(t); };
  }, [reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);
  const newCount = orders.filter((o) => o.status === "placed").length;

  async function setStatus(kind: "orders" | "reservations", ref: string, status: string) {
    setNote(null); setError(null);
    const res = await api(`/api/merchant/${kind}/${ref}/status`, { body: { status } });
    if (res.ok) { setNote("Updated."); refresh(); } else setError(res.message);
  }

  return (
    <div>
      <div role="tablist" aria-label="Merchant workspace" className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {tabs.map(([k, name]) => (
          <button key={k} role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} onClick={() => setTab(k)}
            className={tab === k ? "inline-flex shrink-0 items-center gap-2 rounded-full border border-gold bg-gold px-4 py-1.5 text-sm font-semibold text-ink" : "inline-flex shrink-0 items-center gap-2 rounded-full border border-snow/15 bg-snow/5 px-4 py-1.5 text-sm text-snow hover:border-gold/60"}>
            {name}
            {k === "orders" && newCount > 0 && <span className="rounded-full bg-rose px-2 text-xs font-bold text-white" aria-label={`${newCount} new`}>{newCount}</span>}
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-6" aria-live="polite">
        {note && <p role="status" className="text-sm text-gold">{note}</p>}
        {error && <p role="alert" className="text-sm text-rose">{error}</p>}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-4">
        {tab === "orders" && <OrdersBoard orders={orders} loaded={loaded} onStatus={(ref, s) => setStatus("orders", ref, s)} />}
        {tab === "reservations" && <Reservations list={reservations} onStatus={(ref, s) => setStatus("reservations", ref, s)} />}
        {tab === "menu" && <MenuManager venues={venues.filter((v) => v.status === "approved")} onError={setError} onNote={setNote} />}
        {tab === "venues" && <VenuesAndEvents venues={venues} onDone={(m) => { setNote(m); setError(null); refresh(); }} onError={setError} />}
      </div>
    </div>
  );
}

// ---------- Orders ----------
function OrderCard({ o, onStatus }: { o: Order; onStatus: (ref: string, s: string) => void }) {
  const tone = o.status === "placed" ? "gold" : o.status === "accepted" ? "jade" : o.status === "cancelled" ? "rose" : "neutral";
  return (
    <Panel className={o.status === "placed" ? "border-gold/60" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-extrabold">{o.tableLabel ? `Table ${o.tableLabel}` : "No table given"}</p>
          <p className="mt-0.5 text-sm text-mist">{o.ref}, {o.venueName.replace(/\s*\[Demo\]$/, "")}</p>
          <p className="text-sm text-mist">Guest {o.guest}, {ago(o.createdAt)}</p>
        </div>
        <Chip tone={tone}>{o.status}</Chip>
      </div>
      <ul className="mt-4 divide-y divide-snow/10 border-y border-snow/10">
        {o.items.map((i, k) => <li key={k} className="flex justify-between gap-4 py-2"><span><span className="font-semibold text-gold">{i.quantity} x</span> {i.name}</span><span className="text-mist">{formatINR(i.unitPricePaise * i.quantity)}</span></li>)}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">Total <span className="text-gold">{formatINR(o.totalPaise)}</span> <span className="text-sm font-normal text-mist">paid at the venue</span></p>
        <div className="flex gap-2">
          {o.status === "placed" && <><button className={btn} onClick={() => onStatus(o.ref, "accepted")}>Accept</button><button className={btnGhost} onClick={() => onStatus(o.ref, "cancelled")}>Decline</button></>}
          {o.status === "accepted" && <><button className={btn} onClick={() => onStatus(o.ref, "served")}>Mark served</button><button className={btnGhost} onClick={() => onStatus(o.ref, "cancelled")}>Cancel</button></>}
        </div>
      </div>
    </Panel>
  );
}

function OrdersBoard({ orders, loaded, onStatus }: { orders: Order[]; loaded: boolean; onStatus: (ref: string, s: string) => void }) {
  const groups: [string, string, Order[]][] = [
    ["New orders", "Accept or decline", orders.filter((o) => o.status === "placed")],
    ["In the kitchen", "Accepted, not yet served", orders.filter((o) => o.status === "accepted")],
    ["Finished", "Served or cancelled", orders.filter((o) => o.status === "served" || o.status === "cancelled").slice(0, 10)],
  ];
  if (loaded && orders.length === 0) return <Panel className="text-mist">No orders yet. New table orders appear here by themselves, no need to refresh.</Panel>;
  return (
    <div className="space-y-8">
      {groups.map(([title, sub, list]) => (
        <section key={title} aria-label={title}>
          <h2 className="font-display text-2xl font-bold">{title} <span className="text-base font-normal text-mist">{list.length}</span></h2>
          <p className="text-sm text-mist">{sub}</p>
          {list.length === 0 ? <p className="mt-3 text-sm text-mist">Nothing here.</p> : <ul className="mt-3 grid gap-3 lg:grid-cols-2">{list.map((o) => <li key={o.id}><OrderCard o={o} onStatus={onStatus} /></li>)}</ul>}
        </section>
      ))}
    </div>
  );
}

// ---------- Reservations ----------
function Reservations({ list, onStatus }: { list: Reservation[]; onStatus: (ref: string, s: string) => void }) {
  if (list.length === 0) return <Panel className="text-mist">No reservations yet.</Panel>;
  return (
    <ul className="space-y-3">{list.map((r) => (
      <li key={r.id}><Panel className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-display text-lg">{r.ref}</p><p className="text-sm text-mist">{r.partySize} guests, {formatDateTime(r.slotAt)}, {r.status.replace("_", " ")}</p></div>
        <div className="flex flex-wrap gap-2">{(nextRes[r.status] ?? []).map((s) => <button key={s} className={s === "confirmed" ? btn : btnGhost} onClick={() => onStatus(r.ref, s)}>{s === "confirmed" ? "Confirm" : s === "completed" ? "Mark completed" : s === "no_show" ? "No-show" : "Cancel"}</button>)}</div>
      </Panel></li>
    ))}</ul>
  );
}

// ---------- Menu ----------
function MenuManager({ venues, onError, onNote }: { venues: Venue[]; onError: (m: string | null) => void; onNote: (m: string | null) => void }) {
  const [slug, setSlug] = useState("");
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [name, setName] = useState(""); const [price, setPrice] = useState(""); const [desc, setDesc] = useState(""); const [cat, setCat] = useState(""); const [alcohol, setAlcohol] = useState(false);
  const active = slug || venues[0]?.slug || "";

  const load = useCallback(async (s: string) => {
    if (!s) return;
    const res = await api<MenuData>(`/api/merchant/venues/${s}/menu-items`);
    if (res.ok) setMenu(res.data); else onError(res.message);
  }, [onError]);
  useEffect(() => { let alive = true; (async () => { if (alive) await load(active); })(); return () => { alive = false; }; }, [active, load]);

  async function toggle(i: MenuItem) {
    onNote(null); onError(null);
    const res = await api(`/api/merchant/menu-items/${i.id}/availability`, { body: { available: !i.available } });
    if (res.ok) { onNote(`${i.name} is now ${i.available ? "unavailable" : "available"}.`); load(active); } else onError(res.message);
  }
  async function add(e: React.FormEvent) {
    e.preventDefault(); onNote(null); onError(null);
    const pricePaise = Math.round(Number(price) * 100);
    const res = await api(`/api/merchant/venues/${active}/menu-items`, { body: { name, description: desc || undefined, pricePaise, containsAlcohol: alcohol, category: cat || undefined } });
    if (res.ok) { onNote(`${name} added to the menu.`); setName(""); setPrice(""); setDesc(""); setAlcohol(false); load(active); } else onError(res.message);
  }

  if (venues.length === 0) return <Panel className="text-mist">You have no approved venue yet. Add one under Venues and events. It goes live after DRNK approves it.</Panel>;
  const groups = menu ? [
    ...menu.categories.map((c) => ({ name: c.name, items: menu.items.filter((i) => i.categoryId === c.id) })),
    { name: "More", items: menu.items.filter((i) => !menu.categories.some((c) => c.id === i.categoryId)) },
  ].filter((g) => g.items.length > 0) : [];
  return (
    <div className="space-y-8">
      <div className="max-w-sm"><label className={label} htmlFor="mv">Venue</label>
        <select id="mv" value={active} onChange={(e) => { setSlug(e.target.value); setMenu(null); }} className={input}>{venues.map((v) => <option key={v.id} value={v.slug}>{v.name}</option>)}</select></div>

      {groups.map((g) => (
        <section key={g.name} aria-label={g.name}>
          <h2 className="font-display text-xl font-semibold text-gold">{g.name}</h2>
          <ul className="mt-3 divide-y divide-snow/10 rounded-xl border border-snow/10">
            {g.items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0"><p className={i.available ? "" : "text-mist line-through"}>{i.name} {i.containsAlcohol && <Chip tone="neutral">Alcohol</Chip>}</p>{i.description && <p className="text-sm text-mist">{i.description}</p>}</div>
                <div className="flex items-center gap-4"><span className="text-gold">{formatINR(i.pricePaise)}</span>
                  <button type="button" role="switch" aria-checked={i.available} aria-label={`${i.name} available`} onClick={() => toggle(i)}
                    className={`relative h-7 w-12 rounded-full border transition-colors ${i.available ? "border-jade bg-jade/30" : "border-snow/25 bg-snow/10"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-snow transition-all ${i.available ? "left-6" : "left-0.5"}`} />
                  </button></div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {menu && menu.items.length === 0 && <Panel className="text-mist">This menu is empty. Add your first item below.</Panel>}

      <Panel><h2 className="font-display text-xl font-bold">Add a menu item</h2>
        <form onSubmit={add} className="mt-4 grid gap-4 sm:grid-cols-2" aria-label="Add a menu item">
          <div><label className={label} htmlFor="mi-n">Name</label><input id="mi-n" required minLength={1} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={input} /></div>
          <div><label className={label} htmlFor="mi-p">Price in rupees</label><input id="mi-p" type="number" required min={0} step="1" value={price} onChange={(e) => setPrice(e.target.value)} className={input} /></div>
          <div><label className={label} htmlFor="mi-c">Category</label><input id="mi-c" list="mi-cats" maxLength={60} placeholder="For example Starters" value={cat} onChange={(e) => setCat(e.target.value)} className={input} /><datalist id="mi-cats">{menu?.categories.map((c) => <option key={c.id} value={c.name} />)}</datalist></div>
          <div><label className={label} htmlFor="mi-d">Description</label><input id="mi-d" maxLength={500} value={desc} onChange={(e) => setDesc(e.target.value)} className={input} /></div>
          <div className="flex items-center gap-2 sm:col-span-2"><input id="mi-a" type="checkbox" checked={alcohol} onChange={(e) => setAlcohol(e.target.checked)} /><label htmlFor="mi-a" className="text-sm text-mist">Contains alcohol (listed, but cannot be ordered online)</label></div>
          <div className="sm:col-span-2"><button className={btn}>Add to menu</button></div>
        </form></Panel>
    </div>
  );
}

// ---------- Venues and events ----------
function VenuesAndEvents({ venues, onDone, onError }: { venues: Venue[]; onDone: (m: string) => void; onError: (m: string | null) => void }) {
  const [vName, setVName] = useState(""); const [vNeighbourhood, setVNeighbourhood] = useState(""); const [vAddress, setVAddress] = useState(""); const [vCategory, setVCategory] = useState("pub");
  const [evVenue, setEvVenue] = useState(""); const [evTitle, setEvTitle] = useState(""); const [evStart, setEvStart] = useState(""); const [tName, setTName] = useState("General"); const [tPrice, setTPrice] = useState("500"); const [tCap, setTCap] = useState("50");

  async function createVenue(e: React.FormEvent) {
    e.preventDefault(); onError(null);
    const res = await api("/api/merchant/venues", { body: { name: vName, category: vCategory, neighbourhood: vNeighbourhood, address: vAddress, cuisines: [], dineInEnabled: true } });
    if (res.ok) { onDone("Venue submitted. It goes live after DRNK approves it."); setVName(""); setVNeighbourhood(""); setVAddress(""); } else onError(res.message);
  }
  async function createEvent(e: React.FormEvent) {
    e.preventDefault(); onError(null);
    const pricePaise = Math.round(Number(tPrice) * 100);
    const res = await api("/api/merchant/events", { body: { venueSlug: evVenue, title: evTitle, startsAt: new Date(evStart).toISOString(), ticketTypes: [{ name: tName, pricePaise, capacity: Number(tCap) }] } });
    if (res.ok) { onDone("Event submitted. It goes live after DRNK approves it."); setEvTitle(""); } else onError(res.message);
  }
  return (
    <div className="space-y-12">
      <section><h2 className="font-display text-2xl">Your venues</h2>
        {venues.length > 0 && <ul className="mt-3 space-y-2">{venues.map((v) => <li key={v.id} className="flex justify-between"><span>{v.name}</span><span className="text-gold">{v.status}</span></li>)}</ul>}
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
