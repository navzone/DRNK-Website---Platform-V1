import Link from "next/link";
import type { Metadata } from "next";
import { searchTalent } from "@/server/talent/service";
import { EmptyState, ErrorState, PageTitle, Panel, btn, btnGhost, input, label } from "@/components/ui";
import { qs } from "@/lib/qs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Talent" };
const kinds = { dj: "DJ", kj: "KJ", band: "Band", other: "Other" } as const;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Talents({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const params = { kind: one(sp.kind), genre: one(sp.genre), q: one(sp.q), page: one(sp.page) };
  let result: Awaited<ReturnType<typeof searchTalent>> | null = null;
  let invalid = false;
  try { result = await searchTalent(Object.fromEntries(Object.entries(params).filter(([, v]) => v))); } catch (e) { invalid = e instanceof Error && e.name === "ZodError"; }
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  return (
    <>
      <PageTitle title="Talent" sub="DJs, KJs and bands approved by DRNK." />
      <form method="get" className="mb-8 grid gap-4 rounded-xl border border-paper/10 bg-smoke p-5 sm:grid-cols-4" role="search">
        <div><label className={label} htmlFor="tq">Name</label><input id="tq" name="q" defaultValue={params.q} className={input} /></div>
        <div><label className={label} htmlFor="kind">Type</label><select id="kind" name="kind" defaultValue={params.kind ?? ""} className={input}><option value="">All</option>{Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className={label} htmlFor="genre">Genre</label><input id="genre" name="genre" defaultValue={params.genre} className={input} /></div>
        <div className="flex items-end gap-3"><button className={btn}>Apply filters</button><Link href="/talents" className={btnGhost}>Clear</Link></div>
      </form>
      {invalid && <ErrorState title="Those filters aren't valid" body="Clear the filters and try again." retryHref="/talents" />}
      {!result && !invalid && <ErrorState retryHref={`/talents${qs(params)}`} />}
      {result && result.items.length === 0 && <EmptyState title="No talent matches" body="Try a different genre or clear the filters." action={<Link href="/talents" className={btn}>Clear filters</Link>} />}
      {result && result.items.length > 0 && (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((t) => (
              <li key={t.slug}><Link href={`/talents/${t.slug}`} className="block h-full"><Panel className="h-full hover:border-brass">
                <p className="font-display text-xl">{t.stageName.replace(/\s*\[Demo\]$/, "")}</p>
                <p className="mt-1 text-sm text-brass">{kinds[t.kind]}</p>
                <p className="mt-2 text-sm text-ash">{t.genres.join(", ")}</p>
              </Panel></Link></li>
            ))}
          </ul>
          {pages > 1 && <nav aria-label="Pagination" className="mt-8 flex items-center gap-4">
            {result.page > 1 ? <Link href={`/talents${qs({ ...params, page: result.page - 1 })}`} className={btnGhost}>Previous</Link> : <span />}
            <span className="text-sm text-ash">Page {result.page} of {pages}</span>
            {result.page < pages && <Link href={`/talents${qs({ ...params, page: result.page + 1 })}`} className={btnGhost}>Next</Link>}
          </nav>}
        </>
      )}
    </>
  );
}
