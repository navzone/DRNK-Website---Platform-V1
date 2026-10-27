import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/server/current-user";
import { MerchantConsole } from "@/components/MerchantConsole";
import { MerchantApply } from "@/components/MerchantApply";
import { PageTitle, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Merchant", robots: { index: false } };

export default async function Merchant() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/merchant");
  if (user.role !== "merchant" && user.role !== "admin") {
    return (<><PageTitle title="Merchants only" /><Panel><p className="text-ash">Venue owners can apply to list on DRNK. Applications are reviewed by our team.</p><Link href="/legal/merchant-terms" className="mt-3 inline-block text-brass underline">Read the merchant terms</Link></Panel><MerchantApply /></>);
  }
  return (<><PageTitle title="Merchant workspace" sub="Manage orders and reservations for your venues. New venues and events appear publicly after approval." /><MerchantConsole /></>);
}
