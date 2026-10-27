import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "DRNK", description: "Discover Bengaluru's best venues, events and talent." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
