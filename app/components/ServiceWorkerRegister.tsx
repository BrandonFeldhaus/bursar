"use client";

import { useEffect } from "react";

/**
 * Registers `sw.js` (written into out/ by scripts/build-sw.mjs) so the installed app opens offline.
 * Production only: the dev server has no sw.js, and a cache would serve stale pages while editing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {});
  }, []);

  return null;
}
