import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getBookingForUser } from "@/server/events/booking";
import { getCurrentUser } from "@/server/current-user";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { formatDateTime, formatINR } from "@/lib/format";
import { BookingActions } from "@/components/BookingActions";
import { PageTitle, Panel } from "@/components/ui";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking" };

const statusText: Record<string, string> = { pending_payment: "Waiting for payment", confirmed: "Confirmed", cancelled: "Cancelled", expired: "Expired" };

export default async function BookingPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/bookings/${ref}`);
  let data;
  try { data = await getBookingForUser(user.id, ref); } catch (e) { if (e instanceof AppError && e.status === 404) notFound(); throw e; }
  const { booking, lines, tickets, payments } = data;
  const [event] = await db.select({ title: schema.events.title, startsAt: schema.events.startsAt }).from(schema.events).where(eq(schema.events.id, booking.eventId));
  const e = env();
  const sandboxSimulator = (e.APP_ENV === "development" || e.APP_ENV === "test") && e.PAYMENT_PROVIDER === "fake-sandbox";
  return (
    <>
      <PageTitle title={statusText[booking.status] ?? booking.status} sub={`Booking ${booking.ref}`} />
      <Panel>
        <p className="font-display text-2xl">{event?.title.replace(/\s*\[Demo\]$/, "")}</p>
        {event && <p className="text-mist">{formatDateTime(event.startsAt)}</p>}
        <p className="mt-4 flex justify-between border-t border-snow/10 pt-4"><span>Total</span><span className="text-gold">{formatINR(booking.totalPaise)}</span></p>
        {booking.status === "pending_payment" && <p className="mt-2 text-sm text-mist">Held until {formatDateTime(booking.expiresAt)}. Unpaid bookings are released automatically.</p>}
        {booking.status === "expired" && <p className="mt-2 text-sm text-mist">This hold ran out and the tickets were released. If a payment was taken, it will be flagged for refund.</p>}
        <BookingActions bookingRef={booking.ref} status={booking.status} hasPendingPayment={payments.some((p) => p.status === "pending")} sandboxSimulator={sandboxSimulator} />
      </Panel>
      {payments.length > 0 && (
        <section className="mt-8"><h2 className="font-display text-2xl font-bold">Payments</h2>
          <ul className="mt-3 space-y-2">{payments.map((p) => <li key={p.ref} className="flex justify-between rounded-xl border border-snow/10 bg-panel p-3"><span>{p.ref}</span><span className="text-mist">{p.status}, {formatINR(p.amountPaise)}</span></li>)}</ul>
        </section>
      )}
      {tickets.length > 0 && (
        <section className="mt-8"><h2 className="font-display text-2xl font-bold">Your tickets</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">{tickets.map((t) => <li key={t.ref} className="flex items-center gap-4 rounded-2xl border border-dashed border-gold/50 bg-panel px-5 py-4"><span className="font-display text-xl text-gold">{t.ref}</span><span className="text-sm text-mist">{lines.length > 1 ? "" : "Admit one"}</span></li>)}</ul>
        </section>
      )}
    </>
  );
}
