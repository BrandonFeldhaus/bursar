"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { loadState, newId, saveState, type BudgetState, type Income, type PayCycle } from "../lib/storage";
import { useHydrated } from "../lib/useHydrated";
import { todayISO, monthlyIncomeOf } from "../lib/month";
import { UndoToast, type UndoEntry } from "../components/UndoToast";
import { SavedIndicator, useSavedIndicator } from "../components/SavedIndicator";
import { moneyFmt } from "../lib/currency";
import { jumpToAddForm } from "../lib/jumpToAddForm";

const needsAnchor = (cycle: PayCycle) => cycle === "biweekly" || cycle === "weekly";

const CYCLE_OPTIONS: { value: PayCycle; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "semimonthly", label: "Semi-monthly" },
];

export default function IncomePage() {
  const hydrated = useHydrated();
  const [state, setState] = useState<BudgetState | null>(null);
  const [draft, setDraft] = useState<{
    name: string;
    amount: string;
    payCycle: PayCycle;
    lastPaycheckDate: string;
  }>({
    name: "",
    amount: "",
    payCycle: "biweekly",
    lastPaycheckDate: todayISO(),
  });
  const [attempted, setAttempted] = useState(false);
  const [undo, setUndo] = useState<UndoEntry | null>(null);
  const saved = useSavedIndicator();

  useEffect(() => {
    if (!hydrated) return;
    setState(loadState());
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !state) return;
    saveState(state);
  }, [hydrated, state]);

  function update(id: string, patch: Partial<Income>) {
    setState((s) => s ? { ...s, incomes: s.incomes.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : s);
    saved.flash();
  }

  function remove(id: string) {
    setState((s) => {
      if (!s) return s;
      const index = s.incomes.findIndex((i) => i.id === id);
      const target = s.incomes[index];
      if (!target) return s;
      setUndo({
        id,
        message: `Deleted ${target.name || "income"}`,
        onUndo: () => {
          setState((cur) => {
            if (!cur) return cur;
            const restored = [...cur.incomes];
            restored.splice(index, 0, target);
            return { ...cur, incomes: restored };
          });
          saved.flash();
        },
      });
      return { ...s, incomes: s.incomes.filter((i) => i.id !== id) };
    });
  }

  const parsedAmount = Number(draft.amount.replace(/[^0-9.]/g, ""));
  const nameError = !draft.name.trim() ? "Required" : null;
  const amountError = !(parsedAmount > 0) ? "Must be more than 0" : null;
  const dateError = needsAnchor(draft.payCycle) && !draft.lastPaycheckDate ? "Pick a paycheck date" : null;
  const canAdd = !nameError && !amountError && !dateError;

  function add() {
    if (!canAdd) {
      setAttempted(true);
      return;
    }
    const name = draft.name.trim();
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        incomes: [
          ...s.incomes,
          {
            id: newId(),
            name,
            amount: Math.max(0, parsedAmount),
            cadence: "monthly" as const,
            payCycle: draft.payCycle,
            lastPaycheckDate: needsAnchor(draft.payCycle) ? draft.lastPaycheckDate || todayISO() : "",
          },
        ],
      };
    });
    setDraft({ name: "", amount: "", payCycle: "biweekly", lastPaycheckDate: todayISO() });
    setAttempted(false);
    saved.flash();
  }

  if (!hydrated || !state) {
    return (
      <section className="container" aria-busy="true">
        <header className="sheet page-head">
          <p className="kicker">Income</p>
          <h1 className="page-head__title">Income ledger</h1>
          <p className="page-head__lead">Loading income entries…</p>
        </header>
        <div className="sheet" style={{ padding: "20px 28px" }} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton--row" />
          ))}
        </div>
      </section>
    );
  }

  const monthly = monthlyIncomeOf(state);
  const annual = monthly * 12;
  const weeklyCount = state.incomes.filter((i) => i.payCycle === "weekly").length;
  const biweeklyCount = state.incomes.filter((i) => i.payCycle === "biweekly").length;
  const semiCount = state.incomes.filter((i) => i.payCycle === "semimonthly").length;

  return (
    <section className="container">
      {/* Page head */}
      <header className="sheet page-head">
        <p className="kicker">Income</p>
        <h1 className="page-head__title">Income ledger</h1>
        <p className="page-head__lead">Track all your income sources. Each one's paycheck dates are calculated independently and feed into your period breakdown.</p>
        <details className="cycle-info">
          <summary><Info size={14} aria-hidden="true" />About pay cycle types</summary>
          <dl className="cycle-info__list">
            <div>
              <dt>Weekly</dt>
              <dd>52 paychecks/year, every 7 days. Anchored to your most recent paycheck date.</dd>
            </div>
            <div>
              <dt>Bi-weekly</dt>
              <dd>26 paychecks/year, every 14 days. Anchored to your most recent paycheck date.</dd>
            </div>
            <div>
              <dt>Semi-monthly</dt>
              <dd>24 paychecks/year, always on the 1st and 15th. No anchor needed.</dd>
            </div>
          </dl>
        </details>
      </header>

      {/* Stats row */}
      <div className="stat-row stat-row--4">
        <article className="sheet stat" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Monthly income</div>
          <div className="stat__value">{moneyFmt(monthly)}</div>
        </article>
        <article className="sheet stat" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Weekly sources</div>
          <div className="stat__value">{weeklyCount}</div>
        </article>
        <article className="sheet stat" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Bi-weekly sources</div>
          <div className="stat__value">{biweeklyCount}</div>
        </article>
        <article className="sheet stat" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Semi-monthly sources</div>
          <div className="stat__value">{semiCount}</div>
        </article>
      </div>

      {/* Ledger table */}
      <div className="sheet" style={{ paddingTop: "20px", paddingBottom: 0 }}>
        <div style={{ padding: "0 28px" }} className="row-between mb-3">
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p className="kicker">Sources</p>
              <h2 className="section-title">All inflow lines</h2>
            </div>
            <SavedIndicator visible={saved.visible} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="btn mobile-only-inline btn--jump"
              onClick={() => jumpToAddForm()}
            >
              + Add source
            </button>
            <span className="badge">{state.incomes.length} sources</span>
          </div>
        </div>

        <div className="ledger-table-wrap-no-line" style={{ borderRadius: "0 0 0 0" }}>
          <table className="ledger-table ledger-table--responsive">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Source</th>
                <th className="text-right" style={{ width: "20%" }}>Amount</th>
                <th style={{ width: "20%" }}>Cycle</th>
                <th style={{ width: "25%" }}>Anchor / Days</th>
                <th className="text-tight" />
              </tr>
            </thead>
            <tbody>
              {state.incomes.map((inc) => (
                <tr key={inc.id}>
                  <td data-label="Source">
                    <input
                      className="input"
                      value={inc.name}
                      aria-label="Income source name"
                      onChange={(e) => update(inc.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="text-right mono" data-label="Amount">
                    <input
                      className="input input--mono"
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9.]*"
                      value={inc.amount}
                      aria-label="Income amount"
                      onChange={(e) =>
                        update(inc.id, { amount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) })
                      }
                    />
                  </td>
                  <td data-label="Cycle">
                    <select
                      className="select"
                      value={inc.payCycle}
                      aria-label="Pay cycle"
                      onChange={(e) => {
                        const next = e.target.value as PayCycle;
                        update(inc.id, {
                          payCycle: next,
                          lastPaycheckDate: needsAnchor(next) ? inc.lastPaycheckDate || todayISO() : "",
                        });
                      }}
                    >
                      {CYCLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Anchor">
                    {needsAnchor(inc.payCycle) ? (
                      <input
                        className="input"
                        type="date"
                        value={inc.lastPaycheckDate || ""}
                        aria-label="Last paycheck date"
                        onChange={(e) => update(inc.id, { lastPaycheckDate: e.target.value })}
                      />
                    ) : (
                      <span className="muted" style={{ fontStyle: "italic" }}>1st &amp; 15th</span>
                    )}
                  </td>
                  <td className="text-tight">
                    <button
                      className="btn btn--icon"
                      type="button"
                      aria-label={`Delete ${inc.name || "income"}`}
                      onClick={() => remove(inc.id)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inline add form */}
        <div id="add-form" className={`inline-form${needsAnchor(draft.payCycle) ? " inline-form--4col" : ""}`}>
          <div className={`field${attempted && nameError ? " field--has-error" : ""}`}>
            <label className="field__label" htmlFor="inc-draft-name">New source</label>
            <input
              id="inc-draft-name"
              className="input"
              placeholder="e.g. Day job"
              value={draft.name}
              aria-invalid={attempted && !!nameError}
              aria-describedby={attempted && nameError ? "inc-draft-name-err" : undefined}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
            {attempted && nameError && (
              <span id="inc-draft-name-err" className="field__error">{nameError}</span>
            )}
          </div>
          <div className={`field${attempted && amountError ? " field--has-error" : ""}`}>
            <label className="field__label" htmlFor="inc-draft-amount">Amount</label>
            <input
              id="inc-draft-amount"
              className="input input--mono"
              type="text"
              inputMode="decimal"
              pattern="[0-9.]*"
              placeholder="0"
              value={draft.amount}
              aria-invalid={attempted && !!amountError}
              aria-describedby={attempted && amountError ? "inc-draft-amount-err" : undefined}
              onChange={(e) =>
                setDraft((d) => ({ ...d, amount: e.target.value.replace(/[^0-9.]/g, "") }))
              }
            />
            {attempted && amountError && (
              <span id="inc-draft-amount-err" className="field__error">{amountError}</span>
            )}
          </div>
          <div className="field">
            <label className="field__label">Cycle</label>
            <select
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
            <div className={`field${attempted && dateError ? " field--has-error" : ""}`}>
              <label className="field__label" htmlFor="inc-draft-date">Last paycheck</label>
              <input
                id="inc-draft-date"
                className="input"
                type="date"
                value={draft.lastPaycheckDate}
                aria-invalid={attempted && !!dateError}
                aria-describedby={attempted && dateError ? "inc-draft-date-err" : undefined}
                onChange={(e) => setDraft((d) => ({ ...d, lastPaycheckDate: e.target.value }))}
              />
              {attempted && dateError && (
                <span id="inc-draft-date-err" className="field__error">{dateError}</span>
              )}
            </div>
          )}
          <button className="btn" type="button" onClick={add}>
            Add source
          </button>
        </div>
      </div>
      <UndoToast entry={undo} onDismiss={() => setUndo(null)} />
    </section>
  );
}
