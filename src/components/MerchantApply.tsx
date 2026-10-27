"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { btn, input, label, Panel } from "@/components/ui";

export function MerchantApply() {
  const [name, setName] = useState(""); const [area, setArea] = useState(""); const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const res = await api("/api/merchant/applications", { body: { businessName: name, neighbourhood: area || undefined, details: details || undefined } });
    setMsg(res.ok ? { ok: true, text: "Application received. Our team will review it and your account will be upgraded if approved." } : { ok: false, text: res.message });
  }
  return (
    <Panel className="mt-6 max-w-xl">
      <form onSubmit={submit} className="space-y-4" aria-label="Apply as a merchant">
        <p className="font-display text-xl">Apply to list your venue</p>
        <div><label className={label} htmlFor="mb">Business name</label><input id="mb" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={input} /></div>
        <div><label className={label} htmlFor="ma">Neighbourhood</label><input id="ma" value={area} onChange={(e) => setArea(e.target.value)} className={input} /></div>
        <div><label className={label} htmlFor="md">Anything we should know?</label><textarea id="md" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} className={input} /></div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-brass" : "text-ember-hi"}`}>{msg.text}</p>}
        <button className={btn}>Submit application</button>
      </form>
    </Panel>
  );
}
