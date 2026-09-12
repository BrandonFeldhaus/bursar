import type { BudgetState, Goal, RecurringExpense } from "./budgetStorage";
import type { AllocationResult } from "./allocations";
import { monthKeyFromISO, paycheckPeriodsForMonth, shiftMonth, toISODate, type PaycheckPeriod } from "./month";

/**
 * How a goal gets funded. A goal is linked to budget categories and bills
 * (`linkedBudgetCategoryIds` / `linkedExpenseIds`); ticking the goal on a paycheck
 * period applies the sum of what those sources come to in that period. This module is
 * the one place that sum is computed — the Overview's Goals tab and the goal editor's
 * "Funded by" section both read it from here.
 */

export type FundingSource = {
  kind: "category" | "bill";
  id: string;
  name: string;
  /** What the source contributes in one period: the category's allocation, or the bill's amount when it is due in that period. */
  amount: number;
};

type PeriodBill = Pick<PaycheckPeriod["bills"][number], "expenseId" | "amount">;

/** What one category or bill contributes in a period. An id that no longer exists contributes 0. */
export function sourceAmount(
  kind: FundingSource["kind"],
  id: string,
  allocations: AllocationResult[],
  periodBills: PeriodBill[],
): number {
  if (kind === "category") return allocations.find((a) => a.id === id)?.amount ?? 0;
  return periodBills.find((b) => b.expenseId === id)?.amount ?? 0;
}

/** The sum of a goal's linked sources for one period. Missing sources contribute 0. */
export function goalFundingTotal(
  goal: Pick<Goal, "linkedBudgetCategoryIds" | "linkedExpenseIds">,
  allocations: AllocationResult[],
  periodBills: PeriodBill[],
): number {
  const fromCategories = goal.linkedBudgetCategoryIds.reduce((s, id) => s + sourceAmount("category", id, allocations, periodBills), 0);
  const fromBills = goal.linkedExpenseIds.reduce((s, id) => s + sourceAmount("bill", id, allocations, periodBills), 0);
  return fromCategories + fromBills;
}

/** Every category and bill a goal could be funded by, with its amount for the period (0 for a bill not due in it). */
export function fundingCandidates(
  allocations: AllocationResult[],
  periodBills: PeriodBill[],
  recurringExpenses: Pick<RecurringExpense, "id" | "name">[],
): FundingSource[] {
  const categories: FundingSource[] = allocations.map((a) => ({
    kind: "category",
    id: a.id,
    name: a.name,
    amount: sourceAmount("category", a.id, allocations, periodBills),
  }));
  const bills: FundingSource[] = recurringExpenses.map((e) => ({
    kind: "bill",
    id: e.id,
    name: e.name,
    amount: sourceAmount("bill", e.id, allocations, periodBills),
  }));
  return [...categories, ...bills];
}

/** The goal's linked sources, categories then bills, in link order. Ids with no matching candidate are dropped. */
export function goalFundingSources(
  goal: Pick<Goal, "linkedBudgetCategoryIds" | "linkedExpenseIds">,
  candidates: FundingSource[],
): FundingSource[] {
  const pick = (kind: FundingSource["kind"], ids: string[]) =>
    ids.map((id) => candidates.find((c) => c.kind === kind && c.id === id)).filter((c): c is FundingSource => !!c);
  return [...pick("category", goal.linkedBudgetCategoryIds), ...pick("bill", goal.linkedExpenseIds)];
}

/** Paychecks left at `perPaycheck` per period, or null when nothing remains or the rate is 0. */
export function paychecksToGo(remaining: number, perPaycheck: number): number | null {
  if (!(perPaycheck > 0) || !(remaining > 0)) return null;
  return Math.ceil(remaining / perPaycheck);
}

/**
 * The paycheck period that contains `today`: one of this month's periods, or the previous
 * month's last period while it still overhangs into this month (before the first payday).
 */
export function currentPeriod(state: BudgetState, today: Date = new Date()): PaycheckPeriod | null {
  const monthKey = monthKeyFromISO(toISODate(today));
  const day = today.getDate();
  const periods = paycheckPeriodsForMonth(state, monthKey);
  const inMonth = periods.find((p) => p.startDay <= day && day <= p.endDay);
  if (inMonth) return inMonth;
  const previous = paycheckPeriodsForMonth(state, shiftMonth(monthKey, -1));
  return previous[previous.length - 1] ?? periods[0] ?? null;
}
