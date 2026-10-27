"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Compass, Mic2, User, UtensilsCrossed } from "lucide-react";

export const NAV = [
  { href: "/", label: "Explore", short: "Explore", icon: Compass, match: (p: string) => p === "/" },
  { href: "/explore", label: "Dine-In", short: "Dine-In", icon: UtensilsCrossed, match: (p: string) => p.startsWith("/explore") || p.startsWith("/venues") },
  { href: "/events", label: "Events", short: "Events", icon: CalendarDays, match: (p: string) => p.startsWith("/events") || p.startsWith("/bookings") },
  { href: "/talents", label: "Talent & Gigs", short: "Gigs", icon: Mic2, match: (p: string) => p.startsWith("/talents") },
] as const;

/** Top navigation pills (tablet and up). */
export function TopNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-2 md:flex">
      {NAV.map((n) => {
        const on = n.match(path);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${on ? "border-gold bg-gold/10 text-gold" : "border-snow/10 bg-snow/5 text-mist hover:text-snow"}`}
          >
            <n.icon className="h-4 w-4" aria-hidden="true" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Fixed bottom tab bar (phones). `profileHref` is /account when logged in, /login otherwise. */
export function BottomTabs({ profileHref }: { profileHref: string }) {
  const path = usePathname();
  const items = [
    ...NAV.map((n) => ({ href: n.href, label: n.short, icon: n.icon, on: n.match(path) })),
    { href: profileHref, label: "Profile", icon: User, on: path.startsWith("/account") || path.startsWith("/login") },
  ];
  return (
    <nav aria-label="Main mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-snow/10 bg-ink/95 backdrop-blur-xl md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map((i) => (
          <li key={i.label}>
            <Link href={i.href} aria-current={i.on ? "page" : undefined} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${i.on ? "text-gold" : "text-mist"}`}>
              <i.icon className="h-5 w-5" aria-hidden="true" />
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
