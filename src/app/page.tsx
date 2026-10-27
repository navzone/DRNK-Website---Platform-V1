import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { homeSummary, listEvents, searchVenues } from "@/server/explore/venues";
import { searchTalent } from "@/server/talent/service";
import { EventStub } from "@/components/EventStub";
import { VenueCard } from "@/components/VenueCard";
import { TalentCard } from "@/components/TalentCard";
import { EmptyState, pill } from "@/components/ui";
import { categoryLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

function SectionHead({ title, sub, href, cta }: { title: string; sub?: string; href: string; cta: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl font-bold sm:text-3xl">{title}</h2>
        {sub && <p className="mt-1 text-sm text-mist">{sub}</p>}
      </div>
      <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-gold hover:underline">{cta} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
    </div>
  );
}

export default async function Home() {
  const [summary, events, venues, talents] = await Promise.all([
    homeSummary().catch(() => null),
    listEvents({ pageSize: 3 }).then((r) => r.items).catch(() => null),
    searchVenues({ pageSize: 6 }).then((r) => r.items).catch(() => null),
    searchTalent({ pageSize: 6 }).then((r) => r.items).catch(() => null),
  ]);
  const stats = summary ? [
    { n: summary.venues, l: "Venues" },
    { n: summary.events, l: "Upcoming events" },
    { n: summary.talents, l: "Artists" },
  ] : [];
  return (
    <>
      <section className="mt-6 overflow-hidden rounded-3xl border border-snow/10 bg-gradient-to-br from-[#1b1730] via-panel to-ink p-6 sm:mt-8 sm:p-10">
        <p className="tag text-gold">BENGALURU</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">Where Bengaluru goes tonight.</h1>
        <p className="mt-4 max-w-xl text-base text-snow/80 sm:text-lg">Reserve a table, order at your table, book event tickets and meet the DJs and bands behind the night.</p>
        <form action="/explore" role="search" className="mt-7 flex max-w-2xl items-center gap-2 rounded-full border border-snow/15 bg-ink/70 p-1.5 pl-5 focus-within:border-gold">
          <Search className="h-5 w-5 shrink-0 text-mist" aria-hidden="true" />
          <label htmlFor="home-q" className="sr-only">Search venues</label>
          <input id="home-q" name="q" placeholder="Search venues or areas" className="w-full bg-transparent py-2 text-snow outline-none placeholder:text-mist/70" />
          <button className="shrink-0 rounded-full bg-gold px-6 py-2.5 font-semibold text-ink hover:bg-gold-hi">Search</button>
        </form>
        {summary && summary.neighbourhoods.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="tag mr-1 text-mist">AREA</span>
            {summary.neighbourhoods.map((n) => <Link key={n} href={`/explore?neighbourhood=${encodeURIComponent(n)}`} className={pill}>{n}</Link>)}
          </div>
        )}
        {stats.length > 0 && (
          <dl className="mt-8 grid max-w-xl grid-cols-3 gap-4 border-t border-snow/10 pt-6">
            {stats.map((s) => (
              <div key={s.l}>
                <dd className="font-display text-3xl font-extrabold text-gold">{s.n}</dd>
                <dt className="mt-0.5 text-sm text-mist">{s.l}</dt>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="mt-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label="Venue types">
        <Link href="/explore" className={pill}>All venues</Link>
        {Object.entries(categoryLabel).map(([k, v]) => <Link key={k} href={`/explore?category=${k}`} className={pill}>{v}</Link>)}
        <Link href="/explore?dineIn=true" className={pill}>Order at table</Link>
      </section>

      <section className="mt-12">
        <SectionHead title="Coming up" sub="Upcoming nights at approved venues." href="/events" cta="All events" />
        {events === null ? <EmptyState title="Events didn't load" body="Refresh the page to try again." />
          : events.length === 0 ? <EmptyState title="No events listed yet" body="New events appear here once venues publish them." />
          : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{events.map((e) => <EventStub key={e.slug} {...e} />)}</div>}
      </section>

      <section className="mt-14">
        <SectionHead title="Venues" sub="Restaurants, pubs and microbreweries." href="/explore" cta="Browse all" />
        {venues === null ? <EmptyState title="Venues didn't load" body="Refresh the page to try again." />
          : venues.length === 0 ? <EmptyState title="No venues yet" body="Approved venues appear here." />
          : <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{venues.map((v) => <li key={v.slug}><VenueCard v={v} /></li>)}</ul>}
      </section>

      <section className="mt-14">
        <SectionHead title="Talent and gigs" sub="DJs, KJs and bands you can book." href="/talents" cta="See all talent" />
        {talents === null ? <EmptyState title="Talent didn't load" body="Refresh the page to try again." />
          : talents.length === 0 ? <EmptyState title="No talent listed yet" body="Approved artists appear here." />
          : <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{talents.map((t) => <li key={t.slug}><TalentCard t={t} /></li>)}</ul>}
      </section>
    </>
  );
}
