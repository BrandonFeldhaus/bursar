import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "./components/SiteHeader";
import { BottomNav } from "./components/BottomNav";
import { OnboardingGate } from "./components/OnboardingGate";

export const metadata: Metadata = {
  title: "Paper & Ink Ledger",
  description: "A ledger-style budgeting workspace for income, expenses, and budget planning.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="sheet--ledger">
        <SiteHeader />

        <main id="main" className="main">
          <OnboardingGate>{children}</OnboardingGate>
        </main>

        <footer className="footer" aria-label="Footer">
          <p>Paper &amp; Ink Ledger. Stored locally.</p>
        </footer>

        {/* Mobile-only bottom navigation */}
        <BottomNav />
      </body>
    </html>
  );
}
