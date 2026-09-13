import type { BudgetState, Goal, RecurringExpense } from "./budgetStorage";
import { computeAllocations, type AllocationResult } from "./allocations";
import { moneyFmt } from "./currency";
import { paycheckPeriodsForMonth, shiftMonth, type PaycheckPeriod } from "./month";

/**
 * How a goal gets funded. A goal is linked to budget categories and bills
 * (`linkedBudgetCategoryIds` / `linkedExpenseIds`); ticking the goal on a paycheck
 * period applies the sum of what those sources come to in that period. This module is
 * the one place that sum is computed — the Overview's Goals tab applies it per period,
 * and the goal editor's "Funded by" section shows its average per paycheck.
 */

export type FundingSource = {
  kind: "category" | "bill";
  id: string;
  name: string;
  /**
   * What the source adds per paycheck on average over a year of periods. A category's share
   * follows each period's leftover, and a bill counts only in the period it is due, so a
   * monthly bill is spread across every paycheck.
   */
  perPaycheck: number;
  /** Bills only: the bill's own amount and how often it repeats, as the Bills page shows it. */
  bill?: { amount: number; cadence: RecurringExpense["cadence"] };
};

type PeriodBill = Pick<PaycheckPeriod["bills"][number], "expenseId" | "amount">;

/** A whole year, so every bill lands in the average exactly twelve times. */
const AVERAGE_MONTHS = 12;

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

/**
 * Every category and bill a goal could be funded by, with what it adds per paycheck on
 * average across the paycheck periods of the twelve months starting at `monthKey`.
 */
export function fundingCandidates(state: BudgetState, monthKey: string): FundingSource[] {
  const periods = Array.from({ length: AVERAGE_MONTHS }, (_, i) => paycheckPeriodsForMonth(state, shiftMonth(monthKey, i)))
    .flat()
    .map((p) => ({ allocations: computeAllocations(p.leftover, state.budgetCategories), bills: p.bills }));
  const perPaycheck = (kind: FundingSource["kind"], id: string) =>
    periods.reduce((s, p) => s + sourceAmount(kind, id, p.allocations, p.bills), 0) / periods.length;

  const categories: FundingSource[] = state.budgetCategories.map((c) => ({
    kind: "category",
    id: c.id,
    name: c.name,
    perPaycheck: perPaycheck("category", c.id),
  }));
  const bills: FundingSource[] = state.recurringExpenses.map((e) => ({
    kind: "bill",
    id: e.id,
    name: e.name,
    perPaycheck: perPaycheck("bill", e.id),
    bill: { amount: e.amount, cadence: e.cadence },
  }));
  return [...categories, ...bills];
}

/** A source's amount in the picker and on its chip: a bill as billed ("$1,300.00/mo"), a category per paycheck. */
export function fundingAmountLabel(source: FundingSource): string {
  if (!source.bill) return moneyFmt(source.perPaycheck);
  return `${moneyFmt(source.bill.amount)}/${source.bill.cadence === "annual" ? "yr" : "mo"}`;
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
