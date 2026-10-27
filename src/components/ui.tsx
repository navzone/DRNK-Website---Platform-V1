import type { ReactNode } from "react";

export function PageTitle({ title, sub, tag }: { title: string; sub?: string; tag?: string }) {
  return (
    <div className="mb-6 mt-8 sm:mt-10">
      {tag && <p className="tag mb-2 text-gold">{tag}</p>}
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {sub && <p className="mt-2 max-w-prose text-mist">{sub}</p>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-snow/10 bg-panel p-5 ${className}`}>{children}</div>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Panel className="text-center">
      <p className="font-display text-xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-mist">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </Panel>
  );
}

export function ErrorState({ title = "Couldn't load this page", body = "Something went wrong on our side. Your data is safe.", retryHref }: { title?: string; body?: string; retryHref?: string }) {
  return (
    <Panel className="border-rose/40 text-center">
      <p role="alert" className="font-display text-xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-mist">{body}</p>
      {retryHref && <a href={retryHref} className={`${btn} mt-4`}>Try again</a>}
    </Panel>
  );
}

/** Small mono pill. tone: gold (default), jade (available / confirmed), neutral. */
export function Chip({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "jade" | "neutral" | "rose" }) {
  const t = {
    gold: "border-gold/40 bg-gold/10 text-gold",
    jade: "border-jade/40 bg-jade/10 text-jade",
    rose: "border-rose/40 bg-rose/10 text-rose",
    neutral: "border-snow/15 bg-snow/5 text-mist",
  }[tone];
  return <span className={`tag inline-flex items-center rounded-full border px-2.5 py-0.5 ${t}`}>{children}</span>;
}

export const btn = "inline-flex items-center justify-center gap-2 rounded-full bg-gold px-5 py-2.5 font-semibold text-ink transition-colors hover:bg-gold-hi disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost = "inline-flex items-center justify-center gap-2 rounded-full border border-snow/20 px-5 py-2.5 font-medium text-snow transition-colors hover:border-gold hover:text-gold disabled:opacity-50";
export const input = "w-full rounded-xl border border-snow/15 bg-ink px-3.5 py-2.5 text-snow placeholder:text-mist/70 focus:border-gold";
export const label = "mb-1.5 block text-sm text-mist";
export const pill = "inline-flex shrink-0 whitespace-nowrap items-center rounded-full border border-snow/15 bg-snow/5 px-4 py-1.5 text-sm text-snow transition-colors hover:border-gold/60";
export const pillActive = "inline-flex shrink-0 whitespace-nowrap items-center rounded-full border border-gold bg-gold px-4 py-1.5 text-sm font-semibold text-ink";

/** No licensed photography yet: a typographic placeholder tinted by category. Replace with approved imagery before launch. */
export function VenueArt({ name, category, className = "h-40" }: { name: string; category: string; className?: string }) {
  const tone: Record<string, string> = {
    restaurant: "from-[#3a2418] to-[#14161f]",
    pub: "from-[#2f2a14] to-[#14161f]",
    microbrewery: "from-[#3b2d0f] to-[#14161f]",
    lounge: "from-[#2a1d3a] to-[#14161f]",
    cafe: "from-[#123029] to-[#14161f]",
  };
  const initials = name.replace(/\s*\[.*\]$/, "").split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div className={`flex items-end rounded-xl bg-gradient-to-br p-4 ${tone[category] ?? "from-panel-hi to-ink"} ${className}`} aria-hidden="true">
      <span className="font-display text-5xl font-extrabold text-snow/85">{initials}</span>
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-2xl font-bold sm:text-3xl">{children}</h2>
      {sub && <p className="mt-1 text-sm text-mist">{sub}</p>}
    </div>
  );
}
