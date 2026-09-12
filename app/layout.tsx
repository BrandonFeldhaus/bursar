import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SiteHeader } from "./components/SiteHeader";
import { BottomNav } from "./components/BottomNav";

export const metadata: Metadata = {
  title: "Bursar",
  description: "A paycheck-period budgeting app for income, bills, budget, and goals. Data stays in your browser.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="a76c89a5-e199-4ce5-b686-f9a550cb3939"
          strategy="afterInteractive"
        />
      </head>
      <body className="sheet--ledger">
        <SiteHeader />

        <main id="main" className="main">
          {children}
        </main>

        <footer className="footer" aria-label="Footer">
          <p>Bursar. Stored locally.</p>
        </footer>

        {/* Mobile-only bottom navigation */}
        <BottomNav />
      </body>
    </html>
  );
}
