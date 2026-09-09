"use client";

import type { Dispatch, SetStateAction } from "react";

export type DraftGoal = {
  name: string;
  type: "savings" | "debt";
  targetAmount: number;
  linkedBudgetCategoryIds: string[];
  linkedExpenseIds: string[];
};

export const emptyGoalDraft: DraftGoal = {
  name: "",
  type: "savings",
  targetAmount: 0,
  linkedBudgetCategoryIds: [],
  linkedExpenseIds: [],
};

export function AddGoalForm({
  draft,
  setDraft,
  onAdd,
  budgetCategories,
  recurringExpenses,
  attempted,
  formId,
  inSheet,
}: {
  draft: DraftGoal;
  setDraft: Dispatch<SetStateAction<DraftGoal>>;
  onAdd: () => void;
  budgetCategories: { id: string; name: string }[];
  recurringExpenses: { id: string; name: string }[];
  attempted?: boolean;
  formId?: string;
  inSheet?: boolean;
}) {
  const hasLinkable = budgetCategories.length > 0 || recurringExpenses.length > 0;
  return (
    <>
      <div id={formId} className={`inline-form inline-form--3col${inSheet ? " inline-form--sheet" : " inline-form--goal"}`}>
        <div className="field">
          <label className="field__label">Goal name</label>
          <input
            className="input"
            placeholder="e.g. Emergency fund"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
          />
          {attempted && !draft.name.trim() && <p className="field__error">Required</p>}
        </div>
        <div className="field">
          <label className="field__label">Type</label>
          <select
            className="select"
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as "savings" | "debt" }))}
          >
            <option value="savings">Savings</option>
            <option value="debt">Debt</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label">Target amount</label>
          <input
            className="input input--mono"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={draft.targetAmount || ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                targetAmount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0),
              }))
            }
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
            pattern="[0-9.]*"
          />
          {attempted && draft.targetAmount <= 0 && <p className="field__error">Must be more than 0</p>}
        </div>
      </div>
      {hasLinkable && (
        <div className={`add-goal__links${inSheet ? " add-goal__links--sheet" : ""}`}>
          <p className="field__label add-goal__links-label">Link to</p>
          <div className="link-check-list">
            {budgetCategories.map((c) => {
              const checked = draft.linkedBudgetCategoryIds.includes(c.id);
              return (
                <label key={c.id} className="link-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        linkedBudgetCategoryIds: checked
                          ? d.linkedBudgetCategoryIds.filter((id) => id !== c.id)
                          : [...d.linkedBudgetCategoryIds, c.id],
                      }))
                    }
                    className="link-check__box"
                  />
                  {c.name}
                </label>
              );
            })}
            {recurringExpenses.map((e) => {
              const checked = draft.linkedExpenseIds.includes(e.id);
              return (
                <label key={e.id} className="link-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        linkedExpenseIds: checked
                          ? d.linkedExpenseIds.filter((id) => id !== e.id)
                          : [...d.linkedExpenseIds, e.id],
                      }))
                    }
                    className="link-check__box"
                  />
                  {e.name}
                </label>
              );
            })}
          </div>
        </div>
      )}
      <div className={`add-goal__submit${inSheet ? " add-goal__submit--sheet" : ""}`}>
        <button className="btn btn--block" type="button" onClick={onAdd}>
          Add goal
        </button>
      </div>
    </>
  );
}
