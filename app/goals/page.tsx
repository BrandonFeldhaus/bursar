"use client";

import { type Dispatch, type SetStateAction, Fragment, useEffect, useMemo, useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { loadState, newId, saveState, type BudgetState, type Goal } from "../lib/storage";
import { useHydrated } from "../lib/useHydrated";
import { useIsMobile } from "../lib/useIsMobile";
import { moneyFmt } from "../lib/currency";
import { SavedIndicator, useSavedIndicator } from "../components/SavedIndicator";
import { UndoToast, type UndoEntry } from "../components/UndoToast";
import { BottomSheet } from "../components/BottomSheet";
import { AddGoalForm, emptyGoalDraft, type DraftGoal } from "../components/AddGoalForm";
import { jumpToAddForm } from "../lib/jumpToAddForm";
import { toISODate } from "../lib/month";
import { formatAdjustmentDate, sortAdjustmentsForDisplay } from "../lib/goalAdjustments";

const RECENT_ADJ_COUNT = 3;

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
  return parseFloat(raw.replace(/[^0-9.]/g, ""));
}

type AdjSign = 1 | -1;

function GoalEditor({
  goal,
  budgetCategories,
  recurringExpenses,
  onUpdate,
  adjAmount,
  setAdjAmount,
  adjSign,
  setAdjSign,
  adjNote,
  setAdjNote,
  onAddAdjustment,
  onRemoveAdjustment,
  showAllAdj,
  onToggleShowAllAdj,
  inSheet,
}: {
  goal: Goal;
  budgetCategories: { id: string; name: string }[];
  recurringExpenses: { id: string; name: string }[];
  onUpdate: (patch: Partial<Goal>) => void;
  adjAmount: string;
  setAdjAmount: Dispatch<SetStateAction<string>>;
  adjSign: AdjSign;
  setAdjSign: Dispatch<SetStateAction<AdjSign>>;
  adjNote: string;
  setAdjNote: Dispatch<SetStateAction<string>>;
  onAddAdjustment: () => void;
  onRemoveAdjustment: (adjId: string) => void;
  showAllAdj: boolean;
  onToggleShowAllAdj: () => void;
  inSheet?: boolean;
}) {
  const sortedAdj = sortAdjustmentsForDisplay(goal.manualAdjustments);
  const visibleAdj = showAllAdj ? sortedAdj : sortedAdj.slice(0, RECENT_ADJ_COUNT);
  return (
    <>
      {/* Links section */}
      <p className="kicker" style={{ marginBottom: 8 }}>{inSheet ? "Links" : `Links — ${goal.name}`}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", marginBottom: 16 }}>
        {budgetCategories.length === 0 && recurringExpenses.length === 0 && (
          <span style={{ fontSize: 12, color: "var(--ink-4)", fontStyle: "italic" }}>No budget categories or bills set up yet.</span>
        )}
        {budgetCategories.map((c) => {
          const checked = goal.linkedBudgetCategoryIds.includes(c.id);
          return (
            <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onUpdate({
                    linkedBudgetCategoryIds: checked
                      ? goal.linkedBudgetCategoryIds.filter((id) => id !== c.id)
                      : [...goal.linkedBudgetCategoryIds, c.id],
                  })
                }
                style={{ accentColor: "var(--ink-1)", flexShrink: 0 }}
              />
              {c.name}
            </label>
          );
        })}
        {recurringExpenses.map((e) => {
          const checked = goal.linkedExpenseIds.includes(e.id);
          return (
            <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onUpdate({
                    linkedExpenseIds: checked
                      ? goal.linkedExpenseIds.filter((id) => id !== e.id)
                      : [...goal.linkedExpenseIds, e.id],
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
      {sortedAdj.length > 0 ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: sortedAdj.length > RECENT_ADJ_COUNT ? 6 : 12, ...(showAllAdj ? { maxHeight: 180, overflowY: "auto" } : {}) }}>
            {visibleAdj.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ color: "var(--ink-4)", fontSize: 12, minWidth: 52, flexShrink: 0 }}>
                  {a.date ? formatAdjustmentDate(a.date) : "—"}
                </span>
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
                  style={{ marginLeft: "auto", flexShrink: 0 }}
                  onClick={() => onRemoveAdjustment(a.id)}
                  aria-label="Remove adjustment"
                >
                  <IconX size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          {sortedAdj.length > RECENT_ADJ_COUNT && (
            <button
              className="btn btn--ghost"
              type="button"
              onClick={onToggleShowAllAdj}
              style={{ fontSize: 12, padding: "2px 8px", marginBottom: 12 }}
            >
              {showAllAdj ? "Show recent" : `Show all (${sortedAdj.length})`}
            </button>
          )}
        </>
      ) : (
        <p style={{ color: "var(--ink-4)", fontStyle: "italic", fontSize: 13, marginBottom: 10 }}>No manual adjustments yet.</p>
      )}
      <div
        className="inline-form inline-form--2col"
        style={{ padding: 0, background: "transparent", borderRadius: 0 }}
      >
        <div className="field">
          <label className="field__label">Amount</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div className="segment" role="radiogroup" aria-label="Add or subtract" style={{ width: "auto", flex: "0 0 auto" }}>
              <button
                type="button"
                role="radio"
                aria-checked={adjSign === 1}
                aria-label="Add to goal"
                className={`segment__btn${adjSign === 1 ? " segment__btn--active" : ""}`}
                style={{ fontSize: 15, minWidth: 40, height: 32 }}
                onClick={() => setAdjSign(1)}
              >
                +
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={adjSign === -1}
                aria-label="Subtract from goal"
                className={`segment__btn${adjSign === -1 ? " segment__btn--active" : ""}`}
                style={{ fontSize: 15, minWidth: 40, height: 32 }}
                onClick={() => setAdjSign(-1)}
              >
                −
              </button>
            </div>
            <input
              className="input input--mono"
              type="text"
              inputMode="decimal"
              pattern="[0-9.]*"
              placeholder="e.g. 500"
              value={adjAmount}
              onChange={(e) => {
                const raw = e.target.value;
                if (/[-−]/.test(raw)) setAdjSign(-1);
                else if (/\+/.test(raw)) setAdjSign(1);
                setAdjAmount(raw.replace(/[^0-9.]/g, ""));
              }}
              onKeyDown={(e) => e.key === "Enter" && onAddAdjustment()}
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
        </div>
        <div className="field">
          <label className="field__label">Note (optional)</label>
          <input
            className="input"
            type="text"
            placeholder="e.g. Emergency withdrawal"
            value={adjNote}
            onChange={(e) => setAdjNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddAdjustment()}
          />
        </div>
        <button
          className="btn"
          type="button"
          onClick={onAddAdjustment}
          disabled={!adjAmount.trim() || isNaN(parseAdjAmount(adjAmount)) || parseAdjAmount(adjAmount) === 0}
        >
          Apply
        </button>
      </div>
    </>
  );
}

export default function GoalsPage() {
  const hydrated = useHydrated();
  const isMobile = useIsMobile();
  const [state, setState] = useState<BudgetState | null>(null);
  const [draft, setDraft] = useState<DraftGoal>(emptyGoalDraft);
  const [addOpen, setAddOpen] = useState(false);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjSign, setAdjSign] = useState<AdjSign>(1);
  const [adjNote, setAdjNote] = useState("");
  const [adjShowAll, setAdjShowAll] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const savedIndicator = useSavedIndicator();
  const [undo, setUndo] = useState<UndoEntry | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    setState(loadState());
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !state) return;
    saveState(state);
  }, [hydrated, state]);

  function addGoal(): boolean {
    const name = draft.name.trim();
    if (!name || draft.targetAmount <= 0) {
      setAttempted(true);
      return false;
    }
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
    setDraft(emptyGoalDraft);
    setAttempted(false);
    savedIndicator.flash();
    return true;
  }

  function updateGoal(id: string, patch: Partial<Goal>) {
    setState((s) => s ? { ...s, goals: s.goals.map((g) => g.id === id ? { ...g, ...patch } : g) } : s);
    savedIndicator.flash();
  }

  function removeGoal(id: string) {
    setState((s) => {
      if (!s) return s;
      const index = s.goals.findIndex((g) => g.id === id);
      const target = s.goals[index];
      if (!target) return s;
      setUndo({
        id,
        message: `Deleted ${target.name || "goal"}`,
        onUndo: () => {
          setState((cur) => {
            if (!cur) return cur;
            const restored = [...cur.goals];
            restored.splice(index, 0, target);
            return { ...cur, goals: restored };
          });
          savedIndicator.flash();
        },
      });
      return { ...s, goals: s.goals.filter((g) => g.id !== id) };
    });
    if (expandedGoalId === id) setExpandedGoalId(null);
  }

  function addManualAdjustment(goalId: string) {
    const magnitude = parseAdjAmount(adjAmount);
    if (isNaN(magnitude) || magnitude === 0) return;
    const amt = adjSign * magnitude;
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
              { id: newId(), amount: amt, note: adjNote.trim() || undefined, date: toISODate(new Date()) },
            ],
          };
        }),
      };
    });
    setAdjAmount("");
    setAdjNote("");
    savedIndicator.flash();
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
    savedIndicator.flash();
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
      <section className="container" aria-busy="true">
        <header className="sheet page-head">
          <p className="kicker">Goals</p>
          <h1 className="page-head__title">Goals &amp; Targets</h1>
          <p className="page-head__lead">Loading goals…</p>
        </header>
        <div className="sheet" style={{ padding: "20px 28px" }} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton--row" />
          ))}
        </div>
      </section>
    );
  }

  const { goals, budgetCategories, recurringExpenses } = state;
  const { totalApplied, completed } = derived;
  const expandedGoal = goals.find((g) => g.id === expandedGoalId) ?? null;

  return (
    <section className="container">
      {/* Page head */}
      <header className="sheet page-head">
        <p className="kicker">Goals</p>
        <h1 className="page-head__title">Goals &amp; Targets</h1>
        <p className="page-head__lead">
          Track savings targets and debt payoff progress. Link a goal to multiple budget categories or recurring bills so the period widget can apply contributions each paycheck.
        </p>
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
                      <IconX size={16} aria-hidden="true" />
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
            <button
              type="button"
              className="btn mobile-only-inline btn--jump"
              onClick={() => (isMobile ? setAddOpen(true) : jumpToAddForm())}
            >
              <IconPlus size={12} aria-hidden="true" />Add goal
            </button>
          </div>
          <div className="ledger-table-wrap-no-line" style={{ borderRadius: "0 0 0 0" }}>
            <table className="ledger-table ledger-table--responsive">
              <thead>
                <tr>
                  <th style={{ width: "24%" }}>Goal</th>
                  <th style={{ width: "9%" }}>Type</th>
                  <th className="text-right" style={{ width: "11%" }}>Target</th>
                  <th style={{ width: "10%" }}>Applied</th>
                  <th style={{ width: "38%" }}>Linked to</th>
                  <th className="text-tight" style={{ width: "8%" }} />
                </tr>
              </thead>
              <tbody>
                {goals.map((g) => {
                  const applied = goalTotalApplied(g);
                  const pct = g.targetAmount > 0 ? (applied / g.targetAmount) * 100 : 0;
                  const isExpanded = expandedGoalId === g.id;
                  return (
                    <Fragment key={g.id}>
                      <tr>
                        <td data-label="Goal">
                          <input
                            className="input"
                            value={g.name}
                            onChange={(e) => updateGoal(g.id, { name: e.target.value })}
                          />
                          <div className="goal-row-progress" aria-hidden="true">
                            <GoalProgressBar pct={pct} type={g.type} />
                            <div className="goal-row-progress__meta">
                              <span>{moneyFmt(applied)} / {moneyFmt(g.targetAmount)}</span>
                              <span className="goal-row-progress__pct">{pct.toFixed(0)}%</span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Type">
                          <select
                            className="select"
                            value={g.type}
                            onChange={(e) => updateGoal(g.id, { type: e.target.value as "savings" | "debt" })}
                          >
                            <option value="savings">Savings</option>
                            <option value="debt">Debt</option>
                          </select>
                        </td>
                        <td className="text-right mono" data-label="Target">
                          <input
                            className="input input--mono"
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9.]*"
                            value={g.targetAmount || ""}
                            onChange={(e) =>
                              updateGoal(g.id, {
                                targetAmount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0),
                              })
                            }
                          />
                        </td>
                        <td className="mono" data-label="Applied">{moneyFmt(applied)}</td>
                        <td data-label="Linked to">
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
                        <td className="text-tight" style={{ verticalAlign: "middle" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button
                              className="btn btn--ghost"
                              type="button"
                              title="Edit links &amp; adjustments"
                              aria-label={`Edit ${g.name}`}
                              onClick={() => {
                                setExpandedGoalId(isExpanded ? null : g.id);
                                setAdjAmount("");
                                setAdjSign(1);
                                setAdjNote("");
                                setAdjShowAll(false);
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
                              <IconX size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && !isMobile && (
                        <tr>
                          <td colSpan={6} style={{ background: "var(--surface-sunk)", padding: "14px 18px", borderTop: "1px dashed var(--border-soft)" }}>
                            <GoalEditor
                              goal={g}
                              budgetCategories={budgetCategories}
                              recurringExpenses={recurringExpenses}
                              onUpdate={(patch) => updateGoal(g.id, patch)}
                              adjAmount={adjAmount}
                              setAdjAmount={setAdjAmount}
                              adjSign={adjSign}
                              setAdjSign={setAdjSign}
                              adjNote={adjNote}
                              setAdjNote={setAdjNote}
                              onAddAdjustment={() => addManualAdjustment(g.id)}
                              onRemoveAdjustment={(adjId) => removeManualAdjustment(g.id, adjId)}
                              showAllAdj={adjShowAll}
                              onToggleShowAllAdj={() => setAdjShowAll((v) => !v)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!isMobile && (
            <AddGoalForm formId="add-form" draft={draft} setDraft={setDraft} onAdd={addGoal} budgetCategories={budgetCategories} recurringExpenses={recurringExpenses} attempted={attempted} />
          )}
        </div>
      )}

      {/* Add form when no goals yet */}
      {goals.length === 0 && (
        <div className="sheet" style={{ paddingTop: "20px", paddingBottom: 0 }}>
          <div style={{ padding: "0 28px" }} className="mb-3">
            <p className="kicker">New goal</p>
            <h2 className="section-title">Add your first goal</h2>
          </div>
          <AddGoalForm draft={draft} setDraft={setDraft} onAdd={addGoal} budgetCategories={budgetCategories} recurringExpenses={recurringExpenses} attempted={attempted} />
        </div>
      )}

      {/* Mobile add sheet — same form the desktop inline block uses */}
      {isMobile && addOpen && (
        <BottomSheet open title="Add goal" onClose={() => setAddOpen(false)}>
          <AddGoalForm
            inSheet
            draft={draft}
            setDraft={setDraft}
            onAdd={() => { if (addGoal()) setAddOpen(false); }}
            budgetCategories={budgetCategories}
            recurringExpenses={recurringExpenses}
            attempted={attempted}
          />
        </BottomSheet>
      )}

      {/* Mobile edit sheet — same editor the desktop inline row uses */}
      {isMobile && expandedGoal && (
        <BottomSheet
          open
          title={`Edit — ${expandedGoal.name || "goal"}`}
          onClose={() => setExpandedGoalId(null)}
        >
          <GoalEditor
            goal={expandedGoal}
            budgetCategories={budgetCategories}
            recurringExpenses={recurringExpenses}
            onUpdate={(patch) => updateGoal(expandedGoal.id, patch)}
            adjAmount={adjAmount}
            setAdjAmount={setAdjAmount}
            adjSign={adjSign}
            setAdjSign={setAdjSign}
            adjNote={adjNote}
            setAdjNote={setAdjNote}
            onAddAdjustment={() => addManualAdjustment(expandedGoal.id)}
            onRemoveAdjustment={(adjId) => removeManualAdjustment(expandedGoal.id, adjId)}
            showAllAdj={adjShowAll}
            onToggleShowAllAdj={() => setAdjShowAll((v) => !v)}
            inSheet
          />
        </BottomSheet>
      )}

      {/* SavedIndicator and UndoToast */}
      <SavedIndicator visible={savedIndicator.visible} />
      <UndoToast entry={undo} onDismiss={() => setUndo(null)} />
    </section>
  );
}
