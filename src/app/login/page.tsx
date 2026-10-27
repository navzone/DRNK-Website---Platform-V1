import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";
import { PageTitle } from "@/components/ui";
import { getCurrentUser } from "@/server/current-user";
import { safeNext } from "@/lib/qs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Log in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <>
      <PageTitle title="Log in or sign up" sub="Enter your mobile number. We'll text you a code. No password needed." />
      <LoginForm next={next} />
    </>
  );
}
