"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  return (
    <header className="siteHeader">
      <a className="skipLink" href="#main">
        Skip to content
      </a>

      <div className="headerInner">
        <Link className="brand" href="/" aria-label="Home">
          <span className="brandMark" aria-hidden="true" />
          <span className="brandText">Paper &amp; Ink Ledger</span>
        </Link>

        <nav className="topNav" aria-label="Primary">
          <Link className={`topNavLink ${isActive("/") ? "isActive" : ""}`} href="/">
            Overview
          </Link>
          <Link className={`topNavLink ${isActive("/expenses") ? "isActive" : ""}`} href="/expenses">
            Expenses
          </Link>
          <Link className={`topNavLink ${isActive("/budget") ? "isActive" : ""}`} href="/budget">
            Budget
          </Link>
          <Link className={`topNavLink ${isActive("/goals") ? "isActive" : ""}`} href="/goals">
            Goals
          </Link>
          <Link className={`topNavLink ${isActive("/income") ? "isActive" : ""}`} href="/income">
            Income
          </Link>
          <Link className={`topNavLink ${isActive("/settings") ? "isActive" : ""}`} href="/settings">
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
