"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { btn, input, label, Panel } from "@/components/ui";

export function EnquiryForm({ slug, loggedIn }: { slug: string; loggedIn: boolean }) {
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  if (!loggedIn) return <Panel><p className="font-display text-xl">Send an enquiry</p><p className="mt-2 text-ash">Log in to contact this talent.</p><Link href={`/login?next=/talents/${slug}`} className={`${btn} mt-4`}>Log in</Link></Panel>;
  if (sent) return <Panel><p className="font-display text-xl">Enquiry sent</p><p className="mt-2 text-ash">Replies appear under Enquiries in your account.</p></Panel>;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const res = await api(`/api/talents/${slug}/enquiries`, { body: { message, eventDate: date ? new Date(date).toISOString() : undefined } });
    setBusy(false);
    if (res.ok) setSent(true); else setError(res.message);
  }
  return (
    <Panel>
      <form onSubmit={submit} className="space-y-4" aria-label="Send an enquiry">
        <p className="font-display text-xl">Send an enquiry</p>
        <div><label className={label} htmlFor="edate">Event date (optional)</label><input id="edate" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={input} /></div>
        <div><label className={label} htmlFor="emsg">Message</label><textarea id="emsg" required minLength={5} maxLength={1000} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className={input} placeholder="Tell them about your event, venue and what you need." /></div>
        {error && <p role="alert" className="text-sm text-ember-hi">{error}</p>}
        <button disabled={busy} className={btn}>{busy ? "Sending" : "Send enquiry"}</button>
      </form>
    </Panel>
  );
}
