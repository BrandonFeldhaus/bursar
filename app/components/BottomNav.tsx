"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChartBar,
  IconCoin,
  IconDots,
  IconLayoutGrid,
  IconReceipt,
  IconSettings,
  IconTarget,
  type Icon as TablerIcon,
} from "@tabler/icons-react";
import { BottomSheet } from "./BottomSheet";

type Item = { href: string; label: string; Icon: TablerIcon };

const items: Item[] = [
  { href: "/", label: "Overview", Icon: IconChartBar },
  { href: "/expenses", label: "Expenses", Icon: IconReceipt },
  { href: "/budget", label: "Budget", Icon: IconLayoutGrid },
  { href: "/goals", label: "Goals", Icon: IconTarget },
];

/** The two pages behind the "More" item. */
const more: Item[] = [
  { href: "/income", label: "Income", Icon: IconCoin },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

/** Mobile-only bottom navigation: four pages plus "More", which opens a small sheet with Income and Settings. */
export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : !!pathname?.startsWith(href));
  const moreActive = more.some((m) => isActive(m.href));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

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
                  <Icon size={20} stroke={1.8} />
                </span>
                <span className="bottomNavLabel">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="bottomNavItem">
          <button
            type="button"
            className={`bottomNavLink bottomNavLink--btn ${moreActive ? "isActive" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
          >
            <span className="bottomNavIcon" aria-hidden="true">
              <IconDots size={20} stroke={1.8} />
            </span>
            <span className="bottomNavLabel">More</span>
          </button>
        </li>
      </ul>

      {moreOpen && (
        <BottomSheet open title="More" onClose={() => setMoreOpen(false)}>
          <ul className="more-sheet__list">
            {more.map((item) => {
              const Icon = item.Icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`more-sheet__link${active ? " more-sheet__link--active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMoreOpen(false)}
                  >
                    <Icon size={20} stroke={1.8} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </BottomSheet>
      )}
    </nav>
  );
}
