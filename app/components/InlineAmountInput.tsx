"use client";

import { useRef, useState } from "react";
import { moneyFmt } from "../lib/currency";

/** Plain number for editing: no "$" or separators, at most two decimals. */
function rawNumber(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * A number edited in place — the one inline-edit control for amounts, used by the Overview's
 * paychecks and every table row (income, bills, budget, goals).
 *
 * Reads as its formatted value (`$1,300.00`, `25%`) until focused, then shows the raw number
 * with it selected. **Blur saves**; an untouched field saves nothing. Escape reverts. An emptied
 * field commits `null` when `clearable`, otherwise it reverts. Out-of-range or unparseable input
 * reverts. Enter is not handled here: the row's / form's `advanceOnEnter` moves focus on, and
 * the blur that causes is what saves.
 */
export function InlineAmountInput({
  value,
  onCommit,
  format = moneyFmt,
  integer = false,
  clearable = false,
  min = 0,
  max,
  className,
  enterKeyHint = "next",
  "aria-label": ariaLabel,
}: {
  value: number;
  onCommit: (value: number | null) => void;
  format?: (n: number) => string;
  /** Whole numbers only (a due day). */
  integer?: boolean;
  /** An emptied field commits null (e.g. clearing a paycheck's actual) instead of reverting. */
  clearable?: boolean;
  min?: number;
  max?: number;
  className?: string;
  enterKeyHint?: "next" | "done";
  "aria-label": string;
}) {
  // null while not editing; the raw string while focused.
  const [draft, setDraft] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const cancelled = useRef(false);

  function commit() {
    const d = draft;
    const wasDirty = dirty;
    setDraft(null);
    setDirty(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (d === null || !wasDirty) return;
    if (d.trim() === "") {
      if (clearable) onCommit(null);
      return;
    }
    const n = Number(d);
    if (!Number.isFinite(n) || n < min || (max !== undefined && n > max)) return;
    onCommit(integer ? Math.round(n) : Math.round(n * 100) / 100);
  }

  return (
    <input
      className={`input input--mono input--inline${className ? ` ${className}` : ""}`}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      pattern={integer ? "[0-9]*" : "[0-9.]*"}
      enterKeyHint={enterKeyHint}
      value={draft ?? format(value)}
      aria-label={ariaLabel}
      onFocus={(e) => {
        setDraft(integer ? String(Math.round(value)) : rawNumber(value));
        const input = e.currentTarget;
        // Select once React has swapped in the raw value, so typing replaces it.
        requestAnimationFrame(() => {
          if (document.activeElement === input) input.select();
        });
      }}
      onChange={(e) => {
        const cleaned = e.target.value.replace(integer ? /\D/g : /[^0-9.]/g, "");
        setDraft(integer && max !== undefined ? cleaned.slice(0, String(max).length) : cleaned);
        setDirty(true);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        cancelled.current = true;
        e.currentTarget.blur();
      }}
      onBlur={commit}
    />
  );
}
