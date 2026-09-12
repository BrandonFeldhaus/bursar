import type { BudgetState, Income, PayCycle, RecurringExpense } from "./budgetStorage";

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function monthKeyFromISO(iso: string): string {
  return iso.slice(0, 7);
}

export function currentMonthKey(): string {
  return monthKeyFromISO(todayISO());
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthBounds(monthKey: string) {
  const [yearValue, monthValue] = monthKey.split("-").map(Number);
  const year = yearValue ?? new Date().getFullYear();
  const monthIndex = (monthValue ?? 1) - 1;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return { year, monthIndex, lastDay };
}

export function parseISODate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function annualSetAside(amount: number): number {
  return amount / 12;
}

export function incomeDatesForMonth(income: Income, monthKey: string): Date[] {
  const { year, monthIndex, lastDay } = monthBounds(monthKey);

  if (income.payCycle === "semimonthly") {
    return [new Date(year, monthIndex, 1), new Date(year, monthIndex, 15)];
  }

  const last = parseISODate(income.lastPaycheckDate);
  if (!last) return [];

  if (income.payCycle === "monthly") {
    // Paid once a month on the anchor's day-of-month, clamped to shorter months (Jan 31 → Feb 28).
    return [new Date(year, monthIndex, Math.min(last.getDate(), lastDay))];
  }

  const intervalDays = income.payCycle === "weekly" ? 7 : 14;
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const dates: Date[] = [];

  let cursor = new Date(last);
  while (cursor > monthStart) cursor = addDays(cursor, -intervalDays);
  while (cursor < monthStart) cursor = addDays(cursor, intervalDays);
  while (cursor <= monthEnd) {
    dates.push(new Date(cursor));
    cursor = addDays(cursor, intervalDays);
  }

  return dates;
}

export function recurringDueDate(expense: RecurringExpense, monthKey: string): Date | null {
  const { year, monthIndex, lastDay } = monthBounds(monthKey);
  const dd = Math.max(1, Math.min(expense.dueDay ?? 1, lastDay));
  return new Date(year, monthIndex, dd);
}

const PAYCHECKS_PER_YEAR: Record<PayCycle, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

/** Single source for a cycle's per-year paycheck count; `/ 12` gives the monthly factor. */
export function paychecksPerYear(cycle: PayCycle): number {
  return PAYCHECKS_PER_YEAR[cycle] ?? 24;
}

export function monthlyIncomeOf(state: BudgetState): number {
  return state.incomes.reduce((sum, inc) => sum + inc.amount * (paychecksPerYear(inc.payCycle) / 12), 0);
}

// ─── Paycheck-based periods ──────────────────────────────────────────────────

const PERIOD_ORDINALS = ["first", "second", "third", "fourth", "fifth"] as const;

export type PaycheckPeriod = {
  key: string;
  index: number;
  total: number;
  startDay: number;
  endDay: number;
  paycheckDay: number;
  label: string;
  monthKey: string;
  totalIncome: number;
  totalBills: number;
  leftover: number;
  bills: {
    id: string;
    expenseId: string;
    name: string;
    date: Date;
    amount: number;
    paid: boolean;
    cadence: "monthly" | "annual";
    periodId: string;
  }[];
  incomes: { id: string; name: string; date: Date; amount: number }[];
  entryCount: number;
  overdue: boolean;
};

export function paycheckPeriodsForMonth(state: BudgetState, monthKey: string): PaycheckPeriod[] {
  const { year, monthIndex, lastDay } = monthBounds(monthKey);

  // Collect every paycheck day across all income sources
  const paycheckDaySet = new Set<number>();
  state.incomes.forEach((inc) => {
    incomeDatesForMonth(inc, monthKey).forEach((d) => paycheckDaySet.add(d.getDate()));
  });
  const paycheckDays = [...paycheckDaySet].sort((a, b) => a - b);

  // Fallback: if no paychecks this month use two fixed halves
  if (paycheckDays.length === 0) {
    return [
      { startDay: 1, endDay: 15, paycheckDay: 1 },
      { startDay: 16, endDay: lastDay, paycheckDay: 16 },
    ].map(({ startDay, endDay, paycheckDay }, i) => {
      const key = PERIOD_ORDINALS[i] ?? `period${i + 1}`;
      return buildPeriod(state, monthKey, { year, monthIndex, lastDay }, i, paycheckDays.length || 2, key, startDay, endDay, paycheckDay);
    });
  }

  // Merge paycheck days that land within 2 days of each other into one period.
  // e.g. semimonthly day-1 + biweekly day-2 → single period starting day 1.
  // Income from all merged days is still captured because buildPeriod filters by date range.
  const mergedPaycheckDays: number[] = [paycheckDays[0]];
  for (let i = 1; i < paycheckDays.length; i++) {
    if (paycheckDays[i] - mergedPaycheckDays[mergedPaycheckDays.length - 1] > 2) {
      mergedPaycheckDays.push(paycheckDays[i]);
    }
  }

  const total = mergedPaycheckDays.length;

  // Find the first paycheck of next month so we know how far the last period extends.
  const nextMonthKey = shiftMonth(monthKey, 1);
  const nextMonthDaySet = new Set<number>();
  state.incomes.forEach((inc) => {
    incomeDatesForMonth(inc, nextMonthKey).forEach((d) => nextMonthDaySet.add(d.getDate()));
  });
  // overhangDays: days of next month that fall before the next paycheck (funded by this month's last paycheck)
  const nextMonthFirstPaycheck = [...nextMonthDaySet].sort((a, b) => a - b)[0] ?? 1;
  const overhangDays = nextMonthFirstPaycheck - 1;

  return mergedPaycheckDays.map((paycheckDay, i) => {
    // Each period starts exactly on its paycheck day — bills due before the first paycheck
    // of this month belong to the previous month's last period instead.
    const startDay = paycheckDay;
    const isLast = i === total - 1;
    const endDay = isLast ? lastDay : mergedPaycheckDays[i + 1] - 1;
    const key = PERIOD_ORDINALS[i] ?? `period${i + 1}`;
    const period = buildPeriod(state, monthKey, { year, monthIndex, lastDay }, i, total, key, startDay, endDay, paycheckDay);

    // For the last period, append bills from next month that the same paycheck covers.
    if (!isLast || overhangDays === 0) return period;

    const periodId = `${monthKey}-${key}`;
    const { year: ny, monthIndex: nmi } = monthBounds(nextMonthKey);
    const overhangBills: PaycheckPeriod["bills"] = [];

    state.recurringExpenses.forEach((exp) => {
      const due = recurringDueDate(exp, nextMonthKey);
      if (!due) return;
      const day = due.getDate();
      if (day > overhangDays) return;
      const amount = exp.cadence === "annual" ? annualSetAside(exp.amount) : exp.amount;
      const paid = (exp.paidPeriods ?? []).includes(periodId);
      overhangBills.push({ id: `${exp.id}-overhang`, expenseId: exp.id, name: exp.name, date: due, amount, paid, cadence: exp.cadence, periodId });
    });

    const startDate = new Date(year, monthIndex, startDay);
    const overhangEndDate = new Date(ny, nmi, overhangDays);
    const newLabel = `${formatShortDate(startDate)} – ${formatShortDate(overhangEndDate)}`;

    if (overhangBills.length === 0) return { ...period, label: newLabel };

    const extraBills = overhangBills.reduce((s, b) => s + b.amount, 0);
    const newTotalBills = period.totalBills + extraBills;

    return {
      ...period,
      bills: [...period.bills, ...overhangBills],
      totalBills: newTotalBills,
      leftover: period.totalIncome - newTotalBills,
      label: newLabel,
      entryCount: period.entryCount + overhangBills.length,
    };
  });
}

function buildPeriod(
  state: BudgetState,
  monthKey: string,
  bounds: { year: number; monthIndex: number; lastDay: number },
  index: number,
  total: number,
  key: string,
  startDay: number,
  endDay: number,
  paycheckDay: number,
): PaycheckPeriod {
  const { year, monthIndex } = bounds;
  const periodId = `${monthKey}-${key}`;

  const incomeItems: PaycheckPeriod["incomes"] = [];
  let totalIncome = 0;
  state.incomes.forEach((inc) => {
    incomeDatesForMonth(inc, monthKey).forEach((d) => {
      const day = d.getDate();
      if (day >= startDay && day <= endDay) {
        totalIncome += inc.amount;
        incomeItems.push({ id: `${inc.id}-${day}`, name: inc.name, date: d, amount: inc.amount });
      }
    });
  });

  const billItems: PaycheckPeriod["bills"] = [];
  state.recurringExpenses.forEach((exp) => {
    const due = recurringDueDate(exp, monthKey);
    if (!due) return;
    const day = due.getDate();
    if (day < startDay || day > endDay) return;
    const amount = exp.cadence === "annual" ? annualSetAside(exp.amount) : exp.amount;
    const paid = (exp.paidPeriods ?? []).includes(periodId);
    billItems.push({ id: exp.id, expenseId: exp.id, name: exp.name, date: due, amount, paid, cadence: exp.cadence, periodId });
  });

  const totalBills = billItems.reduce((s, b) => s + b.amount, 0);
  const overdue = billItems.some((b) => !b.paid && b.date < new Date() && b.date.getMonth() === monthIndex);

  const startDate = new Date(year, monthIndex, startDay);
  const endDate = new Date(year, monthIndex, endDay);
  const label = `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;

  return {
    key,
    index: index + 1,
    total,
    startDay,
    endDay,
    paycheckDay,
    label,
    monthKey,
    totalIncome,
    totalBills,
    leftover: totalIncome - totalBills,
    bills: billItems,
    incomes: incomeItems,
    entryCount: billItems.length + incomeItems.length,
    overdue,
  };
}

// ─── Fixed-half periods (kept for other callers) ──────────────────────────────

export type PeriodSummary = {
  key: "first" | "second";
  start: number;
  end: number;
  label: string;
  monthKey: string;
  totalIncome: number;
  totalBills: number;
  leftover: number;
  bills: {
    id: string;
    expenseId: string;
    name: string;
    date: Date;
    amount: number;
    paid: boolean;
    cadence: "monthly" | "annual";
    periodId: string;
  }[];
  incomes: { id: string; name: string; date: Date; amount: number }[];
  entryCount: number;
  overdue: boolean;
};

export function periodSummariesForMonth(state: BudgetState, monthKey: string): PeriodSummary[] {
  const { year, monthIndex, lastDay } = monthBounds(monthKey);

  const periods: { key: "first" | "second"; start: number; end: number; label: string }[] = [
    {
      key: "first",
      start: 1,
      end: 15,
      label: `${formatShortDate(new Date(year, monthIndex, 1))} – ${formatShortDate(new Date(year, monthIndex, 15))}`,
    },
    {
      key: "second",
      start: 16,
      end: lastDay,
      label: `${formatShortDate(new Date(year, monthIndex, 16))} – ${formatShortDate(new Date(year, monthIndex, lastDay))}`,
    },
  ];

  return periods.map((p) => {
    const incomeNotes: PeriodSummary["incomes"] = [];
    let totalIncome = 0;
    state.incomes.forEach((inc) => {
      incomeDatesForMonth(inc, monthKey).forEach((d) => {
        const day = d.getDate();
        if (day >= p.start && day <= p.end) {
          totalIncome += inc.amount;
          incomeNotes.push({ id: inc.id + "-" + day, name: inc.name, date: d, amount: inc.amount });
        }
      });
    });

    const billNotes: PeriodSummary["bills"] = [];
    state.recurringExpenses.forEach((exp) => {
      const due = recurringDueDate(exp, monthKey);
      if (!due) return;
      const day = due.getDate();
      if (day < p.start || day > p.end) return;
      const amount = exp.cadence === "annual" ? annualSetAside(exp.amount) : exp.amount;
      const periodId = `${monthKey}-${p.key}`;
      const paid = (exp.paidPeriods ?? []).includes(periodId);
      billNotes.push({
        id: exp.id,
        expenseId: exp.id,
        name: exp.name,
        date: due,
        amount,
        paid,
        cadence: exp.cadence,
        periodId,
      });
    });

    const totalBills = billNotes.reduce((s, n) => s + n.amount, 0);
    const overdue = billNotes.some(
      (b) => !b.paid && b.date < new Date() && b.date.getMonth() === monthIndex
    );

    return {
      ...p,
      monthKey,
      totalIncome,
      totalBills,
      leftover: totalIncome - totalBills,
      bills: billNotes,
      incomes: incomeNotes,
      entryCount: billNotes.length + incomeNotes.length,
      overdue,
    };
  });
}
