import {
  clearBudget,
  defaultBudget,
  loadBudget,
  newId,
  normalizeParsed,
  saveBudget,
  type BudgetCategory,
  type BudgetState,
  type Expense,
  type Goal,
  type Income,
  type LockedMonth,
  type OnboardingExpense,
  type PayCycle,
  type RecurringExpense,
  type Allocation,
} from "./budgetStorage";
import { currentMonthKey } from "./month";
import { upsertSnapshot } from "./monthView";

export type { Allocation, BudgetCategory, BudgetState, Expense, Goal, Income, LockedMonth, OnboardingExpense, PayCycle, RecurringExpense };

export function defaultState(): BudgetState {
  return defaultBudget();
}

export function loadState(): BudgetState {
  return loadBudget() ?? defaultBudget();
}

/**
 * Persist state. Every save also refreshes the CURRENT month's snapshot from live
 * definitions, so when the month rolls over its snapshot already holds the
 * definitions as they last stood during that month. Snapshots carry definitions only;
 * see lib/monthView.ts.
 */
export function saveState(state: BudgetState) {
  saveBudget(upsertSnapshot(state, currentMonthKey()));
}

export { clearBudget, newId, normalizeParsed };
