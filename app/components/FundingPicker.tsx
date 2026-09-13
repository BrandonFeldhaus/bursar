"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { BottomSheet } from "./BottomSheet";
import { useIsMobile } from "../lib/useIsMobile";
import { fundingAmountLabel, type FundingSource } from "../lib/goalFunding";

const POPOVER_WIDTH = 340;

/**
 * "Add funding source" for a goal: a button that opens the candidates grouped under
 * Budget categories and Bills — a category's amount per paycheck, a bill's as billed.
 * Desktop gets a popover anchored to the button, mobile the BottomSheet. Rows toggle:
 * sources the goal already uses are checked, and choosing one again removes it.
 */
export function FundingPicker({
  goalType,
  candidates,
  isAdded,
  onToggle,
}: {
  goalType: "savings" | "debt";
  candidates: FundingSource[];
  isAdded: (source: FundingSource) => boolean;
  onToggle: (source: FundingSource) => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POPOVER_WIDTH - 8));
    setPos({ top: r.bottom + 6, left });
  }, []);

  // Desktop popover: anchor to the button, follow scroll / resize, close on outside click or Escape,
  // focus the first row on open and return focus to the button on close.
  useEffect(() => {
    if (!open || isMobile) return;
    place();
    const opener = btnRef.current;
    window.setTimeout(() => popRef.current?.querySelector<HTMLElement>("button:not([disabled]), summary")?.focus({ preventScroll: true }), 0);
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      opener?.focus({ preventScroll: true });
    };
  }, [open, isMobile, place]);

  const groups = [
    { kind: "category" as const, title: "Budget categories", items: candidates.filter((c) => c.kind === "category") },
    { kind: "bill" as const, title: "Bills", items: candidates.filter((c) => c.kind === "bill") },
  ];
  const ordered = goalType === "debt" ? [groups[1], groups[0]] : groups;

  const list = (
    <div className="funding-picker__groups">
      {ordered.map((g, i) => (
        <details key={g.kind} className="funding-picker__group" open={i === 0}>
          <summary className="funding-picker__group-title">
            {g.title}
            <span className="funding-picker__count">{g.items.length}</span>
          </summary>
          {g.items.length === 0 ? (
            <p className="funding-picker__empty">None yet.</p>
          ) : (
            <ul className="funding-picker__list">
              {g.items.map((s) => {
                const added = isAdded(s);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`funding-picker__row${added ? " funding-picker__row--added" : ""}`}
                      aria-pressed={added}
                      onClick={() => onToggle(s)}
                    >
                      <span className="funding-picker__check" aria-hidden="true">
                        {added && <IconCheck size={14} />}
                      </span>
                      <span className="funding-picker__name">{s.name}</span>
                      <span className="funding-picker__amount">{fundingAmountLabel(s)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </details>
      ))}
    </div>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn btn--ghost btn--add"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-autofocus
        onClick={() => setOpen((v) => !v)}
      >
        <IconPlus size={14} aria-hidden="true" />
        Add funding source
      </button>

      {isMobile && (
        <BottomSheet open={open} title="Funding sources" onClose={() => setOpen(false)}>
          {list}
        </BottomSheet>
      )}

      {open && !isMobile && pos && createPortal(
        <div
          ref={popRef}
          className="funding-picker__popover"
          role="dialog"
          aria-label="Funding sources"
          style={{ "--top": `${pos.top}px`, "--left": `${pos.left}px` } as CSSProperties}
        >
          {list}
          <div className="funding-picker__foot">
            <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
