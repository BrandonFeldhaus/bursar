"use client";

import { type CSSProperties, type Dispatch, type SetStateAction, Fragment, useEffect, useMemo, useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { loadState, newId, saveState, type BudgetState, type Goal } from "../lib/storage";
import { useHydrated } from "../lib/useHydrated";
import { useIsMobile } from "../lib/useIsMobile";
import { moneyFmt } from "../lib/currency";
import { computeAllocations } from "../lib/allocations";
import {
  currentPeriod,
  fundingCandidates,
  goalFundingSources,
  paychecksToGo,
  type FundingSource,
} from "../lib/goalFunding";
import { SavedIndicator, useSavedIndicator } from "../components/SavedIndicator";
import { UndoToast, type UndoEntry } from "../components/UndoToast";
import { BottomSheet } from "../components/BottomSheet";
import { FormDialog } from "../components/FormDialog";
import { FundingPicker } from "../components/FundingPicker";
import { AddGoalForm, emptyGoalDraft, goalDraftErrors, goalFromDraft, type DraftGoal } from "../components/AddGoalForm";
import { toISODate } from "../lib/month";
import { formatAdjustmentDate, sortAdjustmentsForDisplay } from "../lib/goalAdjustments";
import { Hint, dismissHint, type HintId } from "../components/Hint";

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

/** Names of the goal's funding sources, for the badges in the cards and the table. */
function FundingBadges({ goal, candidates }: { goal: Goal; candidates: FundingSource[] }) {
  const sources = goalFundingSources(goal, candidates);
  return (
    <div className="goal-links">
      {sources.length === 0
        ? <span className="goal-links__none">Not funded</span>
        : sources.map((s) => <span key={`${s.kind}:${s.id}`} className="badge badge--sm">{s.name}</span>)}
    </div>
  );
}

/**
 * Expanded editor for one goal — an inline table row on desktop, the bottom sheet on
 * mobile. Two stacked sections: "Funded by" (chips + picker) and "Adjustments".
 */
function GoalEditor({
  goal,
  candidates,
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
}: {
  goal: Goal;
  candidates: FundingSource[];
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
}) {
  const sources = goalFundingSources(goal, candidates);
  const perPaycheck = sources.reduce((s, x) => s + x.amount, 0);
  const remaining = Math.max(0, goal.targetAmount - goalTotalApplied(goal));
  const toGo = paychecksToGo(remaining, perPaycheck);

  const isAdded = (s: FundingSource) =>
    s.kind === "category" ? goal.linkedBudgetCategoryIds.includes(s.id) : goal.linkedExpenseIds.includes(s.id);

  function addSource(s: FundingSource) {
    if (isAdded(s)) return;
    if (s.kind === "category") onUpdate({ linkedBudgetCategoryIds: [...goal.linkedBudgetCategoryIds, s.id] });
    else onUpdate({ linkedExpenseIds: [...goal.linkedExpenseIds, s.id] });
  }

  function removeSource(s: FundingSource) {
    if (s.kind === "category") onUpdate({ linkedBudgetCategoryIds: goal.linkedBudgetCategoryIds.filter((id) => id !== s.id) });
    else onUpdate({ linkedExpenseIds: goal.linkedExpenseIds.filter((id) => id !== s.id) });
  }

  const sortedAdj = sortAdjustmentsForDisplay(goal.manualAdjustments);
  const visibleAdj = showAllAdj ? sortedAdj : sortedAdj.slice(0, RECENT_ADJ_COUNT);

  return (
    <div className="goal-editor">
      <section className="goal-editor__section">
        <h4 className="goal-editor__heading">Funded by</h4>
        <p className="goal-editor__explainer">When you tick this goal on a paycheck period, these amounts count toward it.</p>

        {sources.length > 0 ? (
          <ul className="funding-chips">
            {sources.map((s) => (
              <li key={`${s.kind}:${s.id}`} className="funding-chip">
                <span className="funding-chip__name">{s.name}</span>
                <span className="funding-chip__amount">{moneyFmt(s.amount)}</span>
                <button
                  type="button"
                  className="funding-chip__remove"
                  aria-label={`Remove ${s.name}`}
                  onClick={() => removeSource(s)}
                >
                  <IconX size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="goal-editor__none">Not funded yet.</p>
        )}

        {perPaycheck > 0 && (
          <p className="funding-total">
            <span className="funding-total__amount">≈ {moneyFmt(perPaycheck)} per paycheck</span>
            {toGo !== null && (
              <span className="funding-total__estimate">about {toGo} {toGo === 1 ? "paycheck" : "paychecks"} to go</span>
            )}
          </p>
        )}

        {candidates.length > 0 ? (
          <FundingPicker goalType={goal.type} candidates={candidates} isAdded={isAdded} onAdd={addSource} />
        ) : (
          <p className="goal-editor__none">Add budget categories or bills first, then fund this goal from them.</p>
        )}
      </section>

      <div className="goal-editor__divider" role="presentation" />

      <section className="goal-editor__section">
        <h4 className="goal-editor__heading">Adjustments</h4>
        <p className="goal-editor__explainer">Money added or taken out that did not come from a paycheck period.</p>
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
          <p className="goal-editor__none">No adjustments yet.</p>
        )}
        <div className="inline-form inline-form--2col inline-form--bare">
          <div className="field">
            <label className="field__label" htmlFor={`adj-amount-${goal.id}`}>Amount</label>
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
                id={`adj-amount-${goal.id}`}
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
            <label className="field__label" htmlFor={`adj-note-${goal.id}`}>Note (optional)</label>
            <input
              id={`adj-note-${goal.id}`}
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
            Add adjustment
          </button>
        </div>
      </section>
    </div>
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

  /** Open (or close) a goal's editor with a clean adjustment form. */
  function openEditor(id: string | null) {
    setExpandedGoalId(id);
    setAdjAmount("");
    setAdjSign(1);
    setAdjNote("");
    setAdjShowAll(false);
  }

  function addGoal(): boolean {
    const errs = goalDraftErrors(draft);
    if (errs.name || errs.target) {
      setAttempted(true);
      return false;
    }
    const newGoal = goalFromDraft(draft);
    setState((s) => (s ? { ...s, goals: [...s.goals, newGoal] } : s));
    setDraft(emptyGoalDraft);
    setAttempted(false);
    savedIndicator.flash();
    // Straight into the editor so funding can be set right away.
    openEditor(newGoal.id);
    return true;
  }

  function dismiss(id: HintId) {
    setState((s) => (s ? dismissHint(s, id) : s));
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

  // What each category and bill comes to in the paycheck period that contains today —
  // the amounts shown in the picker, the chips, and the per-paycheck total.
  const candidates = useMemo((): FundingSource[] => {
    if (!state) return [];
    const period = currentPeriod(state);
    if (!period) return [];
    const allocations = computeAllocations(period.leftover, state.budgetCategories);
    return fundingCandidates(allocations, period.bills, state.recurringExpenses);
  }, [state]);

  if (!hydrated || !state) {
    return (
      <section className="container" aria-busy="true">
        <header className="sheet page-head">
          <h1 className="page-head__title">Goals</h1>
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

  const { goals } = state;
  const expandedGoal = goals.find((g) => g.id === expandedGoalId) ?? null;

  const editorFor = (g: Goal) => (
    <GoalEditor
      goal={g}
      candidates={candidates}
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
  );

  return (
    <section className="container">
      {/* Page head */}
      <header className="sheet page-head">
        <h1 className="page-head__title">Goals</h1>
        <p className="page-head__lead">
          Track a savings target or a debt payoff. Fund a goal from budget categories or bills, then tick it on a paycheck period to add that amount.
        </p>
      </header>

      <Hint id="goals" hints={state.meta.hints} onDismiss={dismiss} />

      {/* Progress cards */}
      {goals.length > 0 && (
        <div className="goal-cards">
          {goals.map((g) => {
            const applied = goalTotalApplied(g);
            const pct = g.targetAmount > 0 ? (applied / g.targetAmount) * 100 : 0;
            const remaining = Math.max(0, g.targetAmount - applied);

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
                  <FundingBadges goal={g} candidates={candidates} />
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

      {/* Management table */}
      {goals.length > 0 && (
        <div className="sheet table-card">
          <div className="table-card__head row-between mb-3">
            <div className="table-card__title">
              <h2 className="section-title">All goals</h2>
              <SavedIndicator visible={savedIndicator.visible} />
            </div>
            <button type="button" className="btn btn--add" onClick={() => setAddOpen(true)}>
              <IconPlus size={14} aria-hidden="true" />Add goal
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
                  <th>Funded by</th>
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
                            aria-label="Goal name"
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
                            aria-label="Goal type"
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
                            aria-label="Target amount"
                            onChange={(e) =>
                              updateGoal(g.id, {
                                targetAmount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0),
                              })
                            }
                          />
                        </td>
                        <td className="mono" data-label="Applied">{moneyFmt(applied)}</td>
                        <td data-label="Funded by">
                          <FundingBadges goal={g} candidates={candidates} />
                        </td>
                        <td className="text-tight">
                          <div className="goal-row__actions">
                            <button
                              className={`btn btn--ghost goal-row__edit${isExpanded ? " goal-row__edit--active" : ""}`}
                              type="button"
                              title="Edit funding and adjustments"
                              aria-label={`Edit ${g.name}`}
                              aria-expanded={isExpanded}
                              onClick={() => openEditor(isExpanded ? null : g.id)}
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
                            {editorFor(g)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state: the form stays inline so the page has an action */}
      {goals.length === 0 && (
        <div className="sheet table-card">
          <div className="table-card__head mb-3">
            <h2 className="section-title">Add your first goal</h2>
            <p className="muted">A savings target or a debt to pay off. Once it exists you can fund it from budget categories or bills.</p>
          </div>
          <AddGoalForm draft={draft} setDraft={setDraft} onAdd={addGoal} attempted={attempted} />
        </div>
      )}

      {/* "+ Add goal": dialog on desktop, bottom sheet on mobile */}
      <FormDialog open={addOpen} title="Add goal" onClose={() => setAddOpen(false)}>
        <AddGoalForm
          inSheet
          draft={draft}
          setDraft={setDraft}
          onAdd={() => { if (addGoal()) setAddOpen(false); }}
          attempted={attempted}
        />
      </FormDialog>

      {/* Mobile edit sheet — same editor the desktop inline row uses */}
      {isMobile && expandedGoal && (
        <BottomSheet
          open
          title={`Edit — ${expandedGoal.name || "goal"}`}
          onClose={() => setExpandedGoalId(null)}
        >
          {editorFor(expandedGoal)}
        </BottomSheet>
      )}

      {/* SavedIndicator and UndoToast */}
      <SavedIndicator visible={savedIndicator.visible} />
      <UndoToast entry={undo} onDismiss={() => setUndo(null)} />
    </section>
  );
}
