import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/server/current-user";
import { getOrderForUser } from "@/server/dinein/service";
import { AppError } from "@/lib/errors";
import { OrderTracker, type TrackedOrder } from "@/components/OrderTracker";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order" };

export default async function OrderPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/orders/${ref}`);
  let data;
  try { data = await getOrderForUser(user.id, ref); } catch (e) { if (e instanceof AppError && e.status === 404) notFound(); throw e; }
  // Dates cross the server/client boundary as ISO strings.
  const initial = JSON.parse(JSON.stringify(data)) as TrackedOrder;
  return (
    <>
      <PageTitle title="Your order" sub={`Order ${ref}`} />
      <OrderTracker initial={initial} />
    </>
  );
}
