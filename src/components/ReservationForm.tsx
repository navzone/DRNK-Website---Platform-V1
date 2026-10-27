"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { btn, input, label, Panel } from "@/components/ui";

export function ReservationForm({ venueSlug, loggedIn }: { venueSlug: string; loggedIn: boolean }) {
  const [partySize, setPartySize] = useState(2);
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  if (!loggedIn) {
    return <Panel><p className="font-display text-xl font-bold">Reserve a table</p><p className="mt-2 text-mist">Log in to request a reservation.</p><Link href={`/login?next=/venues/${venueSlug}`} className={`${btn} mt-4`}>Log in</Link></Panel>;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await api<{ reservation: { ref: string } }>("/api/reservations", { body: { venueSlug, partySize, slotAt: new Date(slot).toISOString(), notes: notes || undefined } });
    setBusy(false);
    if (res.ok) setRef(res.data.reservation.ref); else setError(res.message);
  }
  if (ref) return <Panel><p className="font-display text-xl font-bold">Reservation requested</p><p className="mt-2">Your reference is <strong className="text-gold">{ref}</strong>. The venue will confirm it. Track it in your account.</p><Link href="/account" className="mt-3 inline-block text-gold underline">Open my account</Link></Panel>;
  return (
    <Panel>
      <form onSubmit={submit} className="space-y-4" aria-label="Reserve a table">
        <p className="font-display text-xl font-bold">Reserve a table</p>
        <div><label className={label} htmlFor="slot">Date and time</label><input id="slot" type="datetime-local" required value={slot} onChange={(e) => setSlot(e.target.value)} className={input} /></div>
        <div><label className={label} htmlFor="party">Guests</label><input id="party" type="number" min={1} max={50} required value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} className={input} /></div>
        <div><label className={label} htmlFor="notes">Notes (optional)</label><input id="notes" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} className={input} /></div>
        {error && <p role="alert" className="text-sm text-rose">{error}</p>}
        <button disabled={busy} className={btn}>{busy ? "Requesting" : "Request reservation"}</button>
      </form>
    </Panel>
  );
}
