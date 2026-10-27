import Link from "next/link";
import { LEGAL_PAGES } from "@/content/legal";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-snow/10 text-sm text-mist">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <p className="font-display text-2xl font-extrabold text-gold">DRNK</p>
        <p className="tag mt-1">DRINK. REFILL. NETWORK.</p>
        <p className="mt-3 max-w-prose">Venues, events and talent in Bengaluru.</p>
        <nav aria-label="Legal" className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
          {LEGAL_PAGES.map((p) => (
            <Link key={p.slug} href={`/legal/${p.slug}`} className="hover:text-snow">{p.title}</Link>
          ))}
        </nav>
        <p className="mt-8 max-w-prose">Draft policies are placeholders and need review by qualified Indian legal counsel before launch.</p>
        <p className="mt-2 max-w-prose">Alcohol is for adults of legal drinking age only. Please drink responsibly.</p>
      </div>
    </footer>
  );
}
