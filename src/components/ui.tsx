import type { ReactNode } from "react";

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-8 mt-10">
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
      {sub && <p className="mt-3 max-w-prose text-ash">{sub}</p>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-paper/10 bg-smoke p-5 ${className}`}>{children}</div>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Panel className="text-center">
      <p className="font-display text-xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-ash">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </Panel>
  );
}

export function ErrorState({ title = "Couldn't load this page", body = "Something went wrong on our side. Your data is safe.", retryHref }: { title?: string; body?: string; retryHref?: string }) {
  return (
    <Panel className="border-ember/40 text-center" >
      <p role="alert" className="font-display text-xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-ash">{body}</p>
      {retryHref && <a href={retryHref} className="mt-4 inline-block rounded-full bg-ember px-5 py-2 font-medium hover:bg-ember-hi">Try again</a>}
    </Panel>
  );
}

export const btn = "inline-flex items-center justify-center rounded-full bg-ember px-5 py-2.5 font-medium text-paper hover:bg-ember-hi disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost = "inline-flex items-center justify-center rounded-full border border-paper/25 px-5 py-2.5 hover:border-brass disabled:opacity-50";
export const input = "w-full rounded-lg border border-paper/20 bg-char px-3 py-2.5 text-paper placeholder:text-ash/70 focus:border-brass";
export const label = "mb-1 block text-sm text-ash";

export function VenueArt({ name, category }: { name: string; category: string }) {
  // No licensed photography yet: a typographic placeholder tinted by category. Replace with approved imagery before launch.
  const tone: Record<string, string> = { restaurant: "bg-[#3a2321]", pub: "bg-[#2e2a1f]", microbrewery: "bg-[#3a2f1c]", lounge: "bg-[#2a2230]", cafe: "bg-[#22302b]" };
  return (
    <div className={`flex h-36 items-end rounded-lg p-4 ${tone[category] ?? "bg-char"}`} aria-hidden="true">
      <span className="font-display text-4xl font-bold text-paper/80">{name.replace(/\s*\[.*\]$/, "").split(" ").slice(0, 2).map((w) => w[0]).join("")}</span>
    </div>
  );
}
