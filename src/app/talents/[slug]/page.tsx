import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTalent } from "@/server/talent/service";
import { getCurrentUser } from "@/server/current-user";
import { AppError } from "@/lib/errors";
import { EnquiryForm } from "@/components/EnquiryForm";

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
    <div className="grid gap-10 pt-10 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <p className="text-brass">{kinds[t.kind]}</p>
        <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">{t.stageName.replace(/\s*\[Demo\]$/, "")}</h1>
        <p className="mt-3 text-ash">{t.genres.join(", ")}</p>
        {t.bio && <p className="mt-6 max-w-prose leading-relaxed">{t.bio}</p>}
        <p className="mt-6 text-ash">{t.availabilityNote ?? "Availability is confirmed by the talent after you send an enquiry."}</p>
        {t.mediaUrl && <p className="mt-4"><a href={t.mediaUrl} rel="noopener noreferrer" target="_blank" className="text-brass underline">Listen or watch</a></p>}
      </div>
      <div className="lg:col-span-2"><EnquiryForm slug={t.slug} loggedIn={!!user} /></div>
    </div>
  );
}
