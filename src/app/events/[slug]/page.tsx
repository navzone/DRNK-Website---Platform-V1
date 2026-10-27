import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEvent } from "@/server/explore/venues";
import { getCurrentUser } from "@/server/current-user";
import { AppError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { MapPin } from "lucide-react";
import { TicketPicker } from "@/components/TicketPicker";
import { Chip } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try { return { title: (await getEvent((await params).slug)).event.title.replace(/\s*\[Demo\]$/, "") }; } catch { return { title: "Event" }; }
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let data;
  try { data = await getEvent(slug); } catch (e) { if (e instanceof AppError && e.status === 404) notFound(); throw e; }
  const user = await getCurrentUser();
  const { event, venue, ticketTypes } = data;
  return (
    <div className="grid gap-8 pt-6 sm:pt-8 lg:grid-cols-5 lg:gap-10">
      <div className="lg:col-span-3">
        <div className="flex h-36 items-end rounded-2xl bg-gradient-to-br from-[#2b2410] via-[#1a1830] to-panel p-5 sm:h-44">
          <Chip>{formatDateTime(event.startsAt)}</Chip>
        </div>
        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{event.title.replace(/\s*\[Demo\]$/, "")}</h1>
        <p className="mt-3 flex items-center gap-2 text-mist"><MapPin className="h-4 w-4 text-gold" aria-hidden="true" /> <Link href={`/venues/${venue.slug}`} className="text-snow underline decoration-gold underline-offset-4">{venue.name.replace(/\s*\[Demo\]$/, "")}</Link></p>
        {event.description && <p className="mt-6 max-w-prose leading-relaxed text-snow/90">{event.description}</p>}
      </div>
      <div className="lg:col-span-2"><TicketPicker eventId={event.id} eventSlug={event.slug} types={ticketTypes} loggedIn={!!user} /></div>
    </div>
  );
}
