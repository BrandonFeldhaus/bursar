"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * True at or below `maxWidth`. On the client the first render already reads `matchMedia`, so nothing
 * renders the desktop variant for a frame on a phone; the server (and hydration) render as desktop.
 */
export function useIsMobile(maxWidth = 600) {
  const query = `(max-width: ${maxWidth}px)`;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
