"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { btn, btnGhost, input, label } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault(); setBusy(true); setError(null); setNote(null);
    const res = await api("/api/auth/otp/request", { body: { phone } });
    setBusy(false);
    if (res.ok) { setStep("code"); setNote("We sent a 6-digit code to your mobile. It expires in 5 minutes."); } else setError(res.message);
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const res = await api("/api/auth/otp/verify", { body: { phone, code } });
    setBusy(false);
    // Full page navigation so server components pick up the new session cookie.
    if (res.ok) window.location.assign(next); else setError(res.message);
  }
  return (
    <div className="max-w-md">
      {step === "phone" ? (
        <form onSubmit={sendCode} className="space-y-4" aria-label="Log in with mobile number">
          <div><label className={label} htmlFor="phone">Mobile number</label><input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} /></div>
          <p className="text-sm text-mist">By continuing you agree to the <Link href="/legal/terms" className="underline">Terms</Link> and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.</p>
          {error && <p role="alert" className="text-sm text-rose">{error}</p>}
          <button disabled={busy} className={btn}>{busy ? "Sending code" : "Send code"}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4" aria-label="Enter verification code">
          <p role="status" className="text-sm text-mist">{note}</p>
          <div><label className={label} htmlFor="code">Verification code</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${input} tracking-[0.4em]`} /></div>
          {error && <p role="alert" className="text-sm text-rose">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button disabled={busy || code.length !== 6} className={btn}>{busy ? "Checking" : "Log in"}</button>
            <button type="button" disabled={busy} onClick={() => sendCode()} className={btnGhost}>Resend code</button>
            <button type="button" onClick={() => { setStep("phone"); setCode(""); setError(null); }} className={btnGhost}>Change number</button>
          </div>
        </form>
      )}
    </div>
  );
}
