import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/server/current-user";
import { history, rewardsSummary, listSupportTickets, listDataRequests } from "@/server/account/service";
import { listOwnEnquiries } from "@/server/talent/service";
import { formatDateTime, formatINR } from "@/lib/format";
import { maskPhone } from "@/lib/phone";
import { Chip, Panel } from "@/components/ui";
import { LogoutButton, PrivacyActions, ProfileForm, Section, SupportForm } from "@/components/AccountForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account" };

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-mist">{children}</p>;

export default async function Account() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const [h, rewards, tickets, requests, enquiries] = await Promise.all([history(user.id), rewardsSummary(user.id), listSupportTickets(user.id), listDataRequests(user.id), listOwnEnquiries(user.id)]);
  return (
    <>
      <Panel className="mt-6 sm:mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-gold/40 bg-gold/10 font-display text-2xl font-extrabold text-gold" aria-hidden="true">{(user.displayName?.trim()?.[0] ?? "D").toUpperCase()}</span>
            <div>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">{user.displayName ? `Hi, ${user.displayName}` : "Your account"}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-mist"><span className="tag">{maskPhone(user.phoneE164)}</span>{rewards.tier ? <Chip>{rewards.tier.name}</Chip> : <Chip tone="neutral">No tier yet</Chip>}</p>
            </div>
          </div>
          <LogoutButton />
        </div>
        <div className="mt-6 grid gap-3 border-t border-snow/10 pt-5 sm:grid-cols-2">
          <div className="rounded-xl border border-snow/10 bg-ink p-4"><p className="text-sm text-mist">DRNK Points</p><p className="mt-1 font-display text-3xl font-extrabold text-gold">{rewards.points.balance}</p></div>
          <div className="rounded-xl border border-snow/10 bg-ink p-4"><p className="text-sm text-mist">Alcometer credits</p><p className="mt-1 font-display text-3xl font-extrabold text-sky">{rewards.alcometer.balance}</p></div>
        </div>
        <p className="mt-3 text-sm text-mist">Points and Alcometer credits are tracked separately. They aren&apos;t money and have no rupee value. See the <Link href="/legal/rewards-terms" className="underline">rewards terms</Link>.</p>
        {rewards.points.recent.length > 0 && <ul className="mt-4 space-y-1 text-sm">{rewards.points.recent.map((r, i) => <li key={i} className="flex justify-between"><span>{r.reason}</span><span className={r.delta < 0 ? "text-rose" : "text-gold"}>{r.delta > 0 ? "+" : ""}{r.delta}</span></li>)}</ul>}
      </Panel>

      <Section title="Profile"><ProfileForm displayName={user.displayName} email={user.email} /></Section>

      <Section title="Event bookings">
        {h.bookings.length === 0 ? <Empty>No bookings yet. <Link href="/events" className="text-gold underline">Browse events</Link>.</Empty> : (
          <ul className="space-y-2">{h.bookings.map((b) => <li key={b.id} className="flex justify-between gap-4"><Link href={`/bookings/${b.ref}`} className="text-gold hover:underline">{b.ref}</Link><span className="text-mist">{b.status.replace("_", " ")}, {formatINR(b.totalPaise)}</span></li>)}</ul>
        )}
      </Section>

      <Section title="Reservations">
        {h.reservations.length === 0 ? <Empty>No reservations yet.</Empty> : (
          <ul className="space-y-2">{h.reservations.map((r) => <li key={r.id} className="flex justify-between gap-4"><span>{r.ref}, {r.partySize} guests</span><span className="text-mist">{formatDateTime(r.slotAt)}, {r.status.replace("_", " ")}</span></li>)}</ul>
        )}
      </Section>

      <Section title="Orders">
        {h.orders.length === 0 ? <Empty>No orders yet.</Empty> : (
          <ul className="space-y-2">{h.orders.map((o) => <li key={o.id} className="flex justify-between gap-4"><Link href={`/orders/${o.ref}`} className="text-gold underline">{o.ref}</Link><span className="text-mist">{o.status}, {formatINR(o.totalPaise)}</span></li>)}</ul>
        )}
      </Section>

      <Section title="Talent enquiries">
        {enquiries.length === 0 ? <Empty>No enquiries yet.</Empty> : (
          <ul className="space-y-3">{enquiries.map(({ e, stageName }) => <li key={e.id}><p>{stageName.replace(/\s*\[Demo\]$/, "")}: <span className="text-gold">{e.status}</span></p>{e.response && <p className="text-sm text-mist">Reply: {e.response}</p>}</li>)}</ul>
        )}
      </Section>

      <Section title="Support">
        <SupportForm />
        {tickets.length > 0 && <ul className="mt-6 space-y-2 border-t border-snow/10 pt-4">{tickets.map((t) => <li key={t.id} className="flex justify-between gap-4"><span>{t.subject}</span><span className="text-mist">{t.status.replace("_", " ")}</span></li>)}</ul>}
      </Section>

      <Section title="Privacy">
        <PrivacyActions />
        {requests.length > 0 && <ul className="mt-4 space-y-1 text-sm text-mist">{requests.map((r) => <li key={r.id}>{r.kind === "export" ? "Data copy" : "Account deletion"}: {r.status.replace("_", " ")}</li>)}</ul>}
        <p className="mt-4 text-sm text-mist">Read the <Link href="/legal/privacy" className="underline">Privacy Policy</Link> and <Link href="/legal/data-requests" className="underline">how data requests work</Link>.</p>
      </Section>
    </>
  );
}
