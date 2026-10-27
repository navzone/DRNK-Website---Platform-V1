"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { btn, btnGhost, input, label, Panel } from "@/components/ui";

export function ProfileForm({ displayName, email }: { displayName: string | null; email: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(displayName ?? "");
  const [mail, setMail] = useState(email ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const res = await api("/api/account", { method: "PATCH", body: { ...(name && { displayName: name }), ...(mail && { email: mail }) } });
    if (res.ok) { setMsg({ ok: true, text: "Saved" }); router.refresh(); } else setMsg({ ok: false, text: res.message });
  }
  return (
    <form onSubmit={save} className="space-y-4" aria-label="Profile">
      <div><label className={label} htmlFor="pname">Name</label><input id="pname" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={input} /></div>
      <div><label className={label} htmlFor="pmail">Email</label><input id="pmail" type="email" value={mail} maxLength={120} onChange={(e) => setMail(e.target.value)} className={input} /></div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-gold" : "text-rose"}`}>{msg.text}</p>}
      <button className={btn}>Save changes</button>
    </form>
  );
}

export function SupportForm() {
  const router = useRouter();
  const [subject, setSubject] = useState(""); const [body, setBody] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const res = await api("/api/support", { body: { subject, body } });
    if (res.ok) { setMsg({ ok: true, text: "Request sent. We'll reply in your account." }); setSubject(""); setBody(""); router.refresh(); } else setMsg({ ok: false, text: res.message });
  }
  return (
    <form onSubmit={send} className="space-y-4" aria-label="Contact support">
      <div><label className={label} htmlFor="ssub">Subject</label><input id="ssub" required minLength={3} maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} className={input} /></div>
      <div><label className={label} htmlFor="sbody">What happened?</label><textarea id="sbody" required minLength={10} maxLength={2000} rows={4} value={body} onChange={(e) => setBody(e.target.value)} className={input} /></div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-gold" : "text-rose"}`}>{msg.text}</p>}
      <button className={btn}>Send request</button>
    </form>
  );
}

export function PrivacyActions() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function request(kind: "export" | "delete") {
    if (kind === "delete" && !window.confirm("Request deletion of your DRNK account? Our team will review it. Some records may need to be kept by law.")) return;
    setMsg(null);
    const res = await api("/api/account/data-requests", { body: { kind } });
    if (res.ok) { setMsg({ ok: true, text: kind === "export" ? "Data request recorded." : "Deletion request recorded." }); router.refresh(); } else setMsg({ ok: false, text: res.message });
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3"><button onClick={() => request("export")} className={btnGhost}>Request a copy of my data</button><button onClick={() => request("delete")} className={btnGhost}>Request account deletion</button></div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-gold" : "text-rose"}`}>{msg.text}</p>}
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function out() { setBusy(true); await api("/api/auth/logout", { method: "POST", body: {} }); router.replace("/"); router.refresh(); }
  return <button onClick={out} disabled={busy} className={btnGhost}>{busy ? "Logging out" : "Log out"}</button>;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-10"><h2 className="font-display text-2xl font-bold">{title}</h2><Panel className="mt-3">{children}</Panel></section>;
}
