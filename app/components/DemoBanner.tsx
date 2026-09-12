"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { loadState } from "../lib/storage";
import { eraseAllData } from "../lib/eraseAllData";

/**
 * Slim strip under the site header while the store holds the sample ledger
 * (`meta.demo`). Rendered inside the sticky header so it moves with it and can
 * never sit over the header or the bottom nav; re-checked on every route change.
 */
export function DemoBanner() {
  const pathname = usePathname();
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    setDemo(!!loadState().meta.demo);
  }, [pathname]);

  if (!demo) return null;

  return (
    <div className="demo-banner" role="status">
      <div className="demo-banner__inner">
        <span className="demo-banner__text">You’re looking at sample data.</span>
        <button type="button" className="btn btn--ghost demo-banner__btn" onClick={eraseAllData}>
          Clear and start fresh
        </button>
      </div>
    </div>
  );
}
