"use client";

import { useEffect, type RefObject } from "react";

/** A visual viewport this much shorter than the layout is a keyboard, not browser chrome. */
const KEYBOARD_MIN = 80;

export type SheetKeyboard = {
  /** The keyboard has come up since the sheet opened: the sheet is pinned full height until it closes. */
  expanded: boolean;
  /** How far below the top of the overlay the visible area starts (Safari pans it to reveal a field). */
  top: number;
  /** How much of the overlay's bottom the sheet keeps clear for the keyboard. */
  inset: number;
  layoutHeight: number;
};

export const SHEET_KEYBOARD_CLOSED: SheetKeyboard = { expanded: false, top: 0, inset: 0, layoutHeight: 0 };

/**
 * Where a bottom sheet sits for a given visual viewport. Mobile browsers don't shrink the layout for the
 * on-screen keyboard, so a fixed sheet ends up underneath it; this measures what the keyboard covers.
 * Once the keyboard has appeared the sheet stays expanded, so its fields never move when the keyboard
 * hides for a select or date picker and comes back. While a field keeps focus the inset only grows — a
 * shorter number pad or a closed keyboard doesn't pull the bottom edge down under the user's thumb.
 */
export function nextSheetKeyboard(
  prev: SheetKeyboard,
  viewport: { layoutHeight: number; height: number; offsetTop: number },
  fieldFocused: boolean,
): SheetKeyboard {
  const { layoutHeight } = viewport;
  // A new layout (rotation, window resize) starts over.
  const base = prev.layoutHeight === layoutHeight ? prev : SHEET_KEYBOARD_CLOSED;
  const top = Math.max(0, Math.round(viewport.offsetTop));
  const inset = Math.max(0, Math.round(layoutHeight - viewport.offsetTop - viewport.height));
  if (!base.expanded && inset < KEYBOARD_MIN) return { ...SHEET_KEYBOARD_CLOSED, layoutHeight };
  return { expanded: true, top, inset: fieldFocused ? Math.max(inset, base.inset) : inset, layoutHeight };
}

const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "range", "color", "file", "image", "button", "submit", "reset", "hidden"]);

/** True for controls that bring up the on-screen keyboard (or a date picker) when focused. */
export function opensKeyboard(el: EventTarget | null): boolean {
  return (
    (el instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(el.type)) ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

/**
 * Keeps an open BottomSheet inside the part of the screen the keyboard leaves visible: it tracks
 * `visualViewport`, writes `--sheet-top` / `--sheet-inset` on the panel and adds `.bottom-sheet--keyboard`,
 * then scrolls the focused field into view inside the sheet body instead of letting the page move.
 */
export function useSheetKeyboard(open: boolean, panelRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const panel = panelRef.current;
    const overlay = panel?.parentElement;
    const viewport = window.visualViewport;
    if (!open || !panel || !overlay || !viewport) return;

    let state = SHEET_KEYBOARD_CLOSED;
    let frame = 0;

    function focusedField() {
      const el = document.activeElement;
      const inThisSheet = el instanceof HTMLElement && el.closest(".bottom-sheet") === panel;
      return inThisSheet && (opensKeyboard(el) || el instanceof HTMLSelectElement) ? el : null;
    }

    function reveal() {
      const el = focusedField();
      const body = el?.closest<HTMLElement>(".bottom-sheet__body");
      if (!state.expanded || !el || !body) return;
      const target = (el.closest(".field") ?? el).getBoundingClientRect();
      const box = body.getBoundingClientRect();
      const margin = 12;
      const above = box.top + margin - target.top;
      const below = target.bottom - (box.bottom - margin);
      if (above > 0) body.scrollTop -= above;
      else if (below > 0) body.scrollTop += Math.min(below, -above);
    }

    function update() {
      if (viewport!.scale > 1) return; // pinch-zoomed: the viewport says nothing about the keyboard
      const next = nextSheetKeyboard(
        state,
        { layoutHeight: overlay!.clientHeight, height: viewport!.height, offsetTop: viewport!.offsetTop },
        focusedField() !== null,
      );
      const moved = next.expanded !== state.expanded || next.top !== state.top || next.inset !== state.inset;
      state = next;
      if (!moved) return;
      panel!.classList.toggle("bottom-sheet--keyboard", next.expanded);
      panel!.style.setProperty("--sheet-top", `${next.top}px`);
      panel!.style.setProperty("--sheet-inset", `${next.inset}px`);
      reveal();
    }

    let revealPending = false;
    function schedule(andReveal = false) {
      revealPending ||= andReveal;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        update();
        if (revealPending) reveal();
        revealPending = false;
      });
    }
    const onViewport = () => schedule();
    const onFocusIn = () => schedule(true);
    // Focus moving between fields fires focusout first; wait a frame so the new field counts as focused.
    const onFocusOut = () => schedule();

    viewport.addEventListener("resize", onViewport);
    viewport.addEventListener("scroll", onViewport);
    panel.addEventListener("focusin", onFocusIn);
    panel.addEventListener("focusout", onFocusOut);
    update();

    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", onViewport);
      viewport.removeEventListener("scroll", onViewport);
      panel.removeEventListener("focusin", onFocusIn);
      panel.removeEventListener("focusout", onFocusOut);
      panel.classList.remove("bottom-sheet--keyboard");
      panel.style.removeProperty("--sheet-top");
      panel.style.removeProperty("--sheet-inset");
    };
  }, [open, panelRef]);
}
