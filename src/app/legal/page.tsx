import Link from "next/link";
import type { Metadata } from "next";
import { LEGAL_PAGES } from "@/content/legal";
import { PageTitle, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "Policies" };

export default function LegalIndex() {
  return (
    <>
      <PageTitle title="Policies" sub="Draft pages. Details marked as required from DRNK are not filled in yet." />
      <div className="grid gap-3 sm:grid-cols-2">
        {LEGAL_PAGES.map((p) => (
          <Link key={p.slug} href={`/legal/${p.slug}`}>
            <Panel className="h-full hover:border-gold"><p className="font-display text-xl">{p.title}</p><p className="mt-1 text-mist">{p.summary}</p></Panel>
          </Link>
        ))}
      </div>
    </>
  );
}
