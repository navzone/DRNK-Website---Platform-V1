import Link from "next/link";
import { getCurrentUser } from "@/server/current-user";
import { BottomTabs, TopNav } from "./NavLinks";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const name = user?.displayName?.trim() || "Account";
  const initial = (user?.displayName?.trim()?.[0] ?? "D").toUpperCase();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-snow/10 bg-ink/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-baseline gap-3" aria-label="DRNK home">
            <span className="font-display text-2xl font-extrabold tracking-tight text-gold">DRNK</span>
            <span className="tag hidden text-mist lg:inline">DRINK. REFILL. NETWORK.</span>
          </Link>
          <TopNav />
          <div className="flex items-center gap-2">
            {user?.role === "admin" && <Link href="/admin" className="hidden rounded-full border border-snow/10 px-3 py-1.5 text-sm text-mist hover:text-snow lg:inline-flex">Admin</Link>}
            {(user?.role === "merchant" || user?.role === "admin") && <Link href="/merchant" className="hidden rounded-full border border-snow/10 px-3 py-1.5 text-sm text-mist hover:text-snow lg:inline-flex">Merchant</Link>}
            {user ? (
              <Link href="/account" className="flex items-center gap-2 rounded-full border border-gold/40 bg-gold/5 py-1 pl-1 pr-3 text-sm font-medium hover:border-gold">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gold font-display font-bold text-ink" aria-hidden="true">{initial}</span>
                <span className="max-w-[8rem] truncate">{name}</span>
              </Link>
            ) : (
              <Link href="/login" className="inline-flex items-center rounded-full bg-gold px-5 py-2 text-sm font-semibold text-ink hover:bg-gold-hi">Log in</Link>
            )}
          </div>
        </div>
      </header>
      <BottomTabs profileHref={user ? "/account" : "/login"} />
    </>
  );
}
