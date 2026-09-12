"use client";

import { useEffect, useRef, type RefObject } from "react";
import { opensKeyboard } from "./useSheetKeyboard";

/**
 * Shared behaviour for the modal containers (FormDialog, BottomSheet): while `open`,
 * the page behind stops scrolling, Escape closes the topmost modal, focus moves into
 * `panelRef` (which needs `tabIndex={-1}`), and focus goes back to whatever opened it on close.
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
    const previousScrollY = window.scrollY;
    document.body.style.overflow = "hidden";

    // An explicit [data-autofocus] wins. With a mouse or keyboard the first field comes next, then the
    // first button or link. On a touch screen a focused field throws the keyboard up over a form nobody
    // has seen yet, so the panel itself takes focus and the user taps the field they want.
    const panel = panelRef.current;
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const first =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      (touch
        ? panel
        : panel?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])') ??
          panel?.querySelector<HTMLElement>('button:not([disabled]):not([aria-label="Close"]), a[href]'));
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

    // iOS lets a drag move the page behind despite overflow: hidden (always while the keyboard is up),
    // so a drag on the overlay that isn't scrolling something inside it is cancelled.
    const overlay = panel?.closest<HTMLElement>('[aria-modal="true"]');
    let scroller: Element | null = null;
    function onTouchStart(e: TouchEvent) {
      scroller = scrollableAncestor(e.target as Element, overlay);
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length > 1) return; // pinch zoom
      const t = e.target;
      // Dragging a selection's handles inside the field being typed in.
      if (t === document.activeElement && opensKeyboard(t) && hasSelectedRange(t)) return;
      if (!scroller) e.preventDefault();
    }
    overlay?.addEventListener("touchstart", onTouchStart, { passive: true });
    overlay?.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      window.removeEventListener("keydown", onKey);
      overlay?.removeEventListener("touchstart", onTouchStart);
      overlay?.removeEventListener("touchmove", onTouchMove);
      document.body.style.overflow = previousOverflow;
      // iOS scrolls the page behind to "reveal" a focused field even though it can't be seen; put it back.
      if (window.scrollY !== previousScrollY) window.scrollTo(window.scrollX, previousScrollY);
      opener?.focus({ preventScroll: true });
    };
  }, [open, panelRef]);
}

/** The nearest element between `el` and `boundary` that can actually scroll (it overflows and allows it). */
function scrollableAncestor(el: Element | null, boundary: Element | null | undefined): Element | null {
  for (let node = el; node && node !== boundary; node = node.parentElement) {
    const style = getComputedStyle(node);
    const y = /auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight;
    const x = /auto|scroll/.test(style.overflowX) && node.scrollWidth > node.clientWidth;
    if (y || x) return node;
  }
  return null;
}

function hasSelectedRange(el: EventTarget | null) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  try {
    return el.selectionStart !== null && el.selectionEnd !== null && el.selectionStart < el.selectionEnd;
  } catch {
    return false; // date inputs throw on selectionStart
  }
}
