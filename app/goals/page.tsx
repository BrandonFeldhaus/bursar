"use client";

import { useEffect, useMemo, useState } from "react";
import { loadState, newId, saveState, type BudgetState, type Goal } from "../lib/storage";
import { useHydrated } from "../lib/useHydrated";

function moneyFmt(value: number) {
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  return `${v < 0 ? "−" : ""}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function GoalProgressBar({ pct, type }: { pct: number; type: "savings" | "debt" }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 100 ? "#2f6a4a" : type === "debt" ? "var(--signal-red)" : "var(--ink-1)";
  return (
    <div className="goal-progress-bar">
      <div className="goal-progress-bar__fill" style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

type LinkValue = "" | `cat:${string}` | `exp:${string}`;

type DraftGoal = {
  name: string;
  type: "savings" | "debt";
  targetAmount: number;
  link: LinkValue;
};

function parseLinkValue(val: LinkValue): { linkedBudgetCategoryId?: string; linkedExpenseId?: string } {
  if (val.startsWith("cat:")) return { linkedBudgetCategoryId: val.slice(4) };
  if (val.startsWith("exp:")) return { linkedExpenseId: val.slice(4) };
  return {};
}

function makeLinkValue(goal: Goal): LinkValue {
  if (goal.linkedBudgetCategoryId) return `cat:${goal.linkedBudgetCategoryId}`;
  if (goal.linkedExpenseId) return `exp:${goal.linkedExpenseId}`;
  return "";
}

export default function GoalsPage() {
  const hydrated = useHydrated();
  const [state, setState] = useState<BudgetState | null>(null);
  const [draft, setDraft] = useState<DraftGoal>({ name: "", type: "savings", targetAmount: 0, link: "" });

  useEffect(() => {
    if (!hydrated) return;
    setState(loadState());
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !state) return;
    saveState(state);
  }, [hydrated, state]);

  function addGoal() {
    const name = draft.name.trim();
    if (!name || draft.targetAmount <= 0) return;
    const linkFields = parseLinkValue(draft.link);
    setState((s) => {
      if (!s) return s;
      const newGoal: Goal = {
        id: newId(),
        name,
        type: draft.type,
        targetAmount: draft.targetAmount,
        appliedPeriods: [],
        ...linkFields,
      };
      return { ...s, goals: [...s.goals, newGoal] };
    });
    setDraft({ name: "", type: "savings", targetAmount: 0, link: "" });
  }

  function updateGoal(id: string, patch: Partial<Goal>) {
    setState((s) => s ? { ...s, goals: s.goals.map((g) => g.id === id ? { ...g, ...patch } : g) } : s);
  }

  function updateGoalLink(id: string, val: LinkValue) {
    const linkFields: Partial<Goal> = parseLinkValue(val);
    // Clear both link fields first
    setState((s) =>
      s ? {
        ...s,
        goals: s.goals.map((g) =>
          g.id === id
            ? { ...g, linkedBudgetCategoryId: undefined, linkedExpenseId: undefined, ...linkFields }
            : g
        ),
      } : s
    );
  }

  function removeGoal(id: string) {
    setState((s) => s ? { ...s, goals: s.goals.filter((g) => g.id !== id) } : s);
  }

  const derived = useMemo(() => {
    if (!state) return { totalApplied: 0, completed: 0 };
    let totalApplied = 0;
    let completed = 0;
    for (const g of state.goals) {
      const applied = g.appliedPeriods.reduce((s, p) => s + p.amount, 0);
      totalApplied += applied;
      if (applied >= g.targetAmount) completed++;
    }
    return { totalApplied, completed };
  }, [state]);

  if (!hydrated || !state) {
    return (
      <section className="container">
        <header className="sheet page-head">
          <p className="kicker">Goals</p>
          <h1 className="page-head__title">Goals &amp; Targets</h1>
          <p className="page-head__lead">Loading goals…</p>
        </header>
      </section>
    );
  }

  const { goals, budgetCategories, recurringExpenses } = state;
  const { totalApplied, completed } = derived;

  return (
    <section className="container">
      {/* Page head */}
      <header className="sheet page-head">
        <p className="kicker">Goals</p>
        <h1 className="page-head__title">Goals &amp; Targets</h1>
        <p className="page-head__lead">
          Track savings targets and debt payoff progress. Link a goal to a budget category or recurring bill so the overview widget can apply contributions each paycheck period.
        </p>
        <div className="page-head__meta">
          <div className="page-head__meta-item">
            <span className="page-head__meta-label">Active goals</span>
            <span className="page-head__meta-value">{goals.length}</span>
          </div>
          <div className="page-head__meta-item">
            <span className="page-head__meta-label">Total applied</span>
            <span className="page-head__meta-value">{moneyFmt(totalApplied)}</span>
          </div>
          <div className="page-head__meta-item">
            <span className="page-head__meta-label">Completed</span>
            <span className="page-head__meta-value">{completed}</span>
          </div>
        </div>
      </header>

      {/* Progress cards */}
      {goals.length > 0 && (
        <div className="goal-cards">
          {goals.map((g) => {
            const applied = g.appliedPeriods.reduce((s, p) => s + p.amount, 0);
            const pct = g.targetAmount > 0 ? (applied / g.targetAmount) * 100 : 0;
            const remaining = Math.max(0, g.targetAmount - applied);
            const linkedCat = budgetCategories.find((c) => c.id === g.linkedBudgetCategoryId);
            const linkedExp = recurringExpenses.find((e) => e.id === g.linkedExpenseId);
            const linkLabel = linkedCat ? linkedCat.name : linkedExp ? linkedExp.name : null;

            return (
              <div key={g.id} className="sheet goal-card">
                <div className="goal-card__head">
                  <div style={{ minWidth: 0 }}>
                    <p className="kicker">{g.type === "savings" ? "Savings" : "Debt payoff"}</p>
                    <h3 className="goal-card__title">{g.name}</h3>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {pct >= 100 && <span className="stamp stamp--paid">Done</span>}
                    <button
                      className="btn btn--icon"
                      type="button"
                      onClick={() => removeGoal(g.id)}
                      aria-label={`Delete ${g.name}`}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <GoalProgressBar pct={pct} type={g.type} />

                <div className="goal-card__amounts">
                  <span>
                    <span className="goal-card__amount-label">{g.type === "savings" ? "Saved" : "Paid"}</span>
                    <span className="goal-card__amount">{moneyFmt(applied)}</span>
                  </span>
                  <span className="goal-card__pct">{pct.toFixed(0)}%</span>
                  <span style={{ textAlign: "right" }}>
                    <span className="goal-card__amount-label">Target</span>
                    <span className="goal-card__amount">{moneyFmt(g.targetAmount)}</span>
                  </span>
                </div>

                <div className="goal-card__footer">
                  {linkLabel ? (
                    <span className="badge" style={{ fontSize: 10 }}>
                      Linked: {linkLabel}
                    </span>
                  ) : (
                    <span className="badge" style={{ fontSize: 10, opacity: 0.5 }}>No link</span>
                  )}
                  {remaining > 0 && (
                    <span style={{ fontFamily: "var(--font-hand)", fontSize: 14, color: "var(--ink-3)" }}>
                      {moneyFmt(remaining)} to go
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {goals.length === 0 && (
        <div className="sheet" style={{ padding: "28px 28px" }}>
          <p className="kicker">No goals yet</p>
          <p style={{ color: "var(--ink-3)", fontStyle: "italic", marginTop: 4 }}>
            Add a savings or debt payoff goal below to start tracking your progress.
          </p>
        </div>
      )}

      {/* Management table */}
      {goals.length > 0 && (
        <div className="sheet" style={{ paddingTop: "20px", paddingBottom: 0 }}>
          <div style={{ padding: "0 28px" }} className="row-between mb-3">
            <div>
              <p className="kicker">Manage</p>
              <h2 className="section-title">All goals</h2>
            </div>
          </div>
          <div className="ledger-table-wrap-no-line" style={{ borderRadius: "10px 10px 0 0" }}>
            <table className="ledger-table">
              <thead>
                <tr>
                  <th style={{ width: "30%" }}>Goal</th>
                  <th style={{ width: "12%" }}>Type</th>
                  <th style={{ width: "14%" }}>Target</th>
                  <th style={{ width: "12%" }}>Applied</th>
                  <th style={{ width: "27%" }}>Linked to</th>
                  <th className="text-tight" />
                </tr>
              </thead>
              <tbody>
                {goals.map((g) => {
                  const applied = g.appliedPeriods.reduce((s, p) => s + p.amount, 0);
                  const linkVal = makeLinkValue(g);
                  return (
                    <tr key={g.id}>
                      <td>
                        <input
                          className="input"
                          value={g.name}
                          onChange={(e) => updateGoal(g.id, { name: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          className="select"
                          value={g.type}
                          onChange={(e) => updateGoal(g.id, { type: e.target.value as "savings" | "debt" })}
                        >
                          <option value="savings">Savings</option>
                          <option value="debt">Debt</option>
                        </select>
                      </td>
                      <td className="mono">
                        <input
                          className="input input--mono"
                          type="text"
                          inputMode="decimal"
                          value={g.targetAmount || ""}
                          onChange={(e) =>
                            updateGoal(g.id, {
                              targetAmount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0),
                            })
                          }
                        />
                      </td>
                      <td className="mono">{moneyFmt(applied)}</td>
                      <td>
                        <select
                          className="select"
                          value={linkVal}
                          onChange={(e) => updateGoalLink(g.id, e.target.value as LinkValue)}
                        >
                          <option value="">None</option>
                          {budgetCategories.length > 0 && (
                            <optgroup label="Budget categories">
                              {budgetCategories.map((c) => (
                                <option key={c.id} value={`cat:${c.id}`}>{c.name}</option>
                              ))}
                            </optgroup>
                          )}
                          {recurringExpenses.length > 0 && (
                            <optgroup label="Recurring bills">
                              {recurringExpenses.map((e) => (
                                <option key={e.id} value={`exp:${e.id}`}>{e.name}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </td>
                      <td className="text-tight">
                        <button
                          className="btn btn--icon"
                          type="button"
                          onClick={() => removeGoal(g.id)}
                          aria-label={`Delete ${g.name}`}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add form */}
          <div className="inline-form inline-form--4col">
            <div className="field">
              <label className="field__label">Goal name</label>
              <input
                className="input"
                placeholder="e.g. Emergency fund"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addGoal()}
              />
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
                onKeyDown={(e) => e.key === "Enter" && addGoal()}
              />
            </div>
            <div className="field">
              <label className="field__label">Link to</label>
              <select
                className="select"
                value={draft.link}
                onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value as LinkValue }))}
              >
                <option value="">None</option>
                {budgetCategories.length > 0 && (
                  <optgroup label="Budget categories">
                    {budgetCategories.map((c) => (
                      <option key={c.id} value={`cat:${c.id}`}>{c.name}</option>
                    ))}
                  </optgroup>
                )}
                {recurringExpenses.length > 0 && (
                  <optgroup label="Recurring bills">
                    {recurringExpenses.map((e) => (
                      <option key={e.id} value={`exp:${e.id}`}>{e.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <button
              className="btn"
              type="button"
              onClick={addGoal}
              disabled={!draft.name.trim() || draft.targetAmount <= 0}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Add form when no goals yet */}
      {goals.length === 0 && (
        <div className="sheet" style={{ paddingTop: "20px", paddingBottom: 0 }}>
          <div style={{ padding: "0 28px" }} className="mb-3">
            <p className="kicker">New goal</p>
            <h2 className="section-title">Add your first goal</h2>
          </div>
          <div className="inline-form inline-form--4col">
            <div className="field">
              <label className="field__label">Goal name</label>
              <input
                className="input"
                placeholder="e.g. Emergency fund"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addGoal()}
              />
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
                onKeyDown={(e) => e.key === "Enter" && addGoal()}
              />
            </div>
            <div className="field">
              <label className="field__label">Link to</label>
              <select
                className="select"
                value={draft.link}
                onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value as LinkValue }))}
              >
                <option value="">None</option>
                {budgetCategories.length > 0 && (
                  <optgroup label="Budget categories">
                    {budgetCategories.map((c) => (
                      <option key={c.id} value={`cat:${c.id}`}>{c.name}</option>
                    ))}
                  </optgroup>
                )}
                {recurringExpenses.length > 0 && (
                  <optgroup label="Recurring bills">
                    {recurringExpenses.map((e) => (
                      <option key={e.id} value={`exp:${e.id}`}>{e.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <button
              className="btn"
              type="button"
              onClick={addGoal}
              disabled={!draft.name.trim() || draft.targetAmount <= 0}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
