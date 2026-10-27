import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/server/current-user";
import { AdminConsole } from "@/components/AdminConsole";
import { PageTitle, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function Admin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  // The UI gate is a convenience. Every admin API re-checks the role on the server.
  if (user.role !== "admin") {
    return (<><PageTitle title="Admins only" /><Panel><p className="text-mist">Your account doesn&apos;t have access to this area.</p><Link href="/" className="mt-3 inline-block text-gold underline">Back to DRNK</Link></Panel></>);
  }
  return (<><PageTitle title="Admin" sub="Approve listings, monitor activity and handle requests. Every change is recorded in the audit log." /><AdminConsole /></>);
}
