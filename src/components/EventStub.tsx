import Link from "next/link";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { formatDateTime, formatINR } from "@/lib/format";

type Props = { slug: string; title: string; startsAt: Date | string; venueName: string; minPricePaise?: number | null };

/** Event card. Name kept as EventStub for existing imports. */
export function EventStub({ slug, title, startsAt, venueName, minPricePaise }: Props) {
  const d = new Date(startsAt);
  const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }).format(d);
  const month = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(d);
  const cleanTitle = title.replace(/\s*\[Demo\]$/, "");
  const cleanVenue = venueName.replace(/\s*\[Demo\]$/, "");
  const price = minPricePaise == null ? null : minPricePaise === 0 ? "Free entry" : `From ${formatINR(minPricePaise)}`;
  return (
    <Link href={`/events/${slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-snow/10 bg-panel transition-colors hover:border-gold/60">
      <div className="relative flex h-28 items-start justify-between bg-gradient-to-br from-[#2b2410] via-[#1a1830] to-panel p-4">
        <div className="rounded-xl border border-gold/40 bg-ink/70 px-3 py-1.5 text-center backdrop-blur">
          <span className="block font-display text-2xl font-extrabold leading-none text-gold">{day}</span>
          <span className="tag mt-0.5 block uppercase text-mist">{month}</span>
        </div>
        <Ticket className="h-6 w-6 text-gold/50" aria-hidden="true" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg font-semibold leading-snug group-hover:text-gold">{cleanTitle}</h3>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-mist"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {cleanVenue}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-mist"><CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {formatDateTime(d)}</p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="tag text-gold">{price ?? "Tickets"}</span>
          <span className="rounded-full bg-gold px-4 py-1.5 text-sm font-semibold text-ink">Book</span>
        </div>
      </div>
    </Link>
  );
}
