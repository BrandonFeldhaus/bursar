"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadState, saveState, type BudgetState } from "./lib/storage";
import {
  currentMonthKey,
  formatMonthLabel,
  formatShortDate,
  incomeDatesForMonth,
  monthBounds,
  paycheckPeriodsForMonth,
  type PaycheckPeriod,
  recurringDueDate,
  shiftMonth,
  annualSetAside,
} from "./lib/month";
import { useHydrated } from "./lib/useHydrated";
import { moneyFmt } from "./lib/currency";
import { ConfirmDialog } from "./components/ConfirmDialog";

function Money({ value, struck = false }: { value: number; struck?: boolean }) {
  const v = Number(value) || 0;
  return (
    <span className={`money money--md${v < 0 ? " money--neg" : ""}${struck ? " money--struck" : ""}`}>
      {moneyFmt(v)}
    </span>
  );
}

function Sparkline({ values, width = 220, height = 32 }: { values: number[]; width?: number; height?: number }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);
  const pts = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={pts} fill="none" stroke="var(--ink-1)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Timeline({
  events,
  lastDay,
  todayDay,
}: {
  events: { kind: string; day: number; label: string; tooltip: string }[];
  lastDay: number;
  todayDay: number | null;
}) {
  const sorted = [...events].sort((a, b) => a.day - b.day);
  return (
    <div className="timeline">
      <div className="timeline__rail">
        {todayDay != null && (
          <div
            className="timeline__today"
            style={{ "--pos": `${((todayDay - 1) / Math.max(lastDay - 1, 1)) * 100}%` } as CSSProperties}
            title={`Today: day ${todayDay}`}
          />
        )}
        {sorted.map((e, i) => {
          const pct = ((e.day - 1) / Math.max(lastDay - 1, 1)) * 100;
          const cls =
            e.kind === "income"
              ? "timeline__tick timeline__tick--income"
              : e.kind === "paid"
              ? "timeline__tick timeline__tick--paid"
              : "timeline__tick timeline__tick--bill";
          return (
            <span key={i}>
              <div className={cls} style={{ "--pos": `${pct}%` } as CSSProperties} title={`${e.tooltip}: ${e.label}`} />
              <div className="timeline__lbl" style={{ "--pos": `${pct}%` } as CSSProperties}>{e.day}</div>
            </span>
          );
        })}
      </div>
    </div>
  );
}

type TabKey = "income" | "bills" | "leftover" | "goals";

import type { BudgetCategory, Goal, LockedMonth } from "./lib/budgetStorage";
import { computeAllocations } from "./lib/allocations";

function PeriodCard({
  period,
  budgetCategories,
  goals,
  onTogglePaid,
  onToggleGoalPeriod,
  readOnly = false,
}: {
  period: PaycheckPeriod;
  budgetCategories: BudgetCategory[];
  goals: Goal[];
  onTogglePaid: (expenseId: string, periodId: string) => void;
  onToggleGoalPeriod: (goalId: string, periodId: string, amount: number) => void;
  readOnly?: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("bills");

  const ordinal = ["st", "nd", "rd"][period.index - 1] ?? "th";
  const kicker = period.total === 1
    ? "Only paycheck"
    : `${period.index}${ordinal} paycheck of ${period.total}`;

  const paidCount = period.bills.filter((b) => b.paid).length;
  const billCount = period.bills.length;
  const paidPct = billCount > 0 ? (paidCount / billCount) * 100 : 0;

  const allocations = useMemo(
    () => computeAllocations(period.leftover, budgetCategories),
    [period.leftover, budgetCategories],
  );

  const allocatedTotal = useMemo(() => allocations.reduce((s, a) => s + a.amount, 0), [allocations]);
  const unallocated = period.leftover - allocatedTotal;

  const periodId = `${period.monthKey}-${period.key}`;

  const goalItems = useMemo(() => {
    return goals.map((g) => {
      const catAmount = g.linkedBudgetCategoryIds.reduce((s, catId) => {
        const alloc = allocations.find((a) => a.id === catId);
        return s + (alloc?.amount ?? 0);
      }, 0);
      const expAmount = g.linkedExpenseIds.reduce((s, expId) => {
        const bill = period.bills.find((b) => b.expenseId === expId);
        return s + (bill?.amount ?? 0);
      }, 0);
      const linkedAmount = catAmount + expAmount;
      const applied = g.appliedPeriods.find((p) => p.periodId === periodId);
      const totalApplied =
        g.appliedPeriods.reduce((s, p) => s + p.amount, 0) +
        g.manualAdjustments.reduce((s, a) => s + a.amount, 0);
      const pct = g.targetAmount > 0 ? Math.min(100, (totalApplied / g.targetAmount) * 100) : 0;
      return { goal: g, linkedAmount, isApplied: !!applied, totalApplied, pct };
    });
  }, [goals, allocations, period.bills, periodId]);

  const totalGoalAmount = useMemo(
    () => goalItems.reduce((s, gi) => s + gi.linkedAmount, 0),
    [goalItems],
  );

  return (
    <div className="sheet period-card">
      <div className="period-card__head">
        <div>
          <p className="kicker">{kicker}</p>
          <h3>{period.label}</h3>
        </div>
        <div className="row gap-sm">
          {period.bills.length > 1 && period.bills.every((b) => b.paid) && (
            <span className="stamp stamp--paid">Audited</span>
          )}
          <span className="badge">{period.entryCount} entries</span>
        </div>
      </div>

      {billCount > 0 && (
        <div
          className="period-card__paid-strip"
          aria-label={`${paidCount} of ${billCount} bills paid`}
          title={`${paidCount} of ${billCount} bills paid`}
        >
          <span>Bills paid</span>
          <div className="period-card__paid-bar">
            <div
              className={`period-card__paid-bar__fill${paidCount === billCount ? " period-card__paid-bar__fill--all" : ""}`}
              style={{ "--pct": `${paidPct}%` } as CSSProperties}
            />
          </div>
          <span className="period-card__paid-count">{paidCount}/{billCount}</span>
        </div>
      )}

      {/* Tabbed panels: income, bills, leftover, optional goals */}
      <div className="period-card__inline-stats" role="tablist">
        {(
          [
            { key: "income", label: "Income", value: period.totalIncome, neg: false },
            { key: "bills", label: "Bills", value: period.totalBills, neg: false },
            { key: "leftover", label: "Leftover", value: period.leftover, neg: period.leftover < 0 },
          ] as const
        ).map(({ key, label, value, neg }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`period-card__tab period-card__inline-stat${tab === key ? " period-card__tab--active" : ""}`}
            onClick={() => setTab(key)}
          >
            <div className="stat__label">{label}</div>
            <div className={`stat__value${neg ? " stat__value--neg" : ""}`}>{moneyFmt(value)}</div>
          </button>
        ))}
        {goals.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "goals"}
            className={`period-card__goals-tab${tab === "goals" ? " period-card__goals-tab--active" : ""}`}
            onClick={() => setTab("goals")}
          >
            <span className="stat__label">Goals</span>
            <span className="period-card__goals-tab__count">{goals.length} active</span>
          </button>
        )}
      </div>

      {/* List content driven by active tab */}
      <div className="recent-list">
        {tab === "income" && (
          period.incomes.length === 0 ? (
            <p className="muted muted--italic">No income in this period.</p>
          ) : (
            period.incomes.map((inc) => (
              <div key={inc.id} className="recent-item">
                <span className="recent-item__name">{inc.name}</span>
                <span className="recent-item__group recent-item__group--wide">
                  <span className="recent-item__date">{formatShortDate(inc.date)}</span>
                  <Money value={inc.amount} />
                </span>
              </div>
            ))
          )
        )}

        {tab === "bills" && (
          period.bills.length === 0 ? (
            <p className="muted muted--italic">No bills due in this period.</p>
          ) : (
            period.bills.map((b) => (
              <div key={b.id} className={`recent-item${b.paid ? " recent-item--paid" : ""}`}>
                <span className="recent-item__group">
                  <input
                    type="checkbox"
                    checked={b.paid}
                    onChange={() => !readOnly && onTogglePaid(b.expenseId, b.periodId)}
                    disabled={readOnly}
                    className={`recent-item__check${readOnly ? " recent-item__check--locked" : ""}`}
                    title={readOnly ? "Locked — unlock month to edit" : (b.paid ? "Mark unpaid" : "Mark paid")}
                  />
                  <span className="recent-item__name">{b.name}</span>
                  {b.cadence === "annual" && (
                    <span className="badge badge--xs">annual</span>
                  )}
                </span>
                <span className="recent-item__group recent-item__group--wide">
                  <span className="recent-item__date">{formatShortDate(b.date)}</span>
                  <Money value={b.amount} struck={b.paid} />
                </span>
              </div>
            ))
          )
        )}

        {tab === "leftover" && (
          allocations.length === 0 ? (
            <p className="muted muted--italic">No budget categories set. Add them in the Budget page.</p>
          ) : (
            <>
              {allocations.map((a) => (
                <div key={a.id} className="recent-item">
                  <span className="recent-item__group">
                    <span className="recent-item__name">{a.name}</span>
                    <span className="badge badge--xs">
                      {a.mode === "percent" ? `${a.value}%` : "fixed"}
                    </span>
                  </span>
                  <Money value={a.amount} />
                </div>
              ))}
              {Math.abs(unallocated) > 0.005 && (
                <div className="recent-item recent-item--faint">
                  <span className="recent-item__name recent-item__name--italic">Unallocated</span>
                  <Money value={unallocated} />
                </div>
              )}
            </>
          )
        )}

        {tab === "goals" && (
          goalItems.length === 0 ? (
            <p className="muted muted--italic">No goals yet. Add them in the Goals page.</p>
          ) : (
            <>
              {goalItems.map(({ goal, linkedAmount, isApplied, totalApplied, pct }) => (
                <div key={goal.id} className="goal-period-item">
                  <div className="recent-item">
                    <span className="recent-item__group">
                      <input
                        type="checkbox"
                        checked={isApplied}
                        onChange={() => !readOnly && onToggleGoalPeriod(goal.id, periodId, linkedAmount)}
                        className={`recent-item__check${readOnly ? " recent-item__check--locked" : linkedAmount <= 0 ? " recent-item__check--nolink" : ""}`}
                        disabled={readOnly || linkedAmount <= 0}
                        title={readOnly ? "Locked — unlock month to edit" : linkedAmount > 0
                          ? (isApplied ? "Remove contribution" : "Apply contribution")
                          : "No linked amount — set a link in Goals"
                        }
                      />
                      <span className="recent-item__name">{goal.name}</span>
                      <span className="badge badge--xs">
                        {goal.type === "savings" ? "savings" : "debt"}
                      </span>
                    </span>
                    <span className="recent-item__group">
                      {linkedAmount > 0 ? (
                        <Money value={linkedAmount} />
                      ) : (
                        <span className="goal-period-item__nolink">no link</span>
                      )}
                    </span>
                  </div>
                  <div className="goal-period-item__bar">
                    <div
                      className={`goal-period-item__fill${pct >= 100 ? " goal-period-item__fill--done" : goal.type === "debt" ? " goal-period-item__fill--debt" : ""}`}
                      style={{ "--pct": `${pct}%` } as CSSProperties}
                    />
                  </div>
                  <div className="goal-period-item__meta">
                    <span>{moneyFmt(totalApplied)} applied</span>
                    <span>{pct.toFixed(0)}% of {moneyFmt(goal.targetAmount)}</span>
                  </div>
                </div>
              ))}
              {totalGoalAmount > 0 && (
                <div className="recent-item recent-item--total">
                  <span className="recent-item__name recent-item__name--italic">Total linked</span>
                  <Money value={totalGoalAmount} />
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const hydrated = useHydrated();
  const [state, setState] = useState<BudgetState | null>(null);
  const [month, setMonth] = useState(currentMonthKey());
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const loaded = loadState();
    if (!loaded) {
      setState(loaded);
      return;
    }

    // Auto-archive every past month that hasn't been snapshotted yet.
    // Uses current live data as the snapshot (same as the manual Archive button).
    const cmk = currentMonthKey();
    const createdMonthKey = loaded.meta.createdAt
      ? loaded.meta.createdAt.slice(0, 7)
      : shiftMonth(cmk, -12);

    let s = loaded;
    let m = shiftMonth(cmk, -1);
    while (m >= createdMonthKey) {
      if (!s.lockedMonths.some((lm) => lm.monthKey === m)) {
        const snapshot: LockedMonth = {
          monthKey: m,
          lockedAt: new Date().toISOString(),
          incomes: structuredClone(s.incomes),
          recurringExpenses: structuredClone(s.recurringExpenses),
          budgetCategories: structuredClone(s.budgetCategories),
          goals: structuredClone(s.goals),
        };
        s = { ...s, lockedMonths: [...s.lockedMonths, snapshot] };
      }
      m = shiftMonth(m, -1);
    }

    setState(s);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !state) return;
    saveState(state);
  }, [hydrated, state]);

  // Reset unlock whenever the user navigates months
  useEffect(() => {
    setIsUnlocked(false);
  }, [month]);

  const cmk = currentMonthKey();
  const isPastMonth = month < cmk;
  const firstMonthKey = state?.meta.createdAt ? state.meta.createdAt.slice(0, 7) : cmk;
  const lockedMonth: LockedMonth | null = state?.lockedMonths.find((lm) => lm.monthKey === month) ?? null;
  const isArchived = !!lockedMonth;
  const isReadOnly = (isPastMonth || isArchived) && !isUnlocked;

  // Use the archived snapshot's data when the month is locked, else live state
  const stateForMonth = useMemo((): BudgetState | null => {
    if (!state) return null;
    if (isArchived && !isUnlocked && lockedMonth) {
      return {
        ...state,
        incomes: lockedMonth.incomes,
        recurringExpenses: lockedMonth.recurringExpenses,
        budgetCategories: lockedMonth.budgetCategories,
        goals: lockedMonth.goals,
      };
    }
    return state;
  }, [state, isArchived, isUnlocked, lockedMonth]);

  // Paycheck-based periods replace the old fixed-half periods
  const periods = useMemo(() => (stateForMonth ? paycheckPeriodsForMonth(stateForMonth, month) : []), [stateForMonth, month]);

  const totals = useMemo(
    () =>
      periods.reduce(
        (acc, p) => ({ income: acc.income + p.totalIncome, bills: acc.bills + p.totalBills, leftover: acc.leftover + p.leftover }),
        { income: 0, bills: 0, leftover: 0 },
      ),
    [periods],
  );

  const { lastDay, year, monthIndex } = useMemo(() => monthBounds(month), [month]);

  // Build timeline events from the period data so paid status is consistent
  const events = useMemo(() => {
    if (!stateForMonth) return [];
    const evts: { kind: string; day: number; label: string; tooltip: string }[] = [];
    // Income events
    stateForMonth.incomes.forEach((inc) => {
      incomeDatesForMonth(inc, month).forEach((d) => {
        evts.push({ kind: "income", day: d.getDate(), label: moneyFmt(inc.amount), tooltip: inc.name });
      });
    });
    // Bill events — paid status from the period data
    const billPaid = new Map<string, boolean>();
    periods.forEach((p) => p.bills.forEach((b) => billPaid.set(b.expenseId, b.paid)));
    stateForMonth.recurringExpenses.forEach((exp) => {
      const due = recurringDueDate(exp, month);
      if (!due) return;
      const paid = billPaid.get(exp.id) ?? false;
      const amt = exp.cadence === "annual" ? annualSetAside(exp.amount) : exp.amount;
      evts.push({ kind: paid ? "paid" : "bill", day: due.getDate(), label: moneyFmt(amt), tooltip: exp.name });
    });
    return evts;
  }, [stateForMonth, month, periods]);

  const dayBalances = useMemo(() => {
    let running = 0;
    const out: number[] = [];
    for (let day = 1; day <= lastDay; day++) {
      events.filter((e) => e.day === day).forEach((e) => {
        const n = parseFloat(e.label.replace(/[$,−]/g, ""));
        if (e.kind === "income") running += n;
        else running -= n;
      });
      out.push(running);
    }
    return out;
  }, [events, lastDay]);

  function togglePaid(expenseId: string, periodId: string) {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        recurringExpenses: s.recurringExpenses.map((e) => {
          if (e.id !== expenseId) return e;
          const paid = e.paidPeriods ?? [];
          return { ...e, paidPeriods: paid.includes(periodId) ? paid.filter((p) => p !== periodId) : [...paid, periodId] };
        }),
      };
    });
  }

  function toggleGoalPeriod(goalId: string, periodId: string, amount: number) {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        goals: s.goals.map((g) => {
          if (g.id !== goalId) return g;
          const exists = g.appliedPeriods.find((p) => p.periodId === periodId);
          return {
            ...g,
            appliedPeriods: exists
              ? g.appliedPeriods.filter((p) => p.periodId !== periodId)
              : [...g.appliedPeriods, { periodId, amount }],
          };
        }),
      };
    });
  }

  function archiveMonth() {
    setState((s) => {
      if (!s) return s;
      const snapshot: LockedMonth = {
        monthKey: month,
        lockedAt: new Date().toISOString(),
        incomes: structuredClone(s.incomes),
        recurringExpenses: structuredClone(s.recurringExpenses),
        budgetCategories: structuredClone(s.budgetCategories),
        goals: structuredClone(s.goals),
      };
      const rest = s.lockedMonths.filter((lm) => lm.monthKey !== month);
      return { ...s, lockedMonths: [...rest, snapshot] };
    });
  }

  const today = new Date();
  const todayIsThisMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
  const todayDay = todayIsThisMonth ? today.getDate() : null;

  if (!hydrated || !state || !stateForMonth) {
    return (
      <section className="container" aria-busy="true">
        <header className="sheet page-head">
          <p className="kicker">Overview</p>
          <h1 className="page-head__title">Paycheck periods</h1>
          <p className="page-head__lead">Loading the current ledger…</p>
        </header>
        <div className="stat-row" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <article key={i} className="sheet stat sheet--stat">
              <span className="skeleton skeleton--line skeleton--stat-label" />
              <div className="skeleton-gap">
                <span className="skeleton skeleton--line skeleton--stat-value" />
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  const hasNoData =
    state.incomes.length === 0 && state.recurringExpenses.length === 0;

  if (hasNoData) {
    return (
      <section className="container">
        <header className="sheet page-head">
          <p className="kicker">Overview</p>
          <h1 className="page-head__title">Paycheck periods</h1>
          <p className="page-head__lead">
            Your ledger is blank. Add an income source to see paychecks, bills, and what's left over.
          </p>
        </header>
        <div className="sheet empty-state">
          <p className="kicker">Get started</p>
          <h2 className="section-title">Three steps to your first ledger</h2>
          <ol className="empty-state__steps">
            <li>
              <span className="empty-state__num">1</span>
              <div>
                <strong>Add your paycheck.</strong>
                <p className="muted">Tell the ledger when and how much you get paid.</p>
              </div>
            </li>
            <li>
              <span className="empty-state__num">2</span>
              <div>
                <strong>Log recurring bills.</strong>
                <p className="muted">Rent, utilities, subscriptions — anything that returns each month.</p>
              </div>
            </li>
            <li>
              <span className="empty-state__num">3</span>
              <div>
                <strong>Plan the leftover.</strong>
                <p className="muted">Set budget categories so every spare dollar has a job.</p>
              </div>
            </li>
          </ol>
          <div className="empty-state__actions">
            <Link href="/income" className="btn btn--lg">Add your first income</Link>
            <Link href="/expenses" className="btn btn--ghost">Skip to bills</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="container">
      {/* Page head */}
      <header className="sheet page-head">
        <p className="kicker">Overview</p>
        <h1 className="page-head__title">Paycheck periods</h1>
        <p className="page-head__lead">
          Each card represents a paycheck period — income that lands, bills due, and what's left over.
        </p>
      </header>

      {/* Month picker */}
      <div className="sheet sheet--bar">
        <div className="row-between">
          <div>
            <p className="kicker">Ledger month</p>
            <div className="month-title">
              <div className="month-title__label">
                {formatMonthLabel(month)}
              </div>
              {isReadOnly && (
                <span className="stamp stamp--sm">
                  {isArchived ? (isPastMonth ? "Archived" : "Locked") : "Past"}
                </span>
              )}
            </div>
          </div>
          <div className="month-controls">
            <div className="month-controls__group">
              <button className="btn btn--ghost" type="button" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= firstMonthKey} aria-label="Previous month">‹ Prev</button>
              <button className="btn btn--ghost" type="button" onClick={() => setMonth(currentMonthKey())}>Today</button>
              <button className="btn btn--ghost" type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">Next ›</button>
            </div>
            <div className="month-controls__group">
              {!isArchived && (
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={archiveMonth}
                  title={isPastMonth ? "Snapshot this month's data so it won't change with future edits" : "Freeze this month's data so future changes to income or expenses won't affect it"}
                >
                  {isPastMonth ? "Archive" : "Lock"}
                </button>
              )}
              {isArchived && !isUnlocked && (
                <button className="btn btn--ghost" type="button" onClick={() => setUnlockOpen(true)} title="Edit this month's underlying income or bills">
                  Unlock
                </button>
              )}
              {isArchived && isUnlocked && (
                <button className="btn btn--ghost" type="button" onClick={() => setIsUnlocked(false)} title={isPastMonth ? "Return to archived snapshot" : "Return to locked snapshot"}>
                  Re-lock
                </button>
              )}
            </div>
          </div>
        </div>
        {!isPastMonth && !isArchived && (
          <p className="muted month-note">
            Lock this month to freeze its data — future edits to income, expenses, or budget categories won't affect it.
          </p>
        )}
        {isArchived && isUnlocked && (
          <p className="muted month-note">
            Unlocked — edits here update your live income, bills, and budget for every unlocked month. Re-lock to restore the {isPastMonth ? "archived" : "locked"} snapshot.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={unlockOpen}
        title="Unlock this month?"
        body={
          <>
            <p>
              You're about to edit a {isPastMonth ? "past, archived" : "locked"} month using live data.
            </p>
            <p>
              Changes to income sources, bills, or budget categories aren't scoped to this month — they apply to your live ledger, which affects every unlocked month, including future ones.
            </p>
          </>
        }
        confirmLabel="Unlock & edit live"
        cancelLabel="Keep locked"
        onConfirm={() => {
          setIsUnlocked(true);
          setUnlockOpen(false);
        }}
        onCancel={() => setUnlockOpen(false)}
      />

      {/* Month stats row */}
      <div className="stat-row">
        <article className="sheet stat sheet--stat">
          <div className="stat__label">Total income</div>
          <div className="stat__value">{moneyFmt(totals.income)}</div>
        </article>
        <article className="sheet stat sheet--stat">
          <div className="stat__label">Total bills due</div>
          <div className="stat__value">{moneyFmt(totals.bills)}</div>
        </article>
        <article className="sheet stat stat--accent sheet--stat">
          <div className="stat__label">Month leftover</div>
          <div className={`stat__value${totals.leftover < 0 ? " stat__value--neg" : ""}`}>{moneyFmt(totals.leftover)}</div>
        </article>
      </div>

      {/* Cash-flow timeline */}
      <div className="sheet timeline-card">
        <div className="row-between mb-3">
          <div>
            <p className="kicker">Cash-flow timeline</p>
            <h2 className="section-title">{formatMonthLabel(month)}</h2>
          </div>
          <div className="timeline__legend timeline__legend--inline">
            <span><span className="timeline__legend-dot timeline__legend-dot--income" />Income</span>
            <span>
              <span className="timeline__legend-dot timeline__legend-dot--bill" />
              Bill due
            </span>
            <span><span className="timeline__legend-dot timeline__legend-dot--paid" />Paid</span>
          </div>
        </div>
        <Timeline events={events} lastDay={lastDay} todayDay={todayDay} />
        <div className="divider" />
        <div className="row-between">
          <div>
            <span className="page-head__meta-label">End-of-month balance</span>
            <div className="timeline__balance">
              {moneyFmt(dayBalances[dayBalances.length - 1] ?? 0)}
            </div>
          </div>
          <Sparkline values={dayBalances.length ? dayBalances : [0, 0]} width={220} height={32} />
        </div>
      </div>

      {/* Paycheck period cards — one per paycheck date */}
      <div className="period-grid">
        {periods.map((p) => (
          <PeriodCard
            key={p.key}
            period={p}
            budgetCategories={stateForMonth.budgetCategories}
            goals={stateForMonth.goals}
            onTogglePaid={togglePaid}
            onToggleGoalPeriod={toggleGoalPeriod}
            readOnly={isReadOnly}
          />
        ))}
      </div>
    </section>
  );
}
