import type { BudgetCategory } from "./budgetStorage";

export type AllocationResult = BudgetCategory & { amount: number };

export function computeAllocations(leftover: number, categories: BudgetCategory[]): AllocationResult[] {
  const fixedTotal = categories.filter((c) => c.mode === "fixed").reduce((s, c) => s + c.value, 0);
  const base = leftover - fixedTotal;
  return categories.map((c) => ({
    ...c,
    amount: c.mode === "fixed" ? c.value : Math.max(0, base) * (c.value / 100),
  }));
}

export function isBudgetOverdrawn(percentTotal: number, fixedTotal: number, monthlyIncome: number): boolean {
  return percentTotal > 100 || (monthlyIncome > 0 && fixedTotal > monthlyIncome);
}
