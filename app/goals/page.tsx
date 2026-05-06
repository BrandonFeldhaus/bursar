"use client";

import { type Dispatch, type SetStateAction, Fragment, useEffect, useMemo, useState } from "react";
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

function goalTotalApplied(g: Goal): number {
  return (
    g.appliedPeriods.reduce((s, p) => s + p.amount, 0) +
    g.manualAdjustments.reduce((s, a) => s + a.amount, 0)
  );
}

function parseAdjAmount(raw: string): number {
  return parseFloat(raw.replace(/−/g, "-").replace(/[^0-9.\-]/g, ""));
}

type DraftGoal = {
  name: string;
  type: "savings" | "debt";
  targetAmount: number;
  linkedBudgetCategoryIds: string[];
  linkedExpenseIds: string[];
};

function AddGoalForm({
  draft,
  setDraft,
  onAdd,
  budgetCategories,
  recurringExpenses,
}: {
  draft: DraftGoal;
  setDraft: Dispatch<SetStateAction<DraftGoal>>;
  onAdd: () => void;
  budgetCategories: { id: string; name: string }[];
  recurringExpenses: { id: string; name: string }[];
}) {
  const hasLinkable = budgetCategories.length > 0 || recurringExpenses.length > 0;
  const sunkStyle = { background: "var(--surface-sunk)" } as const;
  return (
    <>
      <div className="inline-form inline-form--3col" style={{ ...sunkStyle, borderRadius: 0, paddingBottom: 12 }}>
        <div className="field">
          <label className="field__label">Goal name</label>
          <input
            className="input"
            placeholder="e.g. Emergency fund"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
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
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
          />
        </div>
      </div>
      {hasLinkable && (
        <div style={{ ...sunkStyle, padding: "0 24px 12px" }}>
          <p className="field__label" style={{ marginBottom: 6 }}>Link to</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px" }}>
            {budgetCategories.map((c) => {
              const checked = draft.linkedBudgetCategoryIds.includes(c.id);
              return (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
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
                    style={{ accentColor: "var(--ink-1)", flexShrink: 0 }}
                  />
                  {c.name}
                </label>
              );
            })}
            {recurringExpenses.map((e) => {
              const checked = draft.linkedExpenseIds.includes(e.id);
              return (
                <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
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
                    style={{ accentColor: "var(--ink-1)", flexShrink: 0 }}
                  />
                  {e.name}
                </label>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ ...sunkStyle, padding: "8px 24px 18px", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)" }}>
        <button
          className="btn"
          type="button"
          onClick={onAdd}
          disabled={!draft.name.trim() || draft.targetAmount <= 0}
        >
          Add goal
        </button>
      </div>
    </>
  );
}

export default function GoalsPage() {
  const hydrated = useHydrated();
  const [state, setState] = useState<BudgetState | null>(null);
  const [draft, setDraft] = useState<DraftGoal>({ name: "", type: "savings", targetAmount: 0, linkedBudgetCategoryIds: [], linkedExpenseIds: [] });
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");

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
    setState((s) => {
      if (!s) return s;
      const newGoal: Goal = {
        id: newId(),
        name,
        type: draft.type,
        targetAmount: draft.targetAmount,
        linkedBudgetCategoryIds: draft.linkedBudgetCategoryIds,
        linkedExpenseIds: draft.linkedExpenseIds,
        manualAdjustments: [],
        appliedPeriods: [],
      };
      return { ...s, goals: [...s.goals, newGoal] };
    });
    setDraft({ name: "", type: "savings", targetAmount: 0, linkedBudgetCategoryIds: [], linkedExpenseIds: [] });
  }

  function updateGoal(id: string, patch: Partial<Goal>) {
    setState((s) => s ? { ...s, goals: s.goals.map((g) => g.id === id ? { ...g, ...patch } : g) } : s);
  }

  function removeGoal(id: string) {
    setState((s) => s ? { ...s, goals: s.goals.filter((g) => g.id !== id) } : s);
    if (expandedGoalId === id) setExpandedGoalId(null);
  }

  function addManualAdjustment(goalId: string) {
    const amt = parseAdjAmount(adjAmount);
    if (isNaN(amt) || amt === 0) return;
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        goals: s.goals.map((g) => {
          if (g.id !== goalId) return g;
          return {
            ...g,
            manualAdjustments: [
              ...g.manualAdjustments,
              { id: newId(), amount: amt, note: adjNote.trim() || undefined },
            ],
          };
        }),
      };
    });
    setAdjAmount("");
    setAdjNote("");
  }

  function removeManualAdjustment(goalId: string, adjId: string) {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        goals: s.goals.map((g) => {
          if (g.id !== goalId) return g;
          return { ...g, manualAdjustments: g.manualAdjustments.filter((a) => a.id !== adjId) };
        }),
      };
    });
  }

  const derived = useMemo(() => {
    if (!state) return { totalApplied: 0, completed: 0 };
    let totalApplied = 0;
    let completed = 0;
    for (const g of state.goals) {
      const applied = goalTotalApplied(g);
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
          Track savings targets and debt payoff progress. Link a goal to multiple budget categories or recurring bills so the period widget can apply contributions each paycheck.
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
            const applied = goalTotalApplied(g);
            const pct = g.targetAmount > 0 ? (applied / g.targetAmount) * 100 : 0;
            const remaining = Math.max(0, g.targetAmount - applied);
            const linkedCats = g.linkedBudgetCategoryIds
              .map((id) => budgetCategories.find((c) => c.id === id))
              .filter(Boolean) as { id: string; name: string }[];
            const linkedExps = g.linkedExpenseIds
              .map((id) => recurringExpenses.find((e) => e.id === id))
              .filter(Boolean) as { id: string; name: string }[];

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
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {linkedCats.length === 0 && linkedExps.length === 0
                      ? <span className="badge" style={{ fontSize: 10, opacity: 0.5 }}>No link</span>
                      : <>
                          {linkedCats.map((c) => <span key={`cat:${c.id}`} className="badge" style={{ fontSize: 10 }}>{c.name}</span>)}
                          {linkedExps.map((e) => <span key={`exp:${e.id}`} className="badge" style={{ fontSize: 10 }}>{e.name}</span>)}
                        </>
                    }
                  </div>
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
                  <th style={{ width: "24%" }}>Goal</th>
                  <th style={{ width: "9%" }}>Type</th>
                  <th style={{ width: "11%" }}>Target</th>
                  <th style={{ width: "10%" }}>Applied</th>
                  <th style={{ width: "38%" }}>Linked to</th>
                  <th className="text-tight" style={{ width: "8%" }} />
                </tr>
              </thead>
              <tbody>
                {goals.map((g) => {
                  const applied = goalTotalApplied(g);
                  const isExpanded = expandedGoalId === g.id;
                  return (
                    <Fragment key={g.id}>
                      <tr>
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
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {g.linkedBudgetCategoryIds.map((id) => {
                              const cat = budgetCategories.find((c) => c.id === id);
                              return cat ? <span key={id} className="badge" style={{ fontSize: 10 }}>{cat.name}</span> : null;
                            })}
                            {g.linkedExpenseIds.map((id) => {
                              const exp = recurringExpenses.find((e) => e.id === id);
                              return exp ? <span key={id} className="badge" style={{ fontSize: 10 }}>{exp.name}</span> : null;
                            })}
                            {g.linkedBudgetCategoryIds.length === 0 && g.linkedExpenseIds.length === 0 && (
                              <span style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}>None</span>
                            )}
                          </div>
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button
                              className="btn btn--ghost"
                              type="button"
                              title="Edit links &amp; adjustments"
                              aria-label={`Edit ${g.name}`}
                              onClick={() => {
                                setExpandedGoalId(isExpanded ? null : g.id);
                                setAdjAmount("");
                                setAdjNote("");
                              }}
                              style={{ fontSize: 11, padding: "2px 7px", fontWeight: 600, color: isExpanded ? "var(--ink-1)" : undefined }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn--icon"
                              type="button"
                              onClick={() => removeGoal(g.id)}
                              aria-label={`Delete ${g.name}`}
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} style={{ background: "var(--surface-sunk)", padding: "14px 18px", borderTop: "1px dashed var(--border-soft)" }}>
                            {/* Links section */}
                            <p className="kicker" style={{ marginBottom: 8 }}>Links — {g.name}</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", marginBottom: 16 }}>
                              {budgetCategories.length === 0 && recurringExpenses.length === 0 && (
                                <span style={{ fontSize: 12, color: "var(--ink-4)", fontStyle: "italic" }}>No budget categories or bills set up yet.</span>
                              )}
                              {budgetCategories.map((c) => {
                                const checked = g.linkedBudgetCategoryIds.includes(c.id);
                                return (
                                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        updateGoal(g.id, {
                                          linkedBudgetCategoryIds: checked
                                            ? g.linkedBudgetCategoryIds.filter((id) => id !== c.id)
                                            : [...g.linkedBudgetCategoryIds, c.id],
                                        })
                                      }
                                      style={{ accentColor: "var(--ink-1)", flexShrink: 0 }}
                                    />
                                    {c.name}
                                  </label>
                                );
                              })}
                              {recurringExpenses.map((e) => {
                                const checked = g.linkedExpenseIds.includes(e.id);
                                return (
                                  <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        updateGoal(g.id, {
                                          linkedExpenseIds: checked
                                            ? g.linkedExpenseIds.filter((id) => id !== e.id)
                                            : [...g.linkedExpenseIds, e.id],
                                        })
                                      }
                                      style={{ accentColor: "var(--ink-1)", flexShrink: 0 }}
                                    />
                                    {e.name}
                                  </label>
                                );
                              })}
                            </div>
                            {/* Adjustments section */}
                            <p className="kicker" style={{ marginBottom: 8 }}>Adjustments</p>
                            {g.manualAdjustments.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                                {g.manualAdjustments.map((a) => (
                                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                                    <span style={{ fontFamily: "var(--font-numerals)", minWidth: 90, color: a.amount < 0 ? "var(--signal-red)" : "var(--ink-1)" }}>
                                      {a.amount > 0 ? "+" : ""}{moneyFmt(a.amount)}
                                    </span>
                                    {a.note
                                      ? <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>{a.note}</span>
                                      : <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>—</span>
                                    }
                                    <button
                                      className="btn btn--icon"
                                      type="button"
                                      style={{ marginLeft: "auto" }}
                                      onClick={() => removeManualAdjustment(g.id, a.id)}
                                      aria-label="Remove adjustment"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p style={{ color: "var(--ink-4)", fontStyle: "italic", fontSize: 13, marginBottom: 10 }}>No manual adjustments yet.</p>
                            )}
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                              <div className="field" style={{ margin: 0 }}>
                                <label className="field__label">Amount (negative to subtract)</label>
                                <input
                                  className="input input--mono"
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="e.g. −500 or 100"
                                  value={adjAmount}
                                  style={{ width: 150 }}
                                  onChange={(e) => setAdjAmount(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && addManualAdjustment(g.id)}
                                />
                              </div>
                              <div className="field" style={{ margin: 0 }}>
                                <label className="field__label">Note (optional)</label>
                                <input
                                  className="input"
                                  type="text"
                                  placeholder="e.g. Emergency withdrawal"
                                  value={adjNote}
                                  style={{ width: 220 }}
                                  onChange={(e) => setAdjNote(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && addManualAdjustment(g.id)}
                                />
                              </div>
                              <button
                                className="btn"
                                type="button"
                                onClick={() => addManualAdjustment(g.id)}
                                disabled={!adjAmount.trim() || isNaN(parseAdjAmount(adjAmount)) || parseAdjAmount(adjAmount) === 0}
                              >
                                Apply
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AddGoalForm draft={draft} setDraft={setDraft} onAdd={addGoal} budgetCategories={budgetCategories} recurringExpenses={recurringExpenses} />
        </div>
      )}

      {/* Add form when no goals yet */}
      {goals.length === 0 && (
        <div className="sheet" style={{ paddingTop: "20px", paddingBottom: 0 }}>
          <div style={{ padding: "0 28px" }} className="mb-3">
            <p className="kicker">New goal</p>
            <h2 className="section-title">Add your first goal</h2>
          </div>
          <AddGoalForm draft={draft} setDraft={setDraft} onAdd={addGoal} budgetCategories={budgetCategories} recurringExpenses={recurringExpenses} />
        </div>
      )}
    </section>
  );
}
