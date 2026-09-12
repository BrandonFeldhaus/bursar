"use client";

import type { Dispatch, SetStateAction } from "react";
import { newId, type Goal } from "../lib/storage";

export type DraftGoal = {
  name: string;
  type: "savings" | "debt";
  targetAmount: number;
};

export const emptyGoalDraft: DraftGoal = { name: "", type: "savings", targetAmount: 0 };

export function goalDraftErrors(draft: DraftGoal) {
  return {
    name: !draft.name.trim() ? "Required" : null,
    target: !(draft.targetAmount > 0) ? "Must be more than 0" : null,
  };
}

/** Build the stored goal from a validated draft. Funding sources are added afterwards in the goal editor. */
export function goalFromDraft(draft: DraftGoal, id: string = newId()): Goal {
  return {
    id,
    name: draft.name.trim(),
    type: draft.type,
    targetAmount: draft.targetAmount,
    linkedBudgetCategoryIds: [],
    linkedExpenseIds: [],
    manualAdjustments: [],
    appliedPeriods: [],
  };
}

/** Three fields — name, type, target — and one button. Used inline in the goals empty state and inside FormDialog. */
export function AddGoalForm({
  draft,
  setDraft,
  onAdd,
  attempted,
  inSheet,
}: {
  draft: DraftGoal;
  setDraft: Dispatch<SetStateAction<DraftGoal>>;
  onAdd: () => void;
  attempted?: boolean;
  /** Renders inside FormDialog / BottomSheet — drops the sunk background and padding. */
  inSheet?: boolean;
}) {
  const errs = goalDraftErrors(draft);
  return (
    <div className={`inline-form inline-form--3col${inSheet ? " inline-form--sheet" : ""}`}>
      <div className={`field${attempted && errs.name ? " field--has-error" : ""}`}>
        <label className="field__label" htmlFor="goal-draft-name">Goal name</label>
        <input
          id="goal-draft-name"
          className="input"
          placeholder="e.g. Emergency fund"
          value={draft.name}
          aria-invalid={attempted && !!errs.name}
          aria-describedby={attempted && errs.name ? "goal-draft-name-err" : undefined}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        {attempted && errs.name && <span id="goal-draft-name-err" className="field__error">{errs.name}</span>}
      </div>
      <div className="field">
        <span className="field__label" id="goal-draft-type-label">Type</span>
        <div className="segment segment--field" role="radiogroup" aria-labelledby="goal-draft-type-label">
          {(["savings", "debt"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={draft.type === t}
              className={`segment__btn${draft.type === t ? " segment__btn--active" : ""}`}
              onClick={() => setDraft((d) => ({ ...d, type: t }))}
            >
              {t === "savings" ? "Savings" : "Debt"}
            </button>
          ))}
        </div>
      </div>
      <div className={`field${attempted && errs.target ? " field--has-error" : ""}`}>
        <label className="field__label" htmlFor="goal-draft-target">Target amount</label>
        <input
          id="goal-draft-target"
          className="input input--mono"
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={draft.targetAmount || ""}
          aria-invalid={attempted && !!errs.target}
          aria-describedby={attempted && errs.target ? "goal-draft-target-err" : undefined}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              targetAmount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0),
            }))
          }
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          pattern="[0-9.]*"
        />
        {attempted && errs.target && <span id="goal-draft-target-err" className="field__error">{errs.target}</span>}
      </div>
      <button className="btn" type="button" onClick={onAdd}>
        Add goal
      </button>
    </div>
  );
}
