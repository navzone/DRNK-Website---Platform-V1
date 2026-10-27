import Link from "next/link";
import { EmptyState, PageTitle } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <PageTitle title="We can't find that page" />
      <EmptyState title="Nothing here" body="The link may be old, or the venue or event is no longer listed." action={<Link href="/explore" className="rounded-full bg-ember px-5 py-2.5 font-medium hover:bg-ember-hi">Explore venues</Link>} />
    </>
  );
}
