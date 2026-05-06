"use client";

import { useEffect, useMemo, useState } from "react";
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

function moneyFmt(value: number) {
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  return `${v < 0 ? "−" : ""}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Money({ value, struck = false }: { value: number; struck?: boolean }) {
  const v = Number(value) || 0;
  return (
    <span
      className={`money${v < 0 ? " money--neg" : ""}`}
      style={{ fontSize: 17, textDecoration: struck ? "line-through" : "none", opacity: struck ? 0.55 : 1 }}
    >
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
            style={{
              position: "absolute",
              left: `${((todayDay - 1) / Math.max(lastDay - 1, 1)) * 100}%`,
              top: -8, width: 1.5, height: 24,
              background: "var(--signal-red)",
              transform: "translateX(-50%)",
              opacity: 0.6,
            }}
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
              <div className={cls} style={{ left: `${pct}%` }} title={`${e.tooltip}: ${e.label}`} />
              <div className="timeline__lbl" style={{ left: `${pct}%` }}>{e.day}</div>
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

      {/* 3-column stat tabs — always 3 cols regardless of goals */}
      <div className="period-card__inline-stats">
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
            className={`period-card__tab period-card__inline-stat${tab === key ? " period-card__tab--active" : ""}`}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
          >
            <div className="stat__label">{label}</div>
            <div className={`stat__value${neg ? " stat__value--neg" : ""}`}>{moneyFmt(value)}</div>
          </button>
        ))}
      </div>
      {goals.length > 0 && (
        <button
          type="button"
          className={`period-card__goals-tab${tab === "goals" ? " period-card__goals-tab--active" : ""}`}
          onClick={() => setTab("goals")}
          aria-pressed={tab === "goals"}
        >
          <span className="stat__label">Goals</span>
          <span className="period-card__goals-tab__count">{goals.length} active</span>
        </button>
      )}

      {/* List content driven by active tab */}
      <div className="recent-list">
        {tab === "income" && (
          period.incomes.length === 0 ? (
            <p className="muted" style={{ fontStyle: "italic" }}>No income in this period.</p>
          ) : (
            period.incomes.map((inc) => (
              <div key={inc.id} className="recent-item">
                <span className="recent-item__name">{inc.name}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="recent-item__date">{formatShortDate(inc.date)}</span>
                  <Money value={inc.amount} />
                </span>
              </div>
            ))
          )
        )}

        {tab === "bills" && (
          period.bills.length === 0 ? (
            <p className="muted" style={{ fontStyle: "italic" }}>No bills due in this period.</p>
          ) : (
            period.bills.map((b) => (
              <div key={b.id} className={`recent-item${b.paid ? " recent-item--paid" : ""}`}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={b.paid}
                    onChange={() => !readOnly && onTogglePaid(b.expenseId, b.periodId)}
                    disabled={readOnly}
                    style={{ accentColor: "var(--ink-1)", cursor: readOnly ? "default" : "pointer", opacity: readOnly ? 0.5 : 1 }}
                    title={readOnly ? "Locked — unlock month to edit" : (b.paid ? "Mark unpaid" : "Mark paid")}
                  />
                  <span className="recent-item__name">{b.name}</span>
                  {b.cadence === "annual" && (
                    <span className="badge" style={{ fontSize: 9 }}>annual</span>
                  )}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="recent-item__date">{formatShortDate(b.date)}</span>
                  <Money value={b.amount} struck={b.paid} />
                </span>
              </div>
            ))
          )
        )}

        {tab === "leftover" && (
          allocations.length === 0 ? (
            <p className="muted" style={{ fontStyle: "italic" }}>No budget categories set. Add them in the Budget page.</p>
          ) : (
            <>
              {allocations.map((a) => (
                <div key={a.id} className="recent-item">
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="recent-item__name">{a.name}</span>
                    <span className="badge" style={{ fontSize: 9 }}>
                      {a.mode === "percent" ? `${a.value}%` : "fixed"}
                    </span>
                  </span>
                  <Money value={a.amount} />
                </div>
              ))}
              {Math.abs(unallocated) > 0.005 && (
                <div className="recent-item" style={{ opacity: 0.55 }}>
                  <span className="recent-item__name" style={{ fontStyle: "italic" }}>Unallocated</span>
                  <Money value={unallocated} />
                </div>
              )}
            </>
          )
        )}

        {tab === "goals" && (
          goalItems.length === 0 ? (
            <p className="muted" style={{ fontStyle: "italic" }}>No goals yet. Add them in the Goals page.</p>
          ) : (
            <>
              {goalItems.map(({ goal, linkedAmount, isApplied, totalApplied, pct }) => (
                <div key={goal.id} className="goal-period-item">
                  <div className="recent-item" style={{ marginBottom: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={isApplied}
                        onChange={() => !readOnly && onToggleGoalPeriod(goal.id, periodId, linkedAmount)}
                        style={{ accentColor: "var(--ink-1)", cursor: (readOnly || linkedAmount <= 0) ? (readOnly ? "default" : "not-allowed") : "pointer", opacity: (readOnly || linkedAmount <= 0) ? 0.4 : 1 }}
                        disabled={readOnly || linkedAmount <= 0}
                        title={readOnly ? "Locked — unlock month to edit" : linkedAmount > 0
                          ? (isApplied ? "Remove contribution" : "Apply contribution")
                          : "No linked amount — set a link in Goals"
                        }
                      />
                      <span className="recent-item__name">{goal.name}</span>
                      <span className="badge" style={{ fontSize: 9 }}>
                        {goal.type === "savings" ? "savings" : "debt"}
                      </span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {linkedAmount > 0 ? (
                        <Money value={linkedAmount} />
                      ) : (
                        <span style={{ fontFamily: "var(--font-stamp)", fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.12em" }}>no link</span>
                      )}
                    </span>
                  </div>
                  <div className="goal-period-item__bar">
                    <div
                      className="goal-period-item__fill"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 100 ? "#2f6a4a" : goal.type === "debt" ? "var(--signal-red)" : "var(--ink-1)",
                      }}
                    />
                  </div>
                  <div className="goal-period-item__meta">
                    <span>{moneyFmt(totalApplied)} applied</span>
                    <span>{pct.toFixed(0)}% of {moneyFmt(goal.targetAmount)}</span>
                  </div>
                </div>
              ))}
              {totalGoalAmount > 0 && (
                <div className="recent-item" style={{ marginTop: 4, opacity: 0.6 }}>
                  <span className="recent-item__name" style={{ fontStyle: "italic" }}>Total linked</span>
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

  useEffect(() => {
    if (!hydrated) return;
    setState(loadState());
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
  const lockedMonth: LockedMonth | null = state?.lockedMonths.find((lm) => lm.monthKey === month) ?? null;
  const isArchived = !!lockedMonth;
  const isReadOnly = isPastMonth && !isUnlocked;

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
        incomes: JSON.parse(JSON.stringify(s.incomes)),
        recurringExpenses: JSON.parse(JSON.stringify(s.recurringExpenses)),
        budgetCategories: JSON.parse(JSON.stringify(s.budgetCategories)),
        goals: JSON.parse(JSON.stringify(s.goals)),
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
      <section className="container">
        <header className="sheet page-head">
          <p className="kicker">Overview</p>
          <h1 className="page-head__title">Paycheck periods</h1>
          <p className="page-head__lead">Loading the current ledger…</p>
        </header>
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
        <div className="page-head__meta">
          <div className="page-head__meta-item">
            <span className="page-head__meta-label">Month</span>
            <span className="page-head__meta-value">{formatMonthLabel(month)}</span>
          </div>
          <div className="page-head__meta-item">
            <span className="page-head__meta-label">Paychecks</span>
            <span className="page-head__meta-value">{periods.length}</span>
          </div>
          <div className="page-head__meta-item">
            <span className="page-head__meta-label">Bill entries</span>
            <span className="page-head__meta-value">{state.recurringExpenses.length}</span>
          </div>
        </div>
      </header>

      {/* Month picker */}
      <div className="sheet" style={{ padding: "14px 22px 14px 22px" }}>
        <div className="row-between">
          <div>
            <p className="kicker">Ledger month</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 1.1, color: "var(--ink-1)" }}>
                {formatMonthLabel(month)}
              </div>
              {isReadOnly && (
                <span className="stamp" style={{ fontSize: 10, padding: "2px 7px", letterSpacing: "0.12em" }}>
                  {isArchived ? "Archived" : "Past"}
                </span>
              )}
            </div>
          </div>
          <div className="row gap-sm" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            {isPastMonth && !isArchived && (
              <button className="btn btn--ghost" type="button" onClick={archiveMonth} title="Snapshot this month's data so it won't change with future edits">
                Archive
              </button>
            )}
            {isPastMonth && isArchived && !isUnlocked && (
              <button className="btn btn--ghost" type="button" onClick={() => setIsUnlocked(true)} title="Temporarily use live data and allow editing">
                Unlock
              </button>
            )}
            {isPastMonth && isUnlocked && (
              <button className="btn btn--ghost" type="button" onClick={() => setIsUnlocked(false)} title="Return to archived snapshot">
                Re-lock
              </button>
            )}
            <button className="btn btn--ghost" type="button" onClick={() => setMonth(shiftMonth(month, -1))}>‹ Prev</button>
            <button className="btn btn--ghost" type="button" onClick={() => setMonth(currentMonthKey())}>Today</button>
            <button className="btn btn--ghost" type="button" onClick={() => setMonth(shiftMonth(month, 1))}>Next ›</button>
          </div>
        </div>
        {isPastMonth && !isArchived && (
          <p className="muted" style={{ marginTop: 8, fontStyle: "italic", fontSize: 13 }}>
            This month is not archived. Changes to income, expenses, or budget categories will affect its display. Archive to freeze a snapshot.
          </p>
        )}
        {isPastMonth && isUnlocked && (
          <p className="muted" style={{ marginTop: 8, fontStyle: "italic", fontSize: 13 }}>
            Unlocked — showing live data. Re-lock to restore the archived snapshot.
          </p>
        )}
      </div>

      {/* Month stats row */}
      <div className="stat-row">
        <article className="sheet stat" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Total income</div>
          <div className="stat__value">{moneyFmt(totals.income)}</div>
        </article>
        <article className="sheet stat" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Total bills due</div>
          <div className="stat__value">{moneyFmt(totals.bills)}</div>
        </article>
        <article className="sheet stat stat--accent" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Month leftover</div>
          <div className={`stat__value${totals.leftover < 0 ? " stat__value--neg" : ""}`}>{moneyFmt(totals.leftover)}</div>
        </article>
      </div>

      {/* Cash-flow timeline */}
      <div className="sheet" style={{ padding: "20px 28px 24px" }}>
        <div className="row-between mb-3">
          <div>
            <p className="kicker">Cash-flow timeline</p>
            <h2 className="section-title">{formatMonthLabel(month)}</h2>
          </div>
          <div className="timeline__legend" style={{ marginTop: 0 }}>
            <span><span className="timeline__legend-dot" style={{ background: "var(--ink-1)" }} />Income</span>
            <span>
              <span className="timeline__legend-dot" style={{ background: "var(--paper-1)", border: "2px solid var(--signal-red)", display: "inline-block" }} />
              Bill due
            </span>
            <span><span className="timeline__legend-dot" style={{ background: "rgba(47,106,74,0.6)" }} />Paid</span>
          </div>
        </div>
        <Timeline events={events} lastDay={lastDay} todayDay={todayDay} />
        <div className="divider" />
        <div className="row-between">
          <div>
            <span className="page-head__meta-label">End-of-month balance</span>
            <div style={{ fontFamily: "var(--font-numerals)", fontSize: 22, marginTop: 2, color: "var(--ink-1)" }}>
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
