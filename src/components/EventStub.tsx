import Link from "next/link";
import { formatDateTime } from "@/lib/format";

export function EventStub({ slug, title, startsAt, venueName }: { slug: string; title: string; startsAt: Date | string; venueName: string }) {
  const d = new Date(startsAt);
  const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }).format(d);
  const month = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(d);
  return (
    <Link href={`/events/${slug}`} className="stub flex items-stretch transition-colors hover:bg-[#2f2d2a]">
      <div className="flex w-24 shrink-0 flex-col items-center justify-center px-3 py-5">
        <span className="font-display text-4xl font-bold leading-none text-brass">{day}</span>
        <span className="mt-1 text-sm text-ash">{month}</span>
      </div>
      <div className="perf my-3 w-px" aria-hidden="true" />
      <div className="flex-1 px-5 py-5">
        <p className="font-display text-xl leading-snug">{title.replace(/\s*\[Demo\]$/, "")}</p>
        <p className="mt-1 text-sm text-ash">{venueName.replace(/\s*\[Demo\]$/, "")}, {formatDateTime(d)}</p>
      </div>
    </Link>
  );
}
