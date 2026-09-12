"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Shared behaviour for the modal containers (FormDialog, BottomSheet): while `open`,
 * the page behind stops scrolling, Escape closes the topmost modal, the first field
 * inside `panelRef` takes focus, and focus goes back to whatever opened it on close.
 */
export function useModal(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // An explicit [data-autofocus] wins; otherwise the first field, then the first button or link.
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])') ??
      panel?.querySelector<HTMLElement>('button:not([disabled]):not([aria-label="Close"]), a[href]');
    first?.focus({ preventScroll: true });

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // With one modal stacked on another, only the topmost one closes.
      const modals = document.querySelectorAll('[aria-modal="true"]');
      const own = panelRef.current?.closest('[aria-modal="true"]');
      if (own && modals[modals.length - 1] !== own) return;
      onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus({ preventScroll: true });
    };
  }, [open, panelRef]);
}
