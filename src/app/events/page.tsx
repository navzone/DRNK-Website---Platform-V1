import Link from "next/link";
import type { Metadata } from "next";
import { listEvents } from "@/server/explore/venues";
import { EventStub } from "@/components/EventStub";
import { EmptyState, ErrorState, PageTitle, btnGhost } from "@/components/ui";
import { qs } from "@/lib/qs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Events" };

export default async function Events({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  let result: Awaited<ReturnType<typeof listEvents>> | null = null;
  try { result = await listEvents({ page }); } catch { /* shown as error state */ }
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  return (
    <>
      <PageTitle tag="EVENTS" title="Events in Bengaluru" sub="Upcoming nights at approved venues. Pick a ticket type and your booking is held while you pay." />
      {!result && <ErrorState retryHref={`/events${qs({ page })}`} />}
      {result && result.items.length === 0 && <EmptyState title="No upcoming events" body="Check back soon, or browse venues for a table tonight." action={<Link href="/explore" className={btnGhost}>Explore venues</Link>} />}
      {result && result.items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{result.items.map((e) => <EventStub key={e.slug} {...e} />)}</div>
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-8 flex items-center gap-4">
              {result.page > 1 ? <Link href={`/events${qs({ page: result.page - 1 })}`} className={btnGhost}>Previous</Link> : <span />}
              <span className="text-sm text-mist">Page {result.page} of {pages}</span>
              {result.page < pages && <Link href={`/events${qs({ page: result.page + 1 })}`} className={btnGhost}>Next</Link>}
            </nav>
          )}
        </>
      )}
    </>
  );
}
