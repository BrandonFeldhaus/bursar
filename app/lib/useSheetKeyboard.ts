"use client";

import { useEffect, type RefObject } from "react";

/** A visual-viewport shortfall under this is browser chrome settling, not a keyboard. */
const KEYBOARD_MIN = 120;
/** Until a keyboard has been measured, assume it covers this share of the layout viewport. */
const KEYBOARD_GUESS = 0.6;
const MARGIN = 12;

export type SheetKeyboard = {
  /** A field in the sheet has taken focus: the sheet is pinned full height until it closes. */
  pinned: boolean;
  /** How far the browser panned the visual viewport to reveal a field; the sheet follows so it stays on screen. */
  top: number;
  /** The height the keyboard covers now; the sheet's visible area ends above it. */
  inset: number;
  /** Extra scroll room at the end of the body, so a keyboard that hides or shrinks doesn't scroll the form. */
  reserve: number;
  layoutHeight: number;
};

export const SHEET_KEYBOARD_CLOSED: SheetKeyboard = { pinned: false, top: 0, inset: 0, reserve: 0, layoutHeight: 0 };

/**
 * Where a bottom sheet sits for a given visual viewport. Mobile browsers don't shrink the layout for the
 * on-screen keyboard, so a fixed sheet ends up underneath it; the keyboard is whatever the visual viewport
 * lost. `pin` (a field just took focus) pins the sheet full height, and it stays pinned so its fields don't
 * move when the keyboard hides for a select or date picker and comes back. The visible area always follows
 * the real keyboard; while a field keeps focus, the height a hiding or shrinking keyboard gives back becomes
 * scroll room at the end of the body instead, so the body's scroll position never has to clamp.
 */
export function nextSheetKeyboard(
  prev: SheetKeyboard,
  viewport: { layoutHeight: number; height: number; offsetTop: number },
  fieldFocused: boolean,
  pin = false,
): SheetKeyboard {
  const { layoutHeight } = viewport;
  const pinned = prev.pinned || pin;
  if (!pinned) return { ...SHEET_KEYBOARD_CLOSED, layoutHeight };
  const top = Math.max(0, Math.round(viewport.offsetTop));
  const shortfall = Math.round(layoutHeight - viewport.offsetTop - viewport.height);
  const inset = shortfall < KEYBOARD_MIN ? 0 : shortfall;
  // A new layout (rotation) drops the held room; nothing to keep still against.
  const held = fieldFocused && prev.layoutHeight === layoutHeight ? prev.inset + prev.reserve : 0;
  return { pinned, top, inset, reserve: Math.max(0, held - inset), layoutHeight };
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

/** The tallest keyboard seen for a layout height, so later sheets know how much of the screen it takes. */
let measured: { layoutHeight: number; inset: number } | null = null;

/**
 * Keeps an open BottomSheet inside the part of the screen the keyboard leaves visible. The moment a field
 * takes focus — synchronously, before the browser decides how to reveal it — the sheet is pinned full height
 * and the field is scrolled into the part of the body the keyboard will not cover, so the browser has no
 * reason to pan the page. Then it tracks `visualViewport`, writing `--sheet-top` / `--sheet-inset` /
 * `--sheet-reserve` on the panel under `.bottom-sheet--keyboard`.
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

    /** Apply the viewport to the sheet; returns true when its geometry changed. */
    function measure(pin = false) {
      if (viewport!.scale > 1) return false; // pinch-zoomed: the viewport says nothing about the keyboard
      const next = nextSheetKeyboard(
        state,
        { layoutHeight: overlay!.clientHeight, height: viewport!.height, offsetTop: viewport!.offsetTop },
        focusedField() !== null,
        pin,
      );
      const changed =
        next.pinned !== state.pinned || next.top !== state.top || next.inset !== state.inset || next.reserve !== state.reserve;
      state = next;
      if (next.inset > 0 && (measured?.layoutHeight !== next.layoutHeight || measured.inset < next.inset)) {
        measured = { layoutHeight: next.layoutHeight, inset: next.inset };
      }
      if (!changed) return false;
      panel!.classList.toggle("bottom-sheet--keyboard", next.pinned);
      panel!.style.setProperty("--sheet-top", `${next.top}px`);
      panel!.style.setProperty("--sheet-inset", `${next.inset}px`);
      panel!.style.setProperty("--sheet-reserve", `${next.reserve}px`);
      return true;
    }

    /** Scroll the focused field into the part of the body the keyboard leaves (or will leave) visible. */
    function reveal() {
      const el = focusedField();
      const body = el?.closest<HTMLElement>(".bottom-sheet__body");
      if (!state.pinned || !el || !body) return;
      const keyboard =
        measured?.layoutHeight === state.layoutHeight ? measured.inset : Math.round(state.layoutHeight * KEYBOARD_GUESS);
      const box = body.getBoundingClientRect();
      const top = box.top + MARGIN;
      const bottom = Math.min(box.bottom, state.layoutHeight - keyboard) - MARGIN;
      const target = (el.closest(".field") ?? el).getBoundingClientRect();
      if (target.top < top) body.scrollTop -= top - target.top;
      else if (target.bottom > bottom) body.scrollTop += Math.min(target.bottom - bottom, target.top - top);
    }

    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (measure()) reveal();
      });
    }
    // Synchronous on purpose: the browser reads the field's position right after the focus event.
    function onFocusIn(e: FocusEvent) {
      const pin = opensKeyboard(e.target) || e.target instanceof HTMLSelectElement;
      measure(pin);
      reveal();
    }
    // Focus moving between fields fires focusout first; wait a frame so the new field counts as focused.
    const onFocusOut = () => schedule();
    const onViewport = () => schedule();

    viewport.addEventListener("resize", onViewport);
    viewport.addEventListener("scroll", onViewport);
    panel.addEventListener("focusin", onFocusIn);
    panel.addEventListener("focusout", onFocusOut);
    measure();

    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", onViewport);
      viewport.removeEventListener("scroll", onViewport);
      panel.removeEventListener("focusin", onFocusIn);
      panel.removeEventListener("focusout", onFocusOut);
      panel.classList.remove("bottom-sheet--keyboard");
      panel.style.removeProperty("--sheet-top");
      panel.style.removeProperty("--sheet-inset");
      panel.style.removeProperty("--sheet-reserve");
    };
  }, [open, panelRef]);
}
