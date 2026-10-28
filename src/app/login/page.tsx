import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";
import { PageTitle, Panel } from "@/components/ui";
import { getCurrentUser } from "@/server/current-user";
import { safeNext } from "@/lib/qs";
import { env } from "@/lib/env";
import { DEMO_LOGIN_LABELS } from "@/server/auth/otp-provider";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Log in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <>
      <PageTitle title="Log in or sign up" sub="Enter your mobile number. We'll text you a code. No password needed." />
      {env().DEMO_LOGIN === "1" && (
        <Panel className="mb-6 border-gold/40">
          <p className="font-display text-lg font-bold">Staging demo login</p>
          <p className="mt-1 text-sm text-mist">Text messages are not connected yet. To try the site, enter one of these demo numbers and the demo code that was set for this site.</p>
          <ul className="mt-3 space-y-1">{DEMO_LOGIN_LABELS.map((d) => <li key={d.phone} className="flex flex-wrap items-baseline gap-x-3"><span className="tag rounded-full border border-snow/15 px-3 py-1 text-snow">{d.phone.replace("+91", "")}</span><span className="text-sm text-mist">{d.role}</span></li>)}</ul>
        </Panel>
      )}
      <LoginForm next={next} />
    </>
  );
}
