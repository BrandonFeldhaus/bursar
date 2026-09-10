"use client";

import type { Dispatch, SetStateAction } from "react";
import { newId, type Income, type PayCycle } from "../lib/storage";
import { todayISO } from "../lib/month";

export const needsAnchor = (cycle: PayCycle) => cycle === "biweekly" || cycle === "weekly";

export const CYCLE_OPTIONS: { value: PayCycle; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "semimonthly", label: "Semi-monthly" },
];

export type SourceDraft = {
  name: string;
  amount: string;
  payCycle: PayCycle;
  lastPaycheckDate: string;
};

export function emptySourceDraft(): SourceDraft {
  return { name: "", amount: "", payCycle: "biweekly", lastPaycheckDate: todayISO() };
}

export function sourceDraftErrors(draft: SourceDraft) {
  const parsedAmount = Number(draft.amount.replace(/[^0-9.]/g, ""));
  return {
    parsedAmount,
    name: !draft.name.trim() ? "Required" : null,
    amount: !(parsedAmount > 0) ? "Must be more than 0" : null,
    date: needsAnchor(draft.payCycle) && !draft.lastPaycheckDate ? "Pick a paycheck date" : null,
  };
}

/** Build the stored income from a validated draft (`errs` from sourceDraftErrors). */
export function incomeFromDraft(draft: SourceDraft, errs: ReturnType<typeof sourceDraftErrors>): Income {
  return {
    id: newId(),
    name: draft.name.trim(),
    amount: Math.max(0, errs.parsedAmount),
    cadence: "monthly",
    payCycle: draft.payCycle,
    lastPaycheckDate: needsAnchor(draft.payCycle) ? draft.lastPaycheckDate || todayISO() : "",
  };
}

/** Add-an-income-source form: inline below the Income table, in the Overview's empty state, and inside the mobile BottomSheet. */
export function AddSourceForm({
  draft,
  setDraft,
  onAdd,
  attempted,
  formId,
  inSheet,
  narrow,
}: {
  draft: SourceDraft;
  setDraft: Dispatch<SetStateAction<SourceDraft>>;
  onAdd: () => void;
  attempted?: boolean;
  formId?: string;
  /** Renders inside the mobile BottomSheet — drops the sunk background/padding. */
  inSheet?: boolean;
  /** Two columns at every width (inside a period card). */
  narrow?: boolean;
}) {
  const errs = sourceDraftErrors(draft);
  const cls = [
    "inline-form",
    needsAnchor(draft.payCycle) ? "inline-form--4col" : "",
    inSheet ? "inline-form--sheet" : "",
    narrow ? "inline-form--narrow" : "",
  ].filter(Boolean).join(" ");
  return (
    <div id={formId} className={cls}>
      <div className={`field${attempted && errs.name ? " field--has-error" : ""}`}>
        <label className="field__label" htmlFor="inc-draft-name">New source</label>
        <input
          id="inc-draft-name"
          className="input"
          placeholder="e.g. Day job"
          value={draft.name}
          aria-invalid={attempted && !!errs.name}
          aria-describedby={attempted && errs.name ? "inc-draft-name-err" : undefined}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        {attempted && errs.name && (
          <span id="inc-draft-name-err" className="field__error">{errs.name}</span>
        )}
      </div>
      <div className={`field${attempted && errs.amount ? " field--has-error" : ""}`}>
        <label className="field__label" htmlFor="inc-draft-amount">Amount per paycheck</label>
        <input
          id="inc-draft-amount"
          className="input input--mono"
          type="text"
          inputMode="decimal"
          pattern="[0-9.]*"
          placeholder="0"
          value={draft.amount}
          aria-invalid={attempted && !!errs.amount}
          aria-describedby={attempted && errs.amount ? "inc-draft-amount-err" : undefined}
          onChange={(e) =>
            setDraft((d) => ({ ...d, amount: e.target.value.replace(/[^0-9.]/g, "") }))
          }
        />
        {attempted && errs.amount && (
          <span id="inc-draft-amount-err" className="field__error">{errs.amount}</span>
        )}
      </div>
      <div className="field">
        <label className="field__label" htmlFor="inc-draft-cycle">Cycle</label>
        <select
          id="inc-draft-cycle"
          className="select"
          value={draft.payCycle}
          onChange={(e) => {
            const next = e.target.value as PayCycle;
            setDraft((d) => ({
              ...d,
              payCycle: next,
              lastPaycheckDate: needsAnchor(next) ? d.lastPaycheckDate || todayISO() : "",
            }));
          }}
        >
          {CYCLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {needsAnchor(draft.payCycle) && (
        <div className={`field${attempted && errs.date ? " field--has-error" : ""}`}>
          <label className="field__label" htmlFor="inc-draft-date">Last paycheck</label>
          <input
            id="inc-draft-date"
            className="input"
            type="date"
            value={draft.lastPaycheckDate}
            aria-invalid={attempted && !!errs.date}
            aria-describedby={attempted && errs.date ? "inc-draft-date-err" : undefined}
            onChange={(e) => setDraft((d) => ({ ...d, lastPaycheckDate: e.target.value }))}
          />
          {attempted && errs.date && (
            <span id="inc-draft-date-err" className="field__error">{errs.date}</span>
          )}
        </div>
      )}
      <button className="btn" type="button" onClick={onAdd}>
        Add source
      </button>
    </div>
  );
}
