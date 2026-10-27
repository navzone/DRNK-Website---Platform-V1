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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" />
      </head>
      <body className="pb-tabbar min-h-screen antialiased md:pb-0">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-snow focus:px-3 focus:py-2 focus:text-ink">Skip to content</a>
        <SiteHeader />
        <main id="main" className="mx-auto max-w-7xl px-4 sm:px-6">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
