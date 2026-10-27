import Link from "next/link";
import type { Metadata } from "next";
import { searchVenues } from "@/server/explore/venues";
import { VenueCard } from "@/components/VenueCard";
import { EmptyState, ErrorState, PageTitle, input, label, btn, btnGhost, pill, pillActive } from "@/components/ui";
import { categoryLabel } from "@/lib/format";
import { qs } from "@/lib/qs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Explore venues" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Explore({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const params = { q: one(sp.q), category: one(sp.category), cuisine: one(sp.cuisine), neighbourhood: one(sp.neighbourhood), dineIn: one(sp.dineIn), sort: one(sp.sort), page: one(sp.page) };
  let result: Awaited<ReturnType<typeof searchVenues>> | null = null;
  let invalid = false;
  let failed = false;
  try {
    result = await searchVenues(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") invalid = true;
    else failed = true;
  }
  const page = result?.page ?? 1;
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const link = (p: number) => `/explore${qs({ ...params, page: p === 1 ? undefined : p })}`;

  return (
    <>
      <PageTitle tag="DINE-IN" title="Venues in Bengaluru" sub="Reserve a table, or order at your table where a venue offers it." />
      <nav aria-label="Venue types" className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <Link href={`/explore${qs({ ...params, category: undefined, page: undefined })}`} className={!params.category ? pillActive : pill}>All venues</Link>
        {Object.entries(categoryLabel).map(([k, v]) => <Link key={k} href={`/explore${qs({ ...params, category: k, page: undefined })}`} className={params.category === k ? pillActive : pill}>{v}</Link>)}
      </nav>
      <form method="get" className="mb-8 grid gap-4 rounded-2xl border border-snow/10 bg-panel p-5 sm:grid-cols-2 lg:grid-cols-4" role="search">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={params.q} placeholder="Name, cuisine or neighbourhood" className={input} />
        </div>
        <div>
          <label className={label} htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={params.category ?? ""} className={input}>
            <option value="">All</option>
            {Object.entries(categoryLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="sort">Sort</label>
          <select id="sort" name="sort" defaultValue={params.sort ?? "name"} className={input}>
            <option value="name">Name</option>
            <option value="newest">Newest</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="cuisine">Cuisine</label>
          <input id="cuisine" name="cuisine" defaultValue={params.cuisine} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="neighbourhood">Neighbourhood</label>
          <input id="neighbourhood" name="neighbourhood" defaultValue={params.neighbourhood} className={input} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm"><input type="checkbox" name="dineIn" value="true" defaultChecked={params.dineIn === "true"} className="h-4 w-4 accent-[#facc15]" /> Dine-in ordering</label>
        <div className="flex items-end gap-3">
          <button className={btn}>Apply filters</button>
          <Link href="/explore" className={btnGhost}>Clear</Link>
        </div>
      </form>

      {failed && <ErrorState retryHref={link(page)} />}
      {invalid && <ErrorState title="Those filters aren't valid" body="Clear the filters and try again." retryHref="/explore" />}
      {result && result.items.length === 0 && (
        <EmptyState title="No venues match" body="Try fewer filters or a different spelling." action={<Link href="/explore" className={btn}>Clear filters</Link>} />
      )}
      {result && result.items.length > 0 && (
        <>
          <p className="mb-4 text-sm text-mist" aria-live="polite">{result.total} {result.total === 1 ? "venue" : "venues"}</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((v) => (
              <li key={v.slug}><VenueCard v={v} /></li>
            ))}
          </ul>
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-8 flex items-center gap-4">
              {page > 1 ? <Link href={link(page - 1)} className={btnGhost}>Previous</Link> : <span />}
              <span className="text-sm text-mist">Page {page} of {pages}</span>
              {page < pages && <Link href={link(page + 1)} className={btnGhost}>Next</Link>}
            </nav>
          )}
        </>
      )}
    </>
  );
}
