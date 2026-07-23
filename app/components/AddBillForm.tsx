"use client";

import type { Dispatch, SetStateAction } from "react";

export type BillFormDraft = {
  name: string;
  amount: string;
  cadence: "monthly" | "annual";
  dueDay: number;
  dueMonth: number;
};

export const emptyBillDraft: BillFormDraft = { name: "", amount: "", cadence: "monthly", dueDay: 1, dueMonth: 1 };

export function billDraftErrors(draft: BillFormDraft) {
  const parsedAmount = Number(draft.amount.replace(/[^0-9.]/g, ""));
  return {
    parsedAmount,
    name: !draft.name.trim() ? "Required" : null,
    amount: !(parsedAmount > 0) ? "Must be more than 0" : null,
  };
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => (
  <option key={i + 1} value={i + 1}>
    {new Date(2026, i, 1).toLocaleDateString("en-US", { month: "short" })}
  </option>
));

export function AddBillForm({
  draft,
  setDraft,
  onAdd,
  attempted,
  formId,
  inSheet,
  combinedDue,
}: {
  draft: BillFormDraft;
  setDraft: Dispatch<SetStateAction<BillFormDraft>>;
  onAdd: () => void;
  attempted?: boolean;
  formId?: string;
  /** Renders inside the mobile BottomSheet — drops the sunk background/padding. */
  inSheet?: boolean;
  /** Merge due day + annual month into one field (onboarding's narrow card). */
  combinedDue?: boolean;
}) {
  const errs = billDraftErrors(draft);
  const cols = combinedDue || draft.cadence !== "annual" ? " inline-form--4col" : " inline-form--5col";
  const dueDayInput = (
    <input
      id="bill-draft-day"
      className="input input--mono"
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      placeholder="1"
      value={draft.dueDay || ""}
      style={combinedDue ? { width: "52px", flexShrink: 0 } : undefined}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
        const n = digits === "" ? 0 : Math.min(31, Number(digits));
        setDraft((d) => ({ ...d, dueDay: n }));
      }}
      onBlur={() => { if (!draft.dueDay || draft.dueDay < 1) setDraft((d) => ({ ...d, dueDay: 1 })); }}
    />
  );
  const monthSelect = (
    <select
      className="select"
      value={draft.dueMonth}
      aria-label="Annual month"
      onChange={(e) => setDraft((d) => ({ ...d, dueMonth: Number(e.target.value) }))}
    >
      {MONTH_OPTIONS}
    </select>
  );
  return (
    <div id={formId} className={`inline-form${cols}${inSheet ? " inline-form--sheet" : ""}`}>
      <div className={`field${attempted && errs.name ? " field--has-error" : ""}`}>
        <label className="field__label" htmlFor="bill-draft-name">New notation</label>
        <input
          id="bill-draft-name"
          className="input"
          placeholder="e.g. Internet"
          value={draft.name}
          aria-invalid={attempted && !!errs.name}
          aria-describedby={attempted && errs.name ? "bill-draft-name-err" : undefined}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        {attempted && errs.name && (
          <span id="bill-draft-name-err" className="field__error">{errs.name}</span>
        )}
      </div>
      <div className={`field${attempted && errs.amount ? " field--has-error" : ""}`}>
        <label className="field__label" htmlFor="bill-draft-amount">Amount</label>
        <input
          id="bill-draft-amount"
          className="input input--mono"
          type="text"
          inputMode="decimal"
          pattern="[0-9.]*"
          placeholder="0"
          value={draft.amount}
          aria-invalid={attempted && !!errs.amount}
          aria-describedby={attempted && errs.amount ? "bill-draft-amount-err" : undefined}
          onChange={(e) =>
            setDraft((d) => ({ ...d, amount: e.target.value.replace(/[^0-9.]/g, "") }))
          }
        />
        {attempted && errs.amount && (
          <span id="bill-draft-amount-err" className="field__error">{errs.amount}</span>
        )}
      </div>
      <div className="field">
        <label className="field__label">Cadence</label>
        <select
          className="select"
          value={draft.cadence}
          onChange={(e) => setDraft((d) => ({ ...d, cadence: e.target.value as "monthly" | "annual" }))}
        >
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </select>
      </div>
      {combinedDue ? (
        <div className="field">
          <label className="field__label" htmlFor="bill-draft-day">
            Due{draft.cadence === "annual" ? " day / month" : " day"}
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {dueDayInput}
            {draft.cadence === "annual" && monthSelect}
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <label className="field__label" htmlFor="bill-draft-day">Due day</label>
            {dueDayInput}
          </div>
          {draft.cadence === "annual" && (
            <div className="field">
              <label className="field__label">Month</label>
              {monthSelect}
            </div>
          )}
        </>
      )}
      <button className="btn" type="button" onClick={onAdd}>
        Add bill
      </button>
    </div>
  );
}
