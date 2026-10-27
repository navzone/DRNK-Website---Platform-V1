import Link from "next/link";
import { getCurrentUser } from "@/server/current-user";

const links = [
  { href: "/explore", label: "Explore" },
  { href: "/events", label: "Events" },
  { href: "/talents", label: "Talent" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  const nav = (
    <>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="py-2 text-paper/80 hover:text-paper">{l.label}</Link>
      ))}
      {user?.role === "admin" && <Link href="/admin" className="py-2 text-paper/80 hover:text-paper">Admin</Link>}
      {(user?.role === "merchant" || user?.role === "admin") && <Link href="/merchant" className="py-2 text-paper/80 hover:text-paper">Merchant</Link>}
      {user ? (
        <Link href="/account" className="rounded-full border border-paper/25 px-4 py-2 hover:border-brass">Account</Link>
      ) : (
        <Link href="/login" className="rounded-full bg-ember px-4 py-2 font-medium hover:bg-ember-hi">Log in</Link>
      )}
    </>
  );
  return (
    <header className="border-b border-paper/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="font-display text-2xl font-bold tracking-tight">DRNK</Link>
        <nav aria-label="Main" className="hidden items-center gap-6 sm:flex">{nav}</nav>
        <details className="relative sm:hidden">
          <summary className="cursor-pointer list-none rounded-full border border-paper/25 px-4 py-2 text-sm">Menu</summary>
          <nav aria-label="Main mobile" className="absolute right-0 z-20 mt-2 flex w-56 flex-col gap-1 rounded-xl border border-paper/10 bg-smoke p-4 shadow-xl">{nav}</nav>
        </details>
      </div>
    </header>
  );
}
