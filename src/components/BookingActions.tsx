"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { btn, btnGhost } from "@/components/ui";

type Checkout = { sandbox?: boolean; provider?: string };

export function BookingActions({ bookingRef, status, hasPendingPayment, sandboxSimulator }: { bookingRef: string; status: string; hasPendingPayment: boolean; sandboxSimulator: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [sandbox, setSandbox] = useState(false);

  // Status always comes from the server. While a payment is pending, re-read it every few seconds.
  useEffect(() => {
    if (status !== "pending_payment" || !hasPendingPayment) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [status, hasPendingPayment, router]);

  async function pay() {
    setBusy(true); setError(null); setInfo(null);
    const res = await api<{ paymentRef: string; checkout: Checkout }>(`/api/bookings/${bookingRef}/pay`, { method: "POST", body: {} });
    setBusy(false);
    if (!res.ok) { setError(res.message); return; }
    setPaymentRef(res.data.paymentRef);
    setSandbox(!!res.data.checkout.sandbox);
    setInfo(res.data.checkout.sandbox ? "Sandbox payment started. No real money moves." : "Payment started. Your booking is confirmed only when the payment provider confirms it.");
    router.refresh();
  }
  async function simulate(outcome: "captured" | "failed") {
    if (!paymentRef) return;
    setBusy(true); setError(null);
    const res = await api("/api/dev/simulate-payment", { body: { paymentRef, outcome } });
    setBusy(false);
    if (!res.ok) setError(res.message); else { setInfo(null); router.refresh(); }
  }
  async function cancel() {
    if (!window.confirm("Cancel this booking and release your tickets?")) return;
    setBusy(true); setError(null);
    const res = await api(`/api/bookings/${bookingRef}/cancel`, { method: "POST", body: {} });
    setBusy(false);
    if (!res.ok) setError(res.message); else router.refresh();
  }
  if (status !== "pending_payment") return null;
  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} onClick={pay} className={btn}>{hasPendingPayment ? "Start a new payment" : "Pay now"}</button>
        <button disabled={busy} onClick={cancel} className={btnGhost}>Cancel booking</button>
      </div>
      {info && <p role="status" className="text-sm text-brass">{info}</p>}
      {sandboxSimulator && paymentRef && sandbox && (
        <div className="rounded-lg border border-brass/40 p-3 text-sm">
          <p className="text-brass">Development sandbox only. These buttons send a signed test webhook through the real processing path.</p>
          <div className="mt-2 flex gap-2"><button disabled={busy} onClick={() => simulate("captured")} className={btn}>Simulate successful payment</button><button disabled={busy} onClick={() => simulate("failed")} className={btnGhost}>Simulate failed payment</button></div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-ember-hi">{error}</p>}
    </div>
  );
}
