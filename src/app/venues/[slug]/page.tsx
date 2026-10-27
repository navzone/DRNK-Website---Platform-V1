import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getVenue } from "@/server/explore/venues";
import { getCurrentUser } from "@/server/current-user";
import { AppError } from "@/lib/errors";
import { categoryLabel, formatDateTime } from "@/lib/format";
import { ReservationForm } from "@/components/ReservationForm";
import { OrderPanel } from "@/components/OrderPanel";
import { Panel, VenueArt } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try { return { title: (await getVenue((await params).slug)).venue.name.replace(/\s*\[Demo\]$/, "") }; } catch { return { title: "Venue" }; }
}

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let data;
  try { data = await getVenue(slug); } catch (e) { if (e instanceof AppError && e.status === 404) notFound(); throw e; }
  const user = await getCurrentUser();
  const { venue, branches, offers, menu, events } = data;
  const hours = venue.hours && typeof venue.hours === "object" ? Object.entries(venue.hours as Record<string, string>) : [];
  return (
    <div className="pt-10">
      <VenueArt name={venue.name} category={venue.category} />
      <h1 className="mt-6 font-display text-4xl font-bold sm:text-5xl">{venue.name.replace(/\s*\[Demo\]$/, "")}</h1>
      <p className="mt-2 text-ash">{categoryLabel[venue.category]}, {venue.neighbourhood}. {venue.cuisines.join(", ")}</p>
      {venue.description && <p className="mt-4 max-w-prose">{venue.description}</p>}

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <Panel><p className="font-display text-lg">Address</p><p className="mt-2 text-ash">{venue.address}</p></Panel>
        <Panel><p className="font-display text-lg">Hours</p>{hours.length ? <ul className="mt-2 text-ash">{hours.map(([d, h]) => <li key={d}>{d}: {h}</li>)}</ul> : <p className="mt-2 text-ash">Hours haven&apos;t been listed yet.</p>}</Panel>
        <Panel><p className="font-display text-lg">Amenities</p>{venue.amenities.length ? <ul className="mt-2 text-ash">{venue.amenities.map((a) => <li key={a}>{a}</li>)}</ul> : <p className="mt-2 text-ash">None listed.</p>}</Panel>
      </div>

      {branches.length > 0 && <section className="mt-10"><h2 className="font-display text-3xl">Branches</h2><ul className="mt-3 space-y-2">{branches.map((b) => <li key={b.id} className="text-ash"><span className="text-paper">{b.name}</span>, {b.address}</li>)}</ul></section>}
      {offers.length > 0 && <section className="mt-10"><h2 className="font-display text-3xl">Offers</h2><ul className="mt-3 space-y-2">{offers.map((o) => <li key={o.id}><span className="text-brass">{o.title}</span>{o.description && <span className="text-ash"> {o.description}</span>}</li>)}</ul></section>}
      {events.length > 0 && <section className="mt-10"><h2 className="font-display text-3xl">Upcoming events</h2><ul className="mt-3 space-y-2">{events.map((e) => <li key={e.slug}><Link href={`/events/${e.slug}`} className="text-brass hover:underline">{e.title.replace(/\s*\[Demo\]$/, "")}</Link> <span className="text-ash">{formatDateTime(e.startsAt)}</span></li>)}</ul></section>}

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OrderPanel venueSlug={venue.slug} loggedIn={!!user} dineIn={venue.dineInEnabled} sessionsEnabled={venue.tableSessionsEnabled}
            items={menu.items.map((i) => ({ id: i.id, name: i.name, description: i.description, pricePaise: i.pricePaise, available: i.available, containsAlcohol: i.containsAlcohol }))} />
        </div>
        <div><ReservationForm venueSlug={venue.slug} loggedIn={!!user} /></div>
      </div>
    </div>
  );
}
