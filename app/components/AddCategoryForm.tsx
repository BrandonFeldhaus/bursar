"use client";

import type { Dispatch, SetStateAction } from "react";
import type { BudgetCategory } from "../lib/storage";
import { Form } from "./Form";

export type CategoryFormDraft = Omit<BudgetCategory, "id">;

export const emptyCategoryDraft: CategoryFormDraft = { name: "", mode: "percent", value: 0 };

export function AddCategoryForm({
  draft,
  setDraft,
  onAdd,
  attempted,
  inSheet,
}: {
  draft: CategoryFormDraft;
  setDraft: Dispatch<SetStateAction<CategoryFormDraft>>;
  onAdd: () => void;
  attempted?: boolean;
  /** Renders inside FormDialog / BottomSheet — drops the sunk background/padding. */
  inSheet?: boolean;
}) {
  const nameError = !draft.name.trim() ? "Required" : null;
  const valueError = draft.value <= 0 ? "Must be more than 0" : null;
  return (
    <Form className={`inline-form${inSheet ? " inline-form--sheet" : ""}`} onSubmit={onAdd}>
      <div className={`field${attempted && nameError ? " field--has-error" : ""}`}>
        <label className="field__label" htmlFor="cat-draft-name">Name</label>
        <input
          id="cat-draft-name"
          className="input"
          placeholder="e.g. Travel fund"
          enterKeyHint="next"
          value={draft.name}
          aria-invalid={attempted && !!nameError}
          aria-describedby={attempted && nameError ? "cat-draft-name-err" : undefined}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        {attempted && nameError && (
          <span id="cat-draft-name-err" className="field__error">{nameError}</span>
        )}
      </div>
      <div className="field">
        <label className="field__label" htmlFor="cat-draft-mode">Type</label>
        <select
          id="cat-draft-mode"
          className="select"
          value={draft.mode}
          onChange={(e) => setDraft((d) => ({ ...d, mode: e.target.value as "percent" | "fixed" }))}
        >
          <option value="percent">Percent</option>
          <option value="fixed">Fixed $</option>
        </select>
      </div>
      <div className={`field${attempted && valueError ? " field--has-error" : ""}`}>
        <label className="field__label" htmlFor="cat-draft-value">Value</label>
        <input
          id="cat-draft-value"
          className="input input--mono"
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          placeholder="0"
          value={draft.value || ""}
          aria-invalid={attempted && !!valueError}
          aria-describedby={attempted && valueError ? "cat-draft-value-err" : undefined}
          onChange={(e) =>
            setDraft((d) => ({ ...d, value: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) }))
          }
          pattern="[0-9.]*"
        />
        {attempted && valueError && (
          <span id="cat-draft-value-err" className="field__error">{valueError}</span>
        )}
      </div>
      <button className="btn" type="submit">
        Add category
      </button>
    </Form>
  );
}
