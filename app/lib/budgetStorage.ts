export const BUDGET_KEY = "budgetApp:v1";

export type PayCycle = "biweekly" | "semimonthly" | "weekly";

const PAY_CYCLES: readonly PayCycle[] = ["biweekly", "semimonthly", "weekly"];

function coercePayCycle(value: unknown, fallback: PayCycle = "biweekly"): PayCycle {
  return PAY_CYCLES.includes(value as PayCycle) ? (value as PayCycle) : fallback;
}

export type Expense = {
  id: string;
  date: string;
  name: string;
  category: string;
  amount: number;
};

export type RecurringExpense = {
  id: string;
  name: string;
  amount: number;
  cadence: "monthly" | "annual";
  dueDay?: number;
  dueMonth?: number;
  paidPeriods?: string[];
};

export type Income = {
  id: string;
  name: string;
  amount: number;
  cadence: "monthly" | "annual";
  payCycle: PayCycle;
  lastPaycheckDate: string;
};

export type BudgetCategory = {
  id: string;
  name: string;
  mode: "percent" | "fixed";
  value: number;
};

export type LockedMonth = {
  monthKey: string;
  lockedAt: string;
  incomes: Income[];
  recurringExpenses: RecurringExpense[];
  budgetCategories: BudgetCategory[];
  goals: Goal[];
};

export type Goal = {
  id: string;
  name: string;
  type: "savings" | "debt";
  targetAmount: number;
  linkedBudgetCategoryIds: string[];
  linkedExpenseIds: string[];
  // date is a local calendar date ("YYYY-MM-DD"); absent on entries logged before dates existed
  manualAdjustments: { id: string; amount: number; note?: string; date?: string }[];
  appliedPeriods: { periodId: string; amount: number }[];
};

// Kept for backward compat migration only
export type OnboardingExpense = {
  id: string;
  name: string;
  amount: number;
  frequency: "monthly" | "per-paycheck";
};

export type Allocation = {
  id: string;
  name: string;
  mode: "percent" | "fixed";
  value: number;
};

export type BudgetState = {
  settings: {
    payCycleType: PayCycle;
    paycheckAmount: number;
  };
  meta: {
    onboardingComplete: boolean;
    version: 1;
    createdAt: string;
  };
  incomeMonthly: number;
  payCycle: PayCycle;
  lastPaycheckDate: string;
  recurringExpenses: RecurringExpense[];
  incomes: Income[];
  paycheckAmount: number;
  budgetCategories: BudgetCategory[];
  goals: Goal[];
  lockedMonths: LockedMonth[];
};

export function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultBudget(overrides?: Partial<BudgetState>): BudgetState {
  const base: BudgetState = {
    settings: {
      payCycleType: "biweekly",
      paycheckAmount: 0,
    },
    meta: {
      onboardingComplete: false,
      version: 1,
      createdAt: new Date().toISOString(),
    },
    incomeMonthly: 0,
    payCycle: "biweekly",
    lastPaycheckDate: "",
    recurringExpenses: [],
    incomes: [],
    paycheckAmount: 0,
    budgetCategories: [],
    goals: [],
    lockedMonths: [],
  };

  return {
    ...base,
    ...overrides,
    settings: {
      ...base.settings,
      ...(overrides?.settings || {}),
    },
    meta: {
      ...base.meta,
      ...(overrides?.meta || {}),
    },
    recurringExpenses: Array.isArray(overrides?.recurringExpenses) ? overrides.recurringExpenses : base.recurringExpenses,
    incomes: Array.isArray(overrides?.incomes) ? overrides.incomes : base.incomes,
    budgetCategories: Array.isArray(overrides?.budgetCategories) ? overrides.budgetCategories : base.budgetCategories,
    goals: Array.isArray(overrides?.goals) ? overrides.goals : base.goals,
    lockedMonths: Array.isArray(overrides?.lockedMonths) ? overrides.lockedMonths : base.lockedMonths,
  };
}

function normalizeRecurringExpenses(raw: any[]): RecurringExpense[] {
  return raw.map((e: any) => ({
    id: typeof e?.id === "string" ? e.id : newId(),
    name: typeof e?.name === "string" ? e.name : "",
    amount: Math.max(0, Number(e?.amount ?? 0) || 0),
    cadence: e?.cadence === "annual" ? "annual" : "monthly",
    dueDay: typeof e?.dueDay === "number" ? e.dueDay : 1,
    dueMonth: e?.cadence === "annual" && typeof e?.dueMonth === "number" ? e.dueMonth : undefined,
    paidPeriods: Array.isArray(e?.paidPeriods) ? e.paidPeriods : [],
  }));
}

function normalizeBudgetCategories(parsed: any): BudgetCategory[] {
  const rawCats = Array.isArray(parsed?.budgetCategories) ? parsed.budgetCategories : [];
  const rawAllocations = Array.isArray(parsed?.allocations) ? parsed.allocations : [];

  // Detect old format: first category has "percent" field but no "mode" field
  const isOldCatFormat = rawCats.length > 0 && "percent" in rawCats[0] && !("mode" in rawCats[0]);

  if (isOldCatFormat || (rawCats.length === 0 && rawAllocations.length > 0)) {
    // Old format: convert percent-based categories + fixed allocations
    const fromCats: BudgetCategory[] = rawCats.map((c: any) => ({
      id: typeof c.id === "string" ? c.id : newId(),
      name: typeof c.name === "string" ? c.name : "",
      mode: "percent" as const,
      value: Math.max(0, Number(c.percent ?? 0) || 0),
    })).filter((c: BudgetCategory) => c.name.trim().length > 0);

    const fromAllocations: BudgetCategory[] = rawAllocations.map((a: any) => ({
      id: typeof a.id === "string" ? a.id : newId(),
      name: typeof a.name === "string" ? a.name : "",
      mode: (a.mode === "fixed" ? "fixed" : "percent") as "percent" | "fixed",
      value: Math.max(0, Number(a.value ?? 0) || 0),
    })).filter((a: BudgetCategory) => a.name.trim().length > 0);

    // Merge: categories first, then allocations not already present
    const catIds = new Set(fromCats.map((c) => c.id));
    return [...fromCats, ...fromAllocations.filter((a) => !catIds.has(a.id))];
  }

  // New format or empty
  return rawCats
    .map((c: any) => ({
      id: typeof c.id === "string" ? c.id : newId(),
      name: typeof c.name === "string" ? c.name : "",
      mode: (c.mode === "fixed" ? "fixed" : "percent") as "percent" | "fixed",
      value: Math.max(0, Number(c.value ?? 0) || 0),
    }))
    .filter((c: BudgetCategory) => c.name.trim().length > 0);
}

function normalizeGoals(raw: any[]): Goal[] {
  return raw
    .map((g: any) => {
      // Migrate from old single-link fields to arrays
      const linkedBudgetCategoryIds: string[] = Array.isArray(g?.linkedBudgetCategoryIds)
        ? g.linkedBudgetCategoryIds.filter((id: any) => typeof id === "string" && id.length > 0)
        : typeof g?.linkedBudgetCategoryId === "string" && g.linkedBudgetCategoryId
          ? [g.linkedBudgetCategoryId]
          : [];
      const linkedExpenseIds: string[] = Array.isArray(g?.linkedExpenseIds)
        ? g.linkedExpenseIds.filter((id: any) => typeof id === "string" && id.length > 0)
        : typeof g?.linkedExpenseId === "string" && g.linkedExpenseId
          ? [g.linkedExpenseId]
          : [];
      return {
        id: typeof g?.id === "string" ? g.id : newId(),
        name: typeof g?.name === "string" ? g.name : "",
        type: g?.type === "debt" ? ("debt" as const) : ("savings" as const),
        targetAmount: Math.max(0, Number(g?.targetAmount ?? 0) || 0),
        linkedBudgetCategoryIds,
        linkedExpenseIds,
        manualAdjustments: Array.isArray(g?.manualAdjustments)
          ? g.manualAdjustments.map((a: any) => ({
              id: typeof a?.id === "string" ? a.id : newId(),
              amount: Number(a?.amount ?? 0) || 0,
              note: typeof a?.note === "string" && a.note.trim() ? a.note.trim() : undefined,
              date: typeof a?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : undefined,
            }))
          : [],
        appliedPeriods: Array.isArray(g?.appliedPeriods)
          ? g.appliedPeriods
              .map((p: any) => ({
                periodId: typeof p?.periodId === "string" ? p.periodId : "",
                amount: Math.max(0, Number(p?.amount ?? 0) || 0),
              }))
              .filter((p: { periodId: string; amount: number }) => p.periodId.length > 0)
          : [],
      };
    })
    .filter((g: Goal) => g.name.trim().length > 0);
}

function normalizeLockedMonths(raw: any[]): LockedMonth[] {
  return raw
    .map((lm: any) => ({
      monthKey: typeof lm?.monthKey === "string" ? lm.monthKey : "",
      lockedAt: typeof lm?.lockedAt === "string" ? lm.lockedAt : new Date().toISOString(),
      incomes: Array.isArray(lm?.incomes) ? lm.incomes : [],
      recurringExpenses: normalizeRecurringExpenses(Array.isArray(lm?.recurringExpenses) ? lm.recurringExpenses : []),
      budgetCategories: normalizeBudgetCategories({ budgetCategories: lm?.budgetCategories }),
      goals: normalizeGoals(Array.isArray(lm?.goals) ? lm.goals : []),
    }))
    .filter((lm: LockedMonth) => lm.monthKey.length > 0);
}

export function normalizeParsed(parsed: any): BudgetState {
  const payCycle: PayCycle = coercePayCycle(parsed?.payCycle);
  const paycheckAmount = Math.max(0, Number(parsed?.paycheckAmount ?? parsed?.settings?.paycheckAmount ?? 0) || 0);
  const payCycleType: PayCycle = coercePayCycle(parsed?.settings?.payCycleType, payCycle);

  const recurringExpenses = normalizeRecurringExpenses(
    Array.isArray(parsed?.recurringExpenses) ? parsed.recurringExpenses : []
  );

  const incomes: Income[] = (Array.isArray(parsed?.incomes) ? parsed.incomes : []).map((inc: any) => ({
    ...inc,
    payCycle: coercePayCycle(inc?.payCycle),
  }));
  const budgetCategories = normalizeBudgetCategories(parsed);
  const goals = normalizeGoals(Array.isArray(parsed?.goals) ? parsed.goals : []);
  const lockedMonths = normalizeLockedMonths(Array.isArray(parsed?.lockedMonths) ? parsed.lockedMonths : []);

  return defaultBudget({
    settings: { payCycleType, paycheckAmount },
    meta: {
      onboardingComplete: !!parsed?.meta?.onboardingComplete,
      version: 1,
      createdAt: typeof parsed?.meta?.createdAt === "string" ? parsed.meta.createdAt : new Date().toISOString(),
    },
    incomeMonthly: Math.max(0, Number(parsed?.incomeMonthly ?? 0) || 0),
    payCycle,
    lastPaycheckDate: typeof parsed?.lastPaycheckDate === "string" ? parsed.lastPaycheckDate : "",
    recurringExpenses,
    incomes,
    paycheckAmount,
    budgetCategories,
    goals,
    lockedMonths,
  });
}

function migrateLegacyState(): BudgetState | null {
  if (typeof window === "undefined") return null;

  const legacyKeys = [
    "neoBudget.state.v5",
    "neoBudget.state.v4",
    "neoBudget.state.v3",
    "neoBudget.state.v2",
    "neoBudget.state.v1",
  ];

  for (const key of legacyKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as any;
      const migrated = normalizeParsed(parsed);
      migrated.meta.onboardingComplete = true;
      saveBudget(migrated);
      return migrated;
    } catch {
      return null;
    }
  }

  return null;
}

export function loadBudget(): BudgetState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    if (!raw || raw.trim().length === 0) {
      return migrateLegacyState();
    }
    return normalizeParsed(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveBudget(data: BudgetState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BUDGET_KEY, JSON.stringify(data));
}

export function clearBudget() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BUDGET_KEY);
  localStorage.removeItem("neoBudget.state.v5");
  localStorage.removeItem("neoBudget.state.v4");
  localStorage.removeItem("neoBudget.state.v3");
  localStorage.removeItem("neoBudget.state.v2");
  localStorage.removeItem("neoBudget.state.v1");
}
