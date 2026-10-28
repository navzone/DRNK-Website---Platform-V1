import Link from "next/link";
import { MapPin, UtensilsCrossed } from "lucide-react";
import { categoryLabel } from "@/lib/format";
import { Chip } from "./ui";
import { ResilientImage } from "./ResilientImage";
import { venueGallery } from "@/content/photos";

type V = { slug: string; name: string; category: string; cuisines: string[]; neighbourhood: string; dineInEnabled: boolean; imageUrl?: string | null };

export function VenueCard({ v }: { v: V }) {
  const name = v.name.replace(/\s*\[Demo\]$/, "");
  return (
    <Link href={`/venues/${v.slug}`} className="group block h-full overflow-hidden rounded-2xl border border-snow/10 bg-panel p-3 transition-colors hover:border-gold/60">
      <ResilientImage src={venueGallery(v, "card")[0]!} label={v.name} className="h-44 rounded-xl" />
      <div className="px-2 pb-2 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold leading-snug group-hover:text-gold">{name}</h3>
          <Chip tone="neutral">{categoryLabel[v.category] ?? v.category}</Chip>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-mist"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {v.neighbourhood}</p>
        {v.cuisines.length > 0 && <p className="mt-1 text-sm text-mist">{v.cuisines.join(", ")}</p>}
        {v.dineInEnabled && <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold"><UtensilsCrossed className="h-3.5 w-3.5" aria-hidden="true" /> Order at your table</p>}
      </div>
    </Link>
  );
}
