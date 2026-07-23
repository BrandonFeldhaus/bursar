"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChartBar,
  IconCoin,
  IconLayoutGrid,
  IconReceipt,
  IconSettings,
  IconTarget,
  type Icon as TablerIcon,
} from "@tabler/icons-react";

type Item = { href: string; label: string; Icon: TablerIcon };

const items: Item[] = [
  {
    href: "/",
    label: "Overview",
    Icon: IconChartBar,
  },
  {
    href: "/expenses",
    label: "Expenses",
    Icon: IconReceipt,
  },
  {
    href: "/budget",
    label: "Budget",
    Icon: IconLayoutGrid,
  },
  {
    href: "/goals",
    label: "Goals",
    Icon: IconTarget,
  },
  {
    href: "/income",
    label: "Income",
    Icon: IconCoin,
  },
  {
    href: "/settings",
    label: "Settings",
    Icon: IconSettings,
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  if (pathname === "/onboarding") return null;

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
                  <Icon size={18} stroke={1.8} />
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
