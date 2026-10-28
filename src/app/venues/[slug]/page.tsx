import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getVenue } from "@/server/explore/venues";
import { getCurrentUser } from "@/server/current-user";
import { AppError } from "@/lib/errors";
import { categoryLabel, formatDateTime } from "@/lib/format";
import { ReservationForm } from "@/components/ReservationForm";
import { OrderPanel } from "@/components/OrderPanel";
import { Clock, MapPin, Sparkles, CalendarDays } from "lucide-react";
import { Chip, Panel, SectionTitle } from "@/components/ui";
import { Gallery } from "@/components/Gallery";
import { venueGallery } from "@/content/photos";

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
    <div className="pt-6 sm:pt-8">
      <Gallery images={venueGallery(venue)} alt={venue.name.replace(/\s*\[Demo\]$/, "")} label={venue.name} />
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Chip>{categoryLabel[venue.category]}</Chip>
        <Chip tone="neutral">{venue.neighbourhood}</Chip>
        {venue.dineInEnabled && <Chip tone="jade">Order at your table</Chip>}
      </div>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{venue.name.replace(/\s*\[Demo\]$/, "")}</h1>
      {venue.cuisines.length > 0 && <p className="mt-2 text-mist">{venue.cuisines.join(", ")}</p>}
      {venue.description && <p className="mt-4 max-w-prose text-snow/90">{venue.description}</p>}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Panel><p className="flex items-center gap-2 font-display text-lg font-semibold"><MapPin className="h-4 w-4 text-gold" aria-hidden="true" /> Address</p><p className="mt-2 text-mist">{venue.address}</p></Panel>
        <Panel><p className="flex items-center gap-2 font-display text-lg font-semibold"><Clock className="h-4 w-4 text-gold" aria-hidden="true" /> Hours</p>{hours.length ? <ul className="mt-2 text-mist">{hours.map(([d, h]) => <li key={d}>{d}: {h}</li>)}</ul> : <p className="mt-2 text-mist">Hours haven&apos;t been listed yet.</p>}</Panel>
        <Panel><p className="flex items-center gap-2 font-display text-lg font-semibold"><Sparkles className="h-4 w-4 text-gold" aria-hidden="true" /> Amenities</p>{venue.amenities.length ? <ul className="mt-3 flex flex-wrap gap-2">{venue.amenities.map((a) => <li key={a}><Chip tone="neutral">{a}</Chip></li>)}</ul> : <p className="mt-2 text-mist">None listed.</p>}</Panel>
      </div>

      {branches.length > 0 && <section className="mt-10"><SectionTitle>Branches</SectionTitle><ul className="space-y-2">{branches.map((b) => <li key={b.id} className="text-mist"><span className="text-snow">{b.name}</span>, {b.address}</li>)}</ul></section>}
      {offers.length > 0 && <section className="mt-10"><SectionTitle>Offers</SectionTitle><ul className="grid gap-3 sm:grid-cols-2">{offers.map((o) => <li key={o.id} className="rounded-2xl border border-gold/30 bg-gold/5 p-4"><p className="font-semibold text-gold">{o.title}</p>{o.description && <p className="mt-1 text-sm text-mist">{o.description}</p>}</li>)}</ul></section>}
      {events.length > 0 && (
        <section className="mt-10">
          <SectionTitle>Upcoming events</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {events.map((e) => (
              <li key={e.slug}>
                <Link href={`/events/${e.slug}`} className="flex items-center gap-3 rounded-2xl border border-snow/10 bg-panel p-4 hover:border-gold/60">
                  <CalendarDays className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
                  <span><span className="block font-semibold">{e.title.replace(/\s*\[Demo\]$/, "")}</span><span className="block text-sm text-mist">{formatDateTime(e.startsAt)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OrderPanel venueSlug={venue.slug} loggedIn={!!user} dineIn={venue.dineInEnabled} sessionsEnabled={venue.tableSessionsEnabled}
            categories={menu.categories.map((c) => ({ id: c.id, name: c.name }))}
            items={menu.items.map((i) => ({ id: i.id, name: i.name, description: i.description, pricePaise: i.pricePaise, available: i.available, containsAlcohol: i.containsAlcohol, categoryId: i.categoryId }))} />
        </div>
        <div><ReservationForm venueSlug={venue.slug} loggedIn={!!user} /></div>
      </div>
    </div>
  );
}
