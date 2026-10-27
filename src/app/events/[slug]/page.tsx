import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEvent } from "@/server/explore/venues";
import { getCurrentUser } from "@/server/current-user";
import { AppError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { TicketPicker } from "@/components/TicketPicker";

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
    <div className="grid gap-10 pt-10 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <p className="text-brass">{formatDateTime(event.startsAt)}</p>
        <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">{event.title.replace(/\s*\[Demo\]$/, "")}</h1>
        <p className="mt-3 text-ash">at <Link href={`/venues/${venue.slug}`} className="text-paper underline decoration-brass underline-offset-4">{venue.name.replace(/\s*\[Demo\]$/, "")}</Link></p>
        {event.description && <p className="mt-6 max-w-prose leading-relaxed">{event.description}</p>}
      </div>
      <div className="lg:col-span-2"><TicketPicker eventId={event.id} eventSlug={event.slug} types={ticketTypes} loggedIn={!!user} /></div>
    </div>
  );
}
