"use client";

import { type CSSProperties, type Dispatch, type SetStateAction, Fragment, useEffect, useMemo, useState } from "react";
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
  const tone = clamped >= 100 ? " goal-progress-bar__fill--done" : type === "debt" ? " goal-progress-bar__fill--debt" : "";
  return (
    <div className="goal-progress-bar">
      <div className={`goal-progress-bar__fill${tone}`} style={{ "--pct": `${clamped}%` } as CSSProperties} />
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
      <p className="kicker goal-editor__kicker">{inSheet ? "Links" : `Links — ${goal.name}`}</p>
      <div className="link-check-list goal-editor__links">
        {budgetCategories.length === 0 && recurringExpenses.length === 0 && (
          <span className="goal-editor__empty">No budget categories or bills set up yet.</span>
        )}
        {budgetCategories.map((c) => {
          const checked = goal.linkedBudgetCategoryIds.includes(c.id);
          return (
            <label key={c.id} className="link-check">
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
                className="link-check__box"
              />
              {c.name}
            </label>
          );
        })}
        {recurringExpenses.map((e) => {
          const checked = goal.linkedExpenseIds.includes(e.id);
          return (
            <label key={e.id} className="link-check">
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
                className="link-check__box"
              />
              {e.name}
            </label>
          );
        })}
      </div>
      {/* Adjustments section */}
      <p className="kicker goal-editor__kicker">Adjustments</p>
      {sortedAdj.length > 0 ? (
        <>
          <div className={`goal-editor__adj-list${sortedAdj.length > RECENT_ADJ_COUNT ? " goal-editor__adj-list--more" : ""}${showAllAdj ? " goal-editor__adj-list--scroll" : ""}`}>
            {visibleAdj.map((a) => (
              <div key={a.id} className="goal-editor__adj">
                <span className="goal-editor__adj-date">
                  {a.date ? formatAdjustmentDate(a.date) : "—"}
                </span>
                <span className={`goal-editor__adj-amount${a.amount < 0 ? " goal-editor__adj-amount--neg" : ""}`}>
                  {a.amount > 0 ? "+" : ""}{moneyFmt(a.amount)}
                </span>
                {a.note
                  ? <span className="goal-editor__adj-note">{a.note}</span>
                  : <span className="goal-editor__adj-note goal-editor__adj-note--empty">—</span>
                }
                <button
                  className="btn btn--icon goal-editor__adj-remove"
                  type="button"
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
              className="btn btn--ghost goal-editor__toggle"
              type="button"
              onClick={onToggleShowAllAdj}
            >
              {showAllAdj ? "Show recent" : `Show all (${sortedAdj.length})`}
            </button>
          )}
        </>
      ) : (
        <p className="goal-editor__none">No manual adjustments yet.</p>
      )}
      <div className="inline-form inline-form--2col inline-form--bare">
        <div className="field">
          <label className="field__label">Amount</label>
          <div className="goal-editor__amount-row">
            <div className="segment segment--sign" role="radiogroup" aria-label="Add or subtract">
              <button
                type="button"
                role="radio"
                aria-checked={adjSign === 1}
                aria-label="Add to goal"
                className={`segment__btn segment__btn--sign${adjSign === 1 ? " segment__btn--active" : ""}`}
                onClick={() => setAdjSign(1)}
              >
                +
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={adjSign === -1}
                aria-label="Subtract from goal"
                className={`segment__btn segment__btn--sign${adjSign === -1 ? " segment__btn--active" : ""}`}
                onClick={() => setAdjSign(-1)}
              >
                −
              </button>
            </div>
            <input
              className="input input--mono goal-editor__amount-input"
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
        <div className="sheet skeleton-card" aria-hidden="true">
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
                  <div className="goal-card__heading">
                    <p className="kicker">{g.type === "savings" ? "Savings" : "Debt payoff"}</p>
                    <h3 className="goal-card__title">{g.name}</h3>
                  </div>
                  <div className="goal-card__actions">
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
                  <span className="goal-card__target">
                    <span className="goal-card__amount-label">Target</span>
                    <span className="goal-card__amount">{moneyFmt(g.targetAmount)}</span>
                  </span>
                </div>

                <div className="goal-card__footer">
                  <div className="goal-links">
                    {linkedCats.length === 0 && linkedExps.length === 0
                      ? <span className="badge badge--sm badge--faint">No link</span>
                      : <>
                          {linkedCats.map((c) => <span key={`cat:${c.id}`} className="badge badge--sm">{c.name}</span>)}
                          {linkedExps.map((e) => <span key={`exp:${e.id}`} className="badge badge--sm">{e.name}</span>)}
                        </>
                    }
                  </div>
                  {remaining > 0 && (
                    <span className="goal-card__remaining">
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
        <div className="sheet goals-empty">
          <p className="kicker">No goals yet</p>
          <p className="goals-empty__text">
            Add a savings or debt payoff goal below to start tracking your progress.
          </p>
        </div>
      )}

      {/* Management table */}
      {goals.length > 0 && (
        <div className="sheet table-card">
          <div className="table-card__head row-between mb-3">
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
          <div className="ledger-table-wrap-no-line ledger-table-wrap--flush">
            <table className="ledger-table ledger-table--responsive ledger-table--goals">
              <thead>
                <tr>
                  <th>Goal</th>
                  <th>Type</th>
                  <th className="text-right">Target</th>
                  <th>Applied</th>
                  <th>Linked to</th>
                  <th className="text-tight" />
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
                          <div className="goal-links">
                            {g.linkedBudgetCategoryIds.map((id) => {
                              const cat = budgetCategories.find((c) => c.id === id);
                              return cat ? <span key={id} className="badge badge--sm">{cat.name}</span> : null;
                            })}
                            {g.linkedExpenseIds.map((id) => {
                              const exp = recurringExpenses.find((e) => e.id === id);
                              return exp ? <span key={id} className="badge badge--sm">{exp.name}</span> : null;
                            })}
                            {g.linkedBudgetCategoryIds.length === 0 && g.linkedExpenseIds.length === 0 && (
                              <span className="goal-links__none">None</span>
                            )}
                          </div>
                        </td>
                        <td className="text-tight">
                          <div className="goal-row__actions">
                            <button
                              className={`btn btn--ghost goal-row__edit${isExpanded ? " goal-row__edit--active" : ""}`}
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
                          <td colSpan={6} className="goal-row__editor-cell">
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
        <div className="sheet table-card">
          <div className="table-card__head mb-3">
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
