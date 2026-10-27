import Link from "next/link";
import { LEGAL_PAGES } from "@/content/legal";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-paper/10 text-sm text-ash">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="font-display text-xl text-paper">DRNK</p>
        <p className="mt-1">Bengaluru. Venues, events and talent.</p>
        <nav aria-label="Legal" className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
          {LEGAL_PAGES.map((p) => (
            <Link key={p.slug} href={`/legal/${p.slug}`} className="hover:text-paper">{p.title}</Link>
          ))}
        </nav>
        <p className="mt-8">Draft policies are placeholders and need review by qualified Indian legal counsel before launch.</p>
      </div>
    </footer>
  );
}
