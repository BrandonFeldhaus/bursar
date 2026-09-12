import { defaultBudget, type BudgetState } from "./budgetStorage";
import { paychecksPerYear, toISODate } from "./month";

/**
 * The bundled sample ledger behind "Try it with sample data" on the Overview.
 * `meta.demo` marks the store so the sample-data banner shows on every page until
 * the user clears it. The paycheck anchor is today, so the current period starts now.
 */
export function sampleData(now: Date = new Date()): BudgetState {
  const anchor = toISODate(now);
  return defaultBudget({
    settings: { payCycleType: "biweekly", paycheckAmount: 1800 },
    meta: { onboardingComplete: true, version: 1, createdAt: now.toISOString(), hints: [], demo: true },
    incomeMonthly: (1800 * paychecksPerYear("biweekly")) / 12,
    payCycle: "biweekly",
    lastPaycheckDate: anchor,
    paycheckAmount: 1800,
    incomes: [
      { id: "sample-day-job", name: "Day job", amount: 1800, cadence: "monthly", payCycle: "biweekly", lastPaycheckDate: anchor },
    ],
    recurringExpenses: [
      { id: "sample-rent", name: "Rent", amount: 1200, cadence: "monthly", dueDay: 1, dueMonth: undefined, paidPeriods: [] },
      { id: "sample-utilities", name: "Utilities", amount: 120, cadence: "monthly", dueDay: 8, dueMonth: undefined, paidPeriods: [] },
      { id: "sample-internet", name: "Internet", amount: 60, cadence: "monthly", dueDay: 15, dueMonth: undefined, paidPeriods: [] },
      { id: "sample-phone", name: "Phone", amount: 45, cadence: "monthly", dueDay: 20, dueMonth: undefined, paidPeriods: [] },
      { id: "sample-car-insurance", name: "Car insurance", amount: 600, cadence: "annual", dueDay: 15, dueMonth: 6, paidPeriods: [] },
    ],
    budgetCategories: [
      { id: "sample-savings", name: "Savings", mode: "percent", value: 25 },
      { id: "sample-spending", name: "Spending", mode: "percent", value: 50 },
      { id: "sample-gas", name: "Gas", mode: "fixed", value: 60 },
      { id: "sample-buffer", name: "Buffer", mode: "percent", value: 25 },
    ],
    goals: [
      {
        id: "sample-emergency-fund",
        name: "Emergency fund",
        type: "savings",
        targetAmount: 9000,
        linkedBudgetCategoryIds: [],
        linkedExpenseIds: [],
        manualAdjustments: [],
        appliedPeriods: [],
      },
    ],
    lockedMonths: [],
  });
}
