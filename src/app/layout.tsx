import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: { default: "DRNK — Bengaluru venues, events and talent", template: "%s — DRNK" },
  description: "Find venues, book tables and event tickets, and discover talent in Bengaluru.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-paper focus:px-3 focus:py-2 focus:text-char">Skip to content</a>
        <SiteHeader />
        <main id="main" className="mx-auto max-w-6xl px-4 sm:px-6">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
