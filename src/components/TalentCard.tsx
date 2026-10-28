import Link from "next/link";
import { Chip } from "./ui";
import { ResilientImage } from "./ResilientImage";
import { talentPhotos } from "@/content/photos";

export const talentKinds = { dj: "DJ", kj: "KJ", band: "Band", other: "Artist" } as const;

export function TalentCard({ t }: { t: { slug: string; stageName: string; kind: keyof typeof talentKinds; genres: string[] } }) {
  const name = t.stageName.replace(/\s*\[Demo\]$/, "");
  return (
    <Link href={`/talents/${t.slug}`} className="group flex h-full items-center gap-4 rounded-2xl border border-snow/10 bg-panel p-4 transition-colors hover:border-gold/60">
      <ResilientImage src={talentPhotos(t).profile} label={name} fallbackClass="items-center justify-center text-xl" className="h-16 w-16 shrink-0 rounded-full border border-gold/40" />
      <span className="min-w-0">
        <span className="block truncate font-display text-lg font-semibold group-hover:text-gold">{name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2"><Chip>{talentKinds[t.kind]}</Chip><span className="truncate text-sm text-mist">{t.genres.join(", ")}</span></span>
      </span>
    </Link>
  );
}
