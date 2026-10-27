import Link from "next/link";
import { listEvents } from "@/server/explore/venues";
import { EventStub } from "@/components/EventStub";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  let events: Awaited<ReturnType<typeof listEvents>>["items"] = [];
  let failed = false;
  try {
    events = (await listEvents({ pageSize: 4 })).items;
  } catch {
    failed = true;
  }
  return (
    <>
      <section className="pb-6 pt-14 sm:pt-20">
        <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">Where Bengaluru<br />goes tonight.</h1>
        <p className="mt-6 max-w-xl text-lg text-paper/80">Find a table, book event tickets and meet the DJs and bands behind the night. Pubs, microbreweries and restaurants across Bengaluru.</p>
        <form action="/explore" className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row" role="search">
          <label htmlFor="home-q" className="sr-only">Search venues</label>
          <input id="home-q" name="q" placeholder="Venue, cuisine or neighbourhood" className="w-full rounded-full border border-paper/20 bg-smoke px-5 py-3 placeholder:text-ash/70 focus:border-brass" />
          <button className="rounded-full bg-ember px-7 py-3 font-medium hover:bg-ember-hi">Search</button>
        </form>
        <p className="mt-3 text-sm text-ash">Currently in Bengaluru only.</p>
      </section>

      <section className="mt-14">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-display text-3xl">Coming up</h2>
          <Link href="/events" className="text-sm text-brass hover:underline">All events</Link>
        </div>
        {failed ? (
          <EmptyState title="Events didn't load" body="Refresh the page to try again." />
        ) : events.length === 0 ? (
          <EmptyState title="No events listed yet" body="New events appear here once venues publish them. Browse venues in the meantime." action={<Link href="/explore" className="rounded-full bg-ember px-5 py-2.5 font-medium hover:bg-ember-hi">Explore venues</Link>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">{events.map((e) => <EventStub key={e.slug} {...e} />)}</div>
        )}
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          { href: "/explore", t: "Find a venue", d: "Filter by category, cuisine and neighbourhood, then reserve or order at the table." },
          { href: "/events", t: "Get tickets", d: "Pick your ticket type. Your booking is held while you pay." },
          { href: "/talents", t: "Book talent", d: "Send an enquiry to a DJ, KJ or band and get a reply in your account." },
        ].map((x) => (
          <Link key={x.href} href={x.href} className="rounded-xl border border-paper/10 p-5 hover:border-brass">
            <p className="font-display text-xl">{x.t}</p>
            <p className="mt-2 text-sm text-ash">{x.d}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
