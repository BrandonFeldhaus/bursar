import type { BudgetState, Income, RecurringExpense, BudgetCategory } from "../app/lib/budgetStorage";

export function makeState(
  incomes: Income[],
  expenses: RecurringExpense[] = [],
  categories: BudgetCategory[] = [],
): BudgetState {
  return {
    settings: { payCycleType: "biweekly", paycheckAmount: 0 },
    meta: { onboardingComplete: true, version: 1, createdAt: "" },
    incomeMonthly: 0,
    payCycle: "biweekly",
    lastPaycheckDate: "",
    recurringExpenses: expenses,
    incomes,
    paycheckAmount: 0,
    budgetCategories: categories,
    goals: [],
  };
}

export function semiIncome(id: string, name: string, amount: number): Income {
  return { id, name, amount, cadence: "monthly", payCycle: "semimonthly", lastPaycheckDate: "" };
}

export function biwIncome(id: string, name: string, amount: number, anchor: string): Income {
  return { id, name, amount, cadence: "monthly", payCycle: "biweekly", lastPaycheckDate: anchor };
}

export function monthlyExpense(id: string, name: string, amount: number, dueDay: number): RecurringExpense {
  return { id, name, amount, cadence: "monthly", dueDay, paidPeriods: [] };
}

export function annualExpense(id: string, name: string, amount: number, dueDay: number, dueMonth: number): RecurringExpense {
  return { id, name, amount, cadence: "annual", dueDay, dueMonth, paidPeriods: [] };
}

export function percentCat(id: string, name: string, value: number): BudgetCategory {
  return { id, name, mode: "percent", value };
}

export function fixedCat(id: string, name: string, value: number): BudgetCategory {
  return { id, name, mode: "fixed", value };
}
