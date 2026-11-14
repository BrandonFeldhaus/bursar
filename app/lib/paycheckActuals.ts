import type { BudgetState, Income, PaycheckActual } from "./budgetStorage";
import { computeAllocations } from "./allocations";
import { goalFundingTotal } from "./goalFunding";
import { currentMonthKey, monthKeyFromISO, paycheckPeriodsForMonth } from "./month";
import { viewStateForMonth } from "./monthView";

/**
 * Variable income: an income's `amount` is its estimate, and `actuals` record what individual
 * paychecks really came to, keyed by paycheck date (see `paycheckAmount` in month.ts).
 */

/**
 * Write (`amount` a number) or clear (`amount` null) the actual for `incomeId`'s paycheck on
 * `date` ("YYYY-MM-DD"). Then every goal already ticked in the period holding that paycheck gets
 * its stored contribution recomputed from the period's new leftover, so `appliedPeriods` matches
 * what the period card shows. The period is built from `viewStateForMonth`, so a past month uses
 * its snapshot's definitions, exactly as the Overview rendered it when the goal was ticked.
 *
 * Returns `state` itself when nothing changes (unknown income, or clearing an actual that isn't there).
 */
export function setPaycheckActual(
  state: BudgetState,
  incomeId: string,
  date: string,
  amount: number | null,
  currentKey: string = currentMonthKey(),
): BudgetState {
  const income = state.incomes.find((inc) => inc.id === incomeId);
  if (!income) return state;
  const existing = income.actuals ?? [];
  const had = existing.find((a) => a.date === date);
  if (amount === null && !had) return state;
  if (amount !== null && had?.amount === amount) return state;

  const rest = existing.filter((a) => a.date !== date);
  const actuals: PaycheckActual[] =
    amount === null
      ? rest
      : [...rest, { date, amount: Math.max(0, amount) }].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const next: BudgetState = {
    ...state,
    incomes: state.incomes.map((inc) => (inc.id === incomeId ? { ...inc, actuals } : inc)),
  };
  return refreshAppliedGoals(next, incomeId, date, currentKey);
}

/** Recompute the stored contribution of every goal ticked in the period that holds `incomeId`'s paycheck on `date`. */
function refreshAppliedGoals(state: BudgetState, incomeId: string, date: string, currentKey: string): BudgetState {
  const monthKey = monthKeyFromISO(date);
  const view = viewStateForMonth(state, monthKey, currentKey);
  const period = paycheckPeriodsForMonth(view, monthKey).find((p) =>
    p.incomes.some((i) => i.incomeId === incomeId && i.dateISO === date),
  );
  // The date is no longer a payday of that income (anchor or cycle changed): no period moved.
  if (!period) return state;

  const periodId = `${period.monthKey}-${period.key}`;
  if (!state.goals.some((g) => g.appliedPeriods.some((p) => p.periodId === periodId))) return state;

  const allocations = computeAllocations(period.leftover, view.budgetCategories);
  const viewGoals = new Map(view.goals.map((g) => [g.id, g]));
  return {
    ...state,
    goals: state.goals.map((g) => {
      if (!g.appliedPeriods.some((p) => p.periodId === periodId)) return g;
      const amount = goalFundingTotal(viewGoals.get(g.id) ?? g, allocations, period.bills);
      return {
        ...g,
        appliedPeriods: g.appliedPeriods.map((p) => (p.periodId === periodId ? { ...p, amount } : p)),
      };
    }),
  };
}

/** Shown on the Income page only once an income has at least this many actuals. */
export const RECENT_ACTUALS_MIN = 3;
/** The "Last N paychecks averaged" line looks back at most this many paychecks. */
export const RECENT_ACTUALS_MAX = 6;

/**
 * The average of the most recent actuals dated on or before `today` (up to RECENT_ACTUALS_MAX),
 * or null with fewer than RECENT_ACTUALS_MIN. Suggests an estimate; nothing applies it automatically.
 */
export function recentActualsAverage(income: Income, today: string): { count: number; average: number } | null {
  const recent = (income.actuals ?? [])
    .filter((a) => a.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, RECENT_ACTUALS_MAX);
  if (recent.length < RECENT_ACTUALS_MIN) return null;
  const average = recent.reduce((s, a) => s + a.amount, 0) / recent.length;
  return { count: recent.length, average: Math.round(average * 100) / 100 };
}
