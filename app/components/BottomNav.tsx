"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CircleDollarSign, LayoutGrid, ReceiptText, Settings, Target, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; Icon: LucideIcon };

const items: Item[] = [
  {
    href: "/",
    label: "Overview",
    Icon: BarChart3,
  },
  {
    href: "/expenses",
    label: "Expenses",
    Icon: ReceiptText,
  },
  {
    href: "/budget",
    label: "Budget",
    Icon: LayoutGrid,
  },
  {
    href: "/goals",
    label: "Goals",
    Icon: Target,
  },
  {
    href: "/income",
    label: "Income",
    Icon: CircleDollarSign,
  },
  {
    href: "/settings",
    label: "Settings",
    Icon: Settings,
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  return (
    <nav className="bottomNav" aria-label="Primary">
      <ul className="bottomNavList">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.Icon;
          return (
            <li key={item.href} className="bottomNavItem">
              <Link
                href={item.href}
                className={`bottomNavLink ${active ? "isActive" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="bottomNavIcon" aria-hidden="true">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className="bottomNavLabel">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
