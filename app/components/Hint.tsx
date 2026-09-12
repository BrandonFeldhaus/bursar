"use client";

import type { ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import type { BudgetState } from "../lib/storage";

/** One-sentence, dismiss-once hints. Dismissed ids are stored in `meta.hints`. */
export const HINTS = {
  "overview-goals": "Track a savings or debt goal on the Goals page.",
  income: "Each source's paydays split the month into the paycheck periods on the Overview.",
  expenses: "Each bill lands in the paycheck period that covers its due day; annual bills are spread across the year.",
  budget: "Categories split each period's leftover after bills; fixed amounts come out first.",
  goals: "Progress comes from the Overview: tick a goal in a period card to add its funded amount, or add an adjustment here for money from elsewhere.",
  settings: "Your data lives only in this browser, so export a backup before erasing it or switching devices.",
} as const;

export type HintId = keyof typeof HINTS;

export function dismissHint(state: BudgetState, id: HintId): BudgetState {
  if (state.meta.hints.includes(id)) return state;
  return { ...state, meta: { ...state.meta, hints: [...state.meta.hints, id] } };
}

export function Hint({
  id,
  hints,
  onDismiss,
  children,
}: {
  id: HintId;
  hints: string[];
  onDismiss: (id: HintId) => void;
  children?: ReactNode;
}) {
  if (hints.includes(id)) return null;
  return (
    <div className="hint-line" role="note">
      <p className="hint-line__text">{children ?? HINTS[id]}</p>
      <button type="button" className="hint-line__dismiss" aria-label="Dismiss hint" onClick={() => onDismiss(id)}>
        <IconX size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
