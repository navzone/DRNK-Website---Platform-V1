import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/server/current-user";
import { history, rewardsSummary, listSupportTickets, listDataRequests } from "@/server/account/service";
import { listOwnEnquiries } from "@/server/talent/service";
import { formatDateTime, formatINR } from "@/lib/format";
import { maskPhone } from "@/lib/phone";
import { PageTitle } from "@/components/ui";
import { LogoutButton, PrivacyActions, ProfileForm, Section, SupportForm } from "@/components/AccountForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account" };

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-ash">{children}</p>;

export default async function Account() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const [h, rewards, tickets, requests, enquiries] = await Promise.all([history(user.id), rewardsSummary(user.id), listSupportTickets(user.id), listDataRequests(user.id), listOwnEnquiries(user.id)]);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title={user.displayName ? `Hi, ${user.displayName}` : "Your account"} sub={`Signed in as ${maskPhone(user.phoneE164)}`} />
        <LogoutButton />
      </div>

      <Section title="Profile"><ProfileForm displayName={user.displayName} email={user.email} /></Section>

      <Section title="Rewards">
        <p>Tier: {rewards.tier ? <strong className="text-brass">{rewards.tier.name}</strong> : <span className="text-ash">Not assigned yet</span>}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><p className="text-sm text-ash">DRNK Points</p><p className="font-display text-3xl">{rewards.points.balance}</p></div>
          <div><p className="text-sm text-ash">Alcometer credits</p><p className="font-display text-3xl">{rewards.alcometer.balance}</p></div>
        </div>
        <p className="mt-3 text-sm text-ash">Points and Alcometer credits are tracked separately. They aren&apos;t money. See the <Link href="/legal/rewards-terms" className="underline">rewards terms</Link>.</p>
        {rewards.points.recent.length > 0 && <ul className="mt-4 space-y-1 text-sm">{rewards.points.recent.map((r, i) => <li key={i} className="flex justify-between"><span>{r.reason}</span><span className={r.delta < 0 ? "text-ember-hi" : "text-brass"}>{r.delta > 0 ? "+" : ""}{r.delta}</span></li>)}</ul>}
      </Section>

      <Section title="Event bookings">
        {h.bookings.length === 0 ? <Empty>No bookings yet. <Link href="/events" className="text-brass underline">Browse events</Link>.</Empty> : (
          <ul className="space-y-2">{h.bookings.map((b) => <li key={b.id} className="flex justify-between gap-4"><Link href={`/bookings/${b.ref}`} className="text-brass hover:underline">{b.ref}</Link><span className="text-ash">{b.status.replace("_", " ")}, {formatINR(b.totalPaise)}</span></li>)}</ul>
        )}
      </Section>

      <Section title="Reservations">
        {h.reservations.length === 0 ? <Empty>No reservations yet.</Empty> : (
          <ul className="space-y-2">{h.reservations.map((r) => <li key={r.id} className="flex justify-between gap-4"><span>{r.ref}, {r.partySize} guests</span><span className="text-ash">{formatDateTime(r.slotAt)}, {r.status.replace("_", " ")}</span></li>)}</ul>
        )}
      </Section>

      <Section title="Orders">
        {h.orders.length === 0 ? <Empty>No orders yet.</Empty> : (
          <ul className="space-y-2">{h.orders.map((o) => <li key={o.id} className="flex justify-between gap-4"><span>{o.ref}</span><span className="text-ash">{o.status}, {formatINR(o.totalPaise)}</span></li>)}</ul>
        )}
      </Section>

      <Section title="Talent enquiries">
        {enquiries.length === 0 ? <Empty>No enquiries yet.</Empty> : (
          <ul className="space-y-3">{enquiries.map(({ e, stageName }) => <li key={e.id}><p>{stageName.replace(/\s*\[Demo\]$/, "")}: <span className="text-brass">{e.status}</span></p>{e.response && <p className="text-sm text-ash">Reply: {e.response}</p>}</li>)}</ul>
        )}
      </Section>

      <Section title="Support">
        <SupportForm />
        {tickets.length > 0 && <ul className="mt-6 space-y-2 border-t border-paper/10 pt-4">{tickets.map((t) => <li key={t.id} className="flex justify-between gap-4"><span>{t.subject}</span><span className="text-ash">{t.status.replace("_", " ")}</span></li>)}</ul>}
      </Section>

      <Section title="Privacy">
        <PrivacyActions />
        {requests.length > 0 && <ul className="mt-4 space-y-1 text-sm text-ash">{requests.map((r) => <li key={r.id}>{r.kind === "export" ? "Data copy" : "Account deletion"}: {r.status.replace("_", " ")}</li>)}</ul>}
        <p className="mt-4 text-sm text-ash">Read the <Link href="/legal/privacy" className="underline">Privacy Policy</Link> and <Link href="/legal/data-requests" className="underline">how data requests work</Link>.</p>
      </Section>
    </>
  );
}
