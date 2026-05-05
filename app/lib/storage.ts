import {
  defaultBudget,
  loadBudget,
  newId,
  saveBudget,
  type BudgetCategory,
  type BudgetState,
  type Expense,
  type Goal,
  type Income,
  type OnboardingExpense,
  type PayCycle,
  type RecurringExpense,
  type Allocation,
} from "./budgetStorage";

export type { Allocation, BudgetCategory, BudgetState, Expense, Goal, Income, OnboardingExpense, PayCycle, RecurringExpense };

export function defaultState(): BudgetState {
  return defaultBudget();
}

export function loadState(): BudgetState {
  return loadBudget() ?? defaultBudget();
}

export function saveState(state: BudgetState) {
  saveBudget(state);
}

export { newId };
