import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LEGAL_PAGES, legalBySlug } from "@/content/legal";
import { PageTitle } from "@/components/ui";

export function generateStaticParams() {
  return LEGAL_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = legalBySlug((await params).slug);
  return { title: page?.title ?? "Policy" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = legalBySlug((await params).slug);
  if (!page) notFound();
  return (
    <article className="max-w-prose">
      <PageTitle title={page.title} sub={page.summary} />
      <p role="note" className="mb-8 rounded-lg border border-gold/40 bg-panel p-4 text-sm text-gold">Draft for review. Not legal advice. Items in square brackets must be supplied by DRNK and reviewed by qualified Indian legal counsel before launch.</p>
      {page.sections.map((s) => (
        <section key={s.heading} className="mb-8">
          <h2 className="font-display text-2xl">{s.heading}</h2>
          {s.body.map((b, i) => <p key={i} className="mt-2 leading-relaxed text-snow/85">{b}</p>)}
        </section>
      ))}
      {page.slug === "data-requests" && <Link href="/account" className="inline-block rounded-full bg-gold text-ink px-5 py-2.5 font-medium hover:bg-gold-hi">Go to my account</Link>}
    </article>
  );
}
