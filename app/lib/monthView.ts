import type { BudgetState, LockedMonth } from "./budgetStorage";
import { currentMonthKey, shiftMonth } from "./month";

/**
 * Two kinds of data live in a BudgetState.
 *
 * DEFINITIONS — incomes, bill amounts and due days, budget categories, goal targets and
 * links — are shared across months. Each past month keeps its own copy in
 * `lockedMonths` so later edits don't rewrite history.
 *
 * FACTS — `paidPeriods` on an expense, `appliedPeriods` and `manualAdjustments` on a
 * goal — are keyed by periodId, always live, and always editable in every month.
 * Nothing ever locks a fact, and snapshots never carry them.
 */

/** Build a definitions-only snapshot of `state` for `monthKey`. */
export function snapshotForMonth(
  state: BudgetState,
  monthKey: string,
  lockedAt: string = new Date().toISOString(),
): LockedMonth {
  return {
    monthKey,
    lockedAt,
    incomes: state.incomes.map((inc) => ({ ...inc })),
    recurringExpenses: state.recurringExpenses.map((e) => ({ ...e, paidPeriods: [] })),
    budgetCategories: state.budgetCategories.map((c) => ({ ...c })),
    goals: state.goals.map((g) => ({
      ...g,
      linkedBudgetCategoryIds: [...g.linkedBudgetCategoryIds],
      linkedExpenseIds: [...g.linkedExpenseIds],
      appliedPeriods: [],
      manualAdjustments: [],
    })),
  };
}

/** Replace (or add) the snapshot for `monthKey` from live definitions. Other months are untouched. */
export function upsertSnapshot(state: BudgetState, monthKey: string, lockedAt?: string): BudgetState {
  const existing = Array.isArray(state.lockedMonths) ? state.lockedMonths : [];
  const rest = existing.filter((lm) => lm.monthKey !== monthKey);
  return { ...state, lockedMonths: [...rest, snapshotForMonth(state, monthKey, lockedAt)] };
}

const MAX_BACKFILL_MONTHS = 120;

/** Snapshot every past month since `meta.createdAt` that lacks one, from live definitions. */
export function backfillSnapshots(state: BudgetState, currentKey: string = currentMonthKey()): BudgetState {
  const createdMonthKey = state.meta.createdAt ? state.meta.createdAt.slice(0, 7) : shiftMonth(currentKey, -12);
  let s = state;
  let m = shiftMonth(currentKey, -1);
  for (let i = 0; i < MAX_BACKFILL_MONTHS && m >= createdMonthKey; i++) {
    if (!s.lockedMonths.some((lm) => lm.monthKey === m)) s = upsertSnapshot(s, m);
    m = shiftMonth(m, -1);
  }
  return s;
}

/**
 * The state to render for `monthKey`.
 *
 * Current and future months, and past months without a snapshot, render live state.
 * A past month with a snapshot takes its DEFINITIONS from the snapshot but always reads
 * FACTS from live state, matched by id — an expense or goal that no longer exists live
 * gets empty facts.
 */
export function viewStateForMonth(
  state: BudgetState,
  monthKey: string,
  currentKey: string = currentMonthKey(),
): BudgetState {
  if (monthKey >= currentKey) return state;
  const snapshot = state.lockedMonths.find((lm) => lm.monthKey === monthKey);
  if (!snapshot) return state;

  const liveExpenses = new Map(state.recurringExpenses.map((e) => [e.id, e]));
  const liveGoals = new Map(state.goals.map((g) => [g.id, g]));

  return {
    ...state,
    incomes: snapshot.incomes,
    budgetCategories: snapshot.budgetCategories,
    recurringExpenses: snapshot.recurringExpenses.map((e) => ({
      ...e,
      paidPeriods: liveExpenses.get(e.id)?.paidPeriods ?? [],
    })),
    goals: snapshot.goals.map((g) => {
      const live = liveGoals.get(g.id);
      return {
        ...g,
        appliedPeriods: live?.appliedPeriods ?? [],
        manualAdjustments: live?.manualAdjustments ?? [],
      };
    }),
  };
}
