import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTalent } from "@/server/talent/service";
import { getCurrentUser } from "@/server/current-user";
import { AppError } from "@/lib/errors";
import { EnquiryForm } from "@/components/EnquiryForm";
import { Chip } from "@/components/ui";
import { ResilientImage } from "@/components/ResilientImage";
import { talentPhotos } from "@/content/photos";

export const dynamic = "force-dynamic";
const kinds = { dj: "DJ", kj: "KJ", band: "Band", other: "Other" } as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try { return { title: (await getTalent((await params).slug)).stageName.replace(/\s*\[Demo\]$/, "") }; } catch { return { title: "Talent" }; }
}

export default async function TalentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let t;
  try { t = await getTalent(slug); } catch (e) { if (e instanceof AppError && e.status === 404) notFound(); throw e; }
  const user = await getCurrentUser();
  return (
    <div className="grid gap-8 pt-6 sm:pt-8 lg:grid-cols-5 lg:gap-10">
      <div className="lg:col-span-3">
        <ResilientImage src={talentPhotos(t).cover} alt={`${t.stageName.replace(/\s*\[Demo\]$/, "")} performing`} label={t.stageName} className="aspect-[16/8] w-full rounded-2xl" priority />
        <div className="mt-6 flex items-center gap-5">
          <ResilientImage src={talentPhotos(t).profile} label={t.stageName} fallbackClass="items-center justify-center text-3xl" className="h-20 w-20 shrink-0 rounded-full border border-gold/40" />
          <div>
            <Chip>{kinds[t.kind]}</Chip>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{t.stageName.replace(/\s*\[Demo\]$/, "")}</h1>
          </div>
        </div>
        {t.genres.length > 0 && <ul className="mt-5 flex flex-wrap gap-2">{t.genres.map((g) => <li key={g}><Chip tone="neutral">{g}</Chip></li>)}</ul>}
        {t.bio && <p className="mt-6 max-w-prose leading-relaxed text-snow/90">{t.bio}</p>}
        <p className="mt-6 text-mist">{t.availabilityNote ?? "Availability is confirmed by the talent after you send an enquiry."}</p>
        {t.mediaUrl && <p className="mt-4"><a href={t.mediaUrl} rel="noopener noreferrer" target="_blank" className="font-medium text-gold underline">Listen or watch</a></p>}
      </div>
      <div className="lg:col-span-2"><EnquiryForm slug={t.slug} loggedIn={!!user} /></div>
    </div>
  );
}
