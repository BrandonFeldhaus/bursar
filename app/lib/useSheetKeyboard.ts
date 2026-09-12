"use client";

import { useEffect, type RefObject } from "react";

/** A visual viewport this much shorter than the layout is a keyboard, not browser chrome. */
const KEYBOARD_MIN = 80;

export type SheetKeyboard = {
  /** The keyboard has come up since the sheet opened: the sheet is pinned full height until it closes. */
  expanded: boolean;
  /** The height the keyboard covers now; the sheet's visible area ends above it. */
  inset: number;
  /** Extra scroll room at the end of the sheet body, so a keyboard that hides or shrinks doesn't scroll the form. */
  reserve: number;
  layoutHeight: number;
};

export const SHEET_KEYBOARD_CLOSED: SheetKeyboard = { expanded: false, inset: 0, reserve: 0, layoutHeight: 0 };

/**
 * Where a bottom sheet sits for a given visual viewport. Mobile browsers don't shrink the layout for the
 * on-screen keyboard, so a fixed sheet ends up underneath it; the keyboard is whatever the visual viewport
 * lost. `offsetTop` is deliberately ignored: iOS reports its reveal-the-field pan there while a fixed sheet
 * stays put on screen, so following it pushed the sheet down behind the keyboard.
 *
 * Once the keyboard has appeared the sheet stays pinned, so its fields don't move when the keyboard hides
 * for a select or date picker and comes back. The visible area always follows the real keyboard (nothing is
 * hidden behind empty space); while a field keeps focus, the height the keyboard gave back becomes scroll
 * room at the end of the body instead, so the body's scroll position never has to clamp.
 */
export function nextSheetKeyboard(
  prev: SheetKeyboard,
  viewport: { layoutHeight: number; height: number },
  fieldFocused: boolean,
): SheetKeyboard {
  const { layoutHeight } = viewport;
  // A new layout (rotation, window resize) starts over.
  const base = prev.layoutHeight === layoutHeight ? prev : SHEET_KEYBOARD_CLOSED;
  const inset = Math.max(0, Math.round(layoutHeight - viewport.height));
  if (!base.expanded && inset < KEYBOARD_MIN) return { ...SHEET_KEYBOARD_CLOSED, layoutHeight };
  const held = fieldFocused ? Math.max(inset, base.inset + base.reserve) : inset;
  return { expanded: true, inset, reserve: held - inset, layoutHeight };
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
 * `visualViewport`, writes `--sheet-inset` / `--sheet-reserve` on the panel and adds `.bottom-sheet--keyboard`,
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
        { layoutHeight: overlay!.clientHeight, height: viewport!.height },
        focusedField() !== null,
      );
      const moved = next.expanded !== state.expanded || next.inset !== state.inset || next.reserve !== state.reserve;
      state = next;
      if (!moved) return;
      panel!.classList.toggle("bottom-sheet--keyboard", next.expanded);
      panel!.style.setProperty("--sheet-inset", `${next.inset}px`);
      panel!.style.setProperty("--sheet-reserve", `${next.reserve}px`);
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
    panel.addEventListener("focusin", onFocusIn);
    panel.addEventListener("focusout", onFocusOut);
    update();

    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", onViewport);
      panel.removeEventListener("focusin", onFocusIn);
      panel.removeEventListener("focusout", onFocusOut);
      panel.classList.remove("bottom-sheet--keyboard");
      panel.style.removeProperty("--sheet-inset");
      panel.style.removeProperty("--sheet-reserve");
    };
  }, [open, panelRef]);
}
