"use client";

import { type CSSProperties, type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconChevronDown, IconPlus } from "@tabler/icons-react";
import {
  loadState,
  saveState,
  type BudgetCategory,
  type BudgetState,
  type Goal,
  type LockedMonth,
} from "./lib/storage";
import {
  annualSetAside,
  currentMonthKey,
  formatMonthLabel,
  formatShortDate,
  incomeDatesForMonth,
  monthBounds,
  paycheckPeriodsForMonth,
  type PaycheckPeriod,
  recurringDueDate,
  shiftMonth,
} from "./lib/month";
import { backfillSnapshots, upsertSnapshot, viewStateForMonth } from "./lib/monthView";
import { sampleData } from "./lib/sampleData";
import { useHydrated } from "./lib/useHydrated";
import { useIsMobile } from "./lib/useIsMobile";
import { moneyFmt } from "./lib/currency";
import { computeAllocations } from "./lib/allocations";
import { goalFundingTotal } from "./lib/goalFunding";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { FormDialog } from "./components/FormDialog";
import { OverflowMenu } from "./components/OverflowMenu";
import { ImportLedgerButton } from "./components/ImportLedgerButton";
import { Hint, dismissHint, type HintId } from "./components/Hint";
import {
  AddSourceForm,
  emptySourceDraft,
  incomeFromDraft,
  sourceDraftErrors,
  type SourceDraft,
} from "./components/AddSourceForm";
import {
  AddBillForm,
  billDraftErrors,
  emptyBillDraft,
  expenseFromDraft,
  type BillFormDraft,
} from "./components/AddBillForm";

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

function PeriodCard({
  period,
  budgetCategories,
  goals,
  hasIncome,
  hasBills,
  isCurrent,
  onTogglePaid,
  onToggleGoalPeriod,
  body,
  billsEmptyState,
  incomeAddon,
  billsAddon,
  hint,
}: {
  period: PaycheckPeriod;
  budgetCategories: BudgetCategory[];
  goals: Goal[];
  /** The store has at least one income source (else the fallback halves are shown). */
  hasIncome: boolean;
  /** The store has at least one bill (else the Bills tab shows its empty state). */
  hasBills: boolean;
  isCurrent: boolean;
  onTogglePaid: (expenseId: string, periodId: string) => void;
  onToggleGoalPeriod: (goalId: string, periodId: string, amount: number) => void;
  /** Replaces the whole card body (first-run empty state). */
  body?: ReactNode;
  /** Rendered in the Bills tab when the store has no bills at all. */
  billsEmptyState?: ReactNode;
  /** Quick-add row at the bottom of the Income tab. */
  incomeAddon?: ReactNode;
  /** Quick-add row at the bottom of the Bills tab (when the store has bills). */
  billsAddon?: ReactNode;
  /** One-line hint rendered under the tab row. */
  hint?: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("bills");

  const ordinal = ["st", "nd", "rd"][period.index - 1] ?? "th";
  const kicker = !hasIncome
    ? `Period ${period.index} of ${period.total}`
    : period.total === 1
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

  // What each goal's funding sources come to in this period — shared with the goal editor via lib/goalFunding.ts.
  const goalItems = useMemo(() => {
    return goals.map((g) => {
      const linkedAmount = goalFundingTotal(g, allocations, period.bills);
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

  const tabKeys: TabKey[] = goals.length > 0 ? ["income", "bills", "leftover", "goals"] : ["income", "bills", "leftover"];
  const tabId = (key: TabKey) => `${periodId}-tab-${key}`;
  const panelId = `${periodId}-panel`;

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, key: TabKey) {
    const i = tabKeys.indexOf(key);
    let next: TabKey | null = null;
    if (e.key === "ArrowRight") next = tabKeys[(i + 1) % tabKeys.length];
    else if (e.key === "ArrowLeft") next = tabKeys[(i - 1 + tabKeys.length) % tabKeys.length];
    else if (e.key === "Home") next = tabKeys[0];
    else if (e.key === "End") next = tabKeys[tabKeys.length - 1];
    if (!next) return;
    e.preventDefault();
    setTab(next);
    document.getElementById(tabId(next))?.focus();
  }

  return (
    <div className={`sheet period-card${isCurrent ? " period-card--current" : ""}`}>
      <div className="period-card__head">
        <div>
          <p className="kicker">{kicker}</p>
          <h3>{period.label}</h3>
        </div>
        <div className="row gap-sm">
          {isCurrent && <span className="stamp stamp--sm stamp--current">Current</span>}
          {period.bills.length > 1 && period.bills.every((b) => b.paid) && (
            <span className="stamp stamp--sm stamp--paid">All paid</span>
          )}
          {body === undefined && (
            <span className="badge">{period.entryCount} {period.entryCount === 1 ? "entry" : "entries"}</span>
          )}
        </div>
      </div>

      {body !== undefined ? (
        body
      ) : (
        <>
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

          {/* Tabs: income, bills, leftover, optional goals */}
          <div className="period-card__tabs" role="tablist" aria-label={`${period.label} details`}>
            {(
              [
                { key: "income", label: "Income", value: period.totalIncome, neg: false },
                { key: "bills", label: "Bills", value: period.totalBills, neg: false },
                { key: "leftover", label: "Leftover", value: period.leftover, neg: period.leftover < 0 },
              ] as const
            ).map(({ key, label, value, neg }) => (
              <button
                key={key}
                id={tabId(key)}
                type="button"
                role="tab"
                aria-selected={tab === key}
                aria-controls={panelId}
                tabIndex={tab === key ? 0 : -1}
                className={`period-card__tab${tab === key ? " period-card__tab--active" : ""}`}
                onClick={() => setTab(key)}
                onKeyDown={(e) => onTabKeyDown(e, key)}
              >
                <span className="stat__label">{label}</span>
                <span className={`stat__value${neg ? " stat__value--neg" : ""}`}>{moneyFmt(value)}</span>
              </button>
            ))}
            {goals.length > 0 && (
              <button
                id={tabId("goals")}
                type="button"
                role="tab"
                aria-selected={tab === "goals"}
                aria-controls={panelId}
                tabIndex={tab === "goals" ? 0 : -1}
                className={`period-card__tab period-card__tab--goals${tab === "goals" ? " period-card__tab--active" : ""}`}
                onClick={() => setTab("goals")}
                onKeyDown={(e) => onTabKeyDown(e, "goals")}
              >
                <span className="stat__label">Goals</span>
                <span className="period-card__goals-count">{goals.length} active</span>
              </button>
            )}
          </div>

          {hint}

          {/* Panel driven by the active tab */}
          <div className="recent-list" role="tabpanel" id={panelId} aria-labelledby={tabId(tab)}>
            {tab === "income" && (
              <>
                {period.incomes.length === 0 ? (
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
                )}
                {incomeAddon}
              </>
            )}

            {tab === "bills" && (
              !hasBills && billsEmptyState !== undefined ? (
                billsEmptyState
              ) : (
              <>
                {period.bills.length === 0 ? (
                  <p className="muted muted--italic">No bills due in this period.</p>
                ) : (
                period.bills.map((b) => (
                  <div key={b.id} className={`recent-item${b.paid ? " recent-item--paid" : ""}`}>
                    <label className="recent-item__group recent-item__toggle">
                      <input
                        type="checkbox"
                        checked={b.paid}
                        onChange={() => onTogglePaid(b.expenseId, b.periodId)}
                        className="recent-item__check"
                        title={b.paid ? "Mark unpaid" : "Mark paid"}
                        aria-label={`${b.name} paid`}
                      />
                      <span className="recent-item__name">{b.name}</span>
                      {b.cadence === "annual" && (
                        <span className="badge badge--xs">annual</span>
                      )}
                    </label>
                    <span className="recent-item__group recent-item__group--wide">
                      <span className="recent-item__date">{formatShortDate(b.date)}</span>
                      <Money value={b.amount} struck={b.paid} />
                    </span>
                  </div>
                ))
                )}
                {billsAddon}
              </>
              )
            )}

            {tab === "leftover" && (
              allocations.length === 0 ? (
                <p className="muted muted--italic">
                  Leftover isn’t planned yet. <Link href="/budget" className="text-link">Plan it on the Budget page.</Link>
                </p>
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
              <>
                {goalItems.map(({ goal, linkedAmount, isApplied, totalApplied, pct }) => (
                  <div key={goal.id} className="goal-period-item">
                    <div className="recent-item">
                      <label className="recent-item__group recent-item__toggle">
                        <input
                          type="checkbox"
                          checked={isApplied}
                          onChange={() => onToggleGoalPeriod(goal.id, periodId, linkedAmount)}
                          className={`recent-item__check${linkedAmount <= 0 ? " recent-item__check--nolink" : ""}`}
                          disabled={linkedAmount <= 0}
                          title={linkedAmount > 0
                            ? (isApplied ? "Remove contribution" : "Apply contribution")
                            : "Not funded yet — add funding sources on the Goals page"
                          }
                          aria-label={`${goal.name} contribution applied`}
                        />
                        <span className="recent-item__name">{goal.name}</span>
                        <span className="badge badge--xs">
                          {goal.type === "savings" ? "savings" : "debt"}
                        </span>
                      </label>
                      <span className="recent-item__group">
                        {linkedAmount > 0 ? (
                          <Money value={linkedAmount} />
                        ) : (
                          <span className="goal-period-item__nolink">not funded</span>
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
                    <span className="recent-item__name recent-item__name--italic">Total to goals</span>
                    <Money value={totalGoalAmount} />
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type DialogKind = null | "source" | "bill";

export default function Home() {
  const hydrated = useHydrated();
  const isMobile = useIsMobile();
  const [state, setState] = useState<BudgetState | null>(null);
  const [month, setMonth] = useState(currentMonthKey());
  const [refreshOpen, setRefreshOpen] = useState(false);

  // Add income / add bill: one FormDialog (centered on desktop, bottom sheet on mobile)
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [sourceDraft, setSourceDraft] = useState<SourceDraft>(emptySourceDraft);
  const [sourceAttempted, setSourceAttempted] = useState(false);
  const [billDraft, setBillDraft] = useState<BillFormDraft>(emptyBillDraft);
  const [billAttempted, setBillAttempted] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  useEffect(() => {
    if (!hydrated) return;
    // Snapshot every past month since createdAt that lacks one (definitions only).
    setState(backfillSnapshots(loadState()));
  }, [hydrated]);

  // saveState also refreshes the current month's snapshot from live definitions.
  useEffect(() => {
    if (!hydrated || !state) return;
    saveState(state);
  }, [hydrated, state]);

  const cmk = currentMonthKey();
  const isPastMonth = month < cmk;
  const firstMonthKey = state?.meta.createdAt ? state.meta.createdAt.slice(0, 7) : cmk;
  const lockedMonth: LockedMonth | null = state?.lockedMonths.find((lm) => lm.monthKey === month) ?? null;

  // Past months render their snapshot's definitions with live facts; everything else is live.
  const viewState = useMemo((): BudgetState | null => (state ? viewStateForMonth(state, month, cmk) : null), [state, month, cmk]);

  const periods = useMemo(() => (viewState ? paycheckPeriodsForMonth(viewState, month) : []), [viewState, month]);

  const totals = useMemo(
    () =>
      periods.reduce(
        (acc, p) => ({ income: acc.income + p.totalIncome, bills: acc.bills + p.totalBills, leftover: acc.leftover + p.leftover }),
        { income: 0, bills: 0, leftover: 0 },
      ),
    [periods],
  );

  const { lastDay, year, monthIndex } = useMemo(() => monthBounds(month), [month]);

  const today = new Date();
  const todayIsThisMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
  const todayDay = todayIsThisMonth ? today.getDate() : null;

  // The period that contains today: a period of the current month, or the previous
  // month's last period while it still overhangs into this month's first payday.
  const orderedPeriods = useMemo(() => {
    if (!viewState) return [] as { period: PaycheckPeriod; isCurrent: boolean }[];
    const day = today.getDate();
    const firstPaydayThisMonth = Math.min(
      Infinity,
      ...viewState.incomes.flatMap((inc) => incomeDatesForMonth(inc, cmk).map((d) => d.getDate())),
    );
    const isCurrent = (p: PaycheckPeriod) => {
      if (month === cmk) return p.startDay <= day && day <= p.endDay;
      if (month === shiftMonth(cmk, -1) && p.index === p.total) return day < firstPaydayThisMonth;
      return false;
    };
    return periods
      .map((period) => ({ period, isCurrent: isCurrent(period) }))
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, viewState, month, cmk, today.getDate()]);

  // Timeline events from the period data so paid status is consistent
  const events = useMemo(() => {
    if (!viewState) return [];
    const evts: { kind: string; day: number; label: string; tooltip: string }[] = [];
    viewState.incomes.forEach((inc) => {
      incomeDatesForMonth(inc, month).forEach((d) => {
        evts.push({ kind: "income", day: d.getDate(), label: moneyFmt(inc.amount), tooltip: inc.name });
      });
    });
    const billPaid = new Map<string, boolean>();
    periods.forEach((p) => p.bills.forEach((b) => billPaid.set(b.expenseId, b.paid)));
    viewState.recurringExpenses.forEach((exp) => {
      const due = recurringDueDate(exp, month);
      if (!due) return;
      const paid = billPaid.get(exp.id) ?? false;
      const amt = exp.cadence === "annual" ? annualSetAside(exp.amount) : exp.amount;
      evts.push({ kind: paid ? "paid" : "bill", day: due.getDate(), label: moneyFmt(amt), tooltip: exp.name });
    });
    return evts;
  }, [viewState, month, periods]);

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

  function refreshSnapshot() {
    setState((s) => (s ? upsertSnapshot(s, month) : s));
    setRefreshOpen(false);
  }

  function dismiss(id: HintId) {
    setState((s) => (s ? dismissHint(s, id) : s));
  }

  function addIncome(): boolean {
    const errs = sourceDraftErrors(sourceDraft);
    if (errs.name || errs.amount || errs.date) {
      setSourceAttempted(true);
      return false;
    }
    const income = incomeFromDraft(sourceDraft, errs);
    setState((s) => (s ? { ...s, incomes: [...s.incomes, income] } : s));
    setSourceDraft(emptySourceDraft());
    setSourceAttempted(false);
    return true;
  }

  function addBill(): boolean {
    const errs = billDraftErrors(billDraft);
    if (errs.name || errs.amount) {
      setBillAttempted(true);
      return false;
    }
    const expense = expenseFromDraft(billDraft, errs);
    setState((s) => (s ? { ...s, recurringExpenses: [...s.recurringExpenses, expense] } : s));
    setBillDraft(emptyBillDraft);
    setBillAttempted(false);
    return true;
  }

  function loadSample() {
    saveState(sampleData());
    window.location.reload();
  }

  if (!hydrated || !state || !viewState) {
    return (
      <section className="container" aria-busy="true">
        <div className="sheet sheet--bar month-head">
          <div className="month-head__title">
            <h1 className="month-head__label">Paycheck periods</h1>
          </div>
          <p className="muted month-head__loading">Loading…</p>
        </div>
        <div className="sheet month-summary" aria-hidden="true">
          <span className="skeleton skeleton--line" />
        </div>
        <div className="period-grid" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="sheet period-card">
              <span className="skeleton skeleton--line skeleton--stat-label" />
              <div className="skeleton-gap">
                <span className="skeleton skeleton--line skeleton--stat-value" />
              </div>
              <div className="skeleton skeleton--row" />
              <div className="skeleton skeleton--row" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const hasIncome = state.incomes.length > 0;
  const hasBills = state.recurringExpenses.length > 0;
  const showGoalsHint = hasBills && state.goals.length === 0;
  const monthLabel = formatMonthLabel(month);

  const firstRunBody = (
    <div className="period-empty">
      <p className="period-empty__text">
        Add your income and Bursar will split each month into paychecks.
      </p>
      <div>
        <button type="button" className="btn btn--lg" onClick={() => setDialog("source")}>
          Add income
        </button>
      </div>
      <div className="period-empty__links">
        <ImportLedgerButton className="text-link-btn" onStatus={setImportStatus}>Import a backup file</ImportLedgerButton>
        <button type="button" className="text-link-btn" onClick={loadSample}>Try it with sample data</button>
      </div>
      {importStatus && <p className="muted" role="status">{importStatus}</p>}
    </div>
  );

  const billsEmptyBody = (
    <div className="period-empty">
      <p className="period-empty__text">No bills yet. Add the bills this paycheck needs to cover.</p>
      <div>
        <button type="button" className="btn" onClick={() => setDialog("bill")}>
          Add bill
        </button>
      </div>
    </div>
  );

  // Quick-add row at the bottom of the Income / Bills tabs — opens the same dialog / sheet.
  const quickAdd = (kind: "source" | "bill") => (
    <div className="period-card__quick-add">
      <button type="button" className="text-link-btn" onClick={() => setDialog(kind)}>
        <IconPlus size={14} aria-hidden="true" />
        {kind === "source" ? "Add income" : "Add bill"}
      </button>
    </div>
  );

  return (
    <section className="container">
      {/* Month header */}
      <div className="sheet sheet--bar month-head">
        <div className="month-head__title">
          <h1 className="month-head__label">{monthLabel}</h1>
          {isPastMonth && lockedMonth && (
            <span className="stamp stamp--sm">Snapshot · {formatShortDate(new Date(lockedMonth.lockedAt))}</span>
          )}
        </div>
        <div className="month-head__controls">
          <button className="btn btn--ghost" type="button" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= firstMonthKey} aria-label="Previous month">‹ Prev</button>
          <button className="btn btn--ghost" type="button" onClick={() => setMonth(currentMonthKey())}>Today</button>
          <button className="btn btn--ghost" type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">Next ›</button>
          {isPastMonth && (
            <OverflowMenu
              label={`More actions for ${monthLabel}`}
              items={[{ label: "Refresh from current data", onSelect: () => setRefreshOpen(true) }]}
            />
          )}
        </div>
      </div>

      {/* Month summary */}
      <div className="sheet month-summary">
        <div className="month-summary__line">
          <span className="month-summary__caption">Month total</span>
          <span className="month-summary__equation">
          <span className="month-summary__term">
            <span className="month-summary__label">Income</span>
            <span className="month-summary__value">{moneyFmt(totals.income)}</span>
          </span>
          <span className="month-summary__op">−</span>
          <span className="month-summary__term">
            <span className="month-summary__label">Bills</span>
            <span className="month-summary__value">{moneyFmt(totals.bills)}</span>
          </span>
          <span className="month-summary__op">=</span>
          <span className="month-summary__term month-summary__term--total">
            <span className="month-summary__label">Leftover</span>
            <span className={`month-summary__value month-summary__value--total${totals.leftover < 0 ? " month-summary__value--neg" : ""}`}>
              {moneyFmt(totals.leftover)}
            </span>
          </span>
          </span>
        </div>
      </div>

      {/* Paycheck period cards — the one containing today comes first */}
      <div className="period-grid">
        {orderedPeriods.map(({ period, isCurrent }, i) => (
          <PeriodCard
            key={period.key}
            period={period}
            budgetCategories={viewState.budgetCategories}
            goals={viewState.goals}
            hasIncome={hasIncome}
            hasBills={hasBills}
            isCurrent={isCurrent}
            onTogglePaid={togglePaid}
            onToggleGoalPeriod={toggleGoalPeriod}
            body={!hasIncome && i === 0 ? firstRunBody : undefined}
            billsEmptyState={hasIncome && !hasBills ? billsEmptyBody : undefined}
            incomeAddon={hasIncome ? quickAdd("source") : undefined}
            billsAddon={hasBills ? quickAdd("bill") : undefined}
            hint={i === 0 && showGoalsHint ? <Hint id="overview-goals" hints={state.meta.hints} onDismiss={dismiss} /> : undefined}
          />
        ))}
      </div>

      {/* Cash-flow timeline — open on desktop, collapsed on mobile */}
      <details className="sheet timeline-details" open={!isMobile}>
        <summary className="timeline-details__summary">
          <span className="timeline-details__heading">
            <span className="kicker">Cash-flow timeline</span>
            <span className="timeline-details__title">{monthLabel}</span>
          </span>
          <IconChevronDown className="timeline-details__chevron" size={18} aria-hidden="true" />
        </summary>
        <div className="timeline-details__body">
          <div className="timeline__legend timeline__legend--inline">
            <span><span className="timeline__legend-dot timeline__legend-dot--income" />Income</span>
            <span><span className="timeline__legend-dot timeline__legend-dot--bill" />Bill due</span>
            <span><span className="timeline__legend-dot timeline__legend-dot--paid" />Paid</span>
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
      </details>

      <ConfirmDialog
        open={refreshOpen}
        title={`Refresh ${monthLabel} from current data?`}
        body={`This replaces ${monthLabel}’s saved income, bills, and budget with your current ones. Paid marks and goal contributions are not affected.`}
        confirmLabel="Refresh"
        cancelLabel="Keep snapshot"
        onConfirm={refreshSnapshot}
        onCancel={() => setRefreshOpen(false)}
      />

      {/* Add income / add bill — centered dialog on desktop, bottom sheet on mobile; closes only on a successful add */}
      <FormDialog open={dialog === "source"} title="Add income" onClose={() => setDialog(null)}>
        <AddSourceForm
          inSheet
          draft={sourceDraft}
          setDraft={setSourceDraft}
          onAdd={() => { if (addIncome()) setDialog(null); }}
          attempted={sourceAttempted}
        />
      </FormDialog>
      <FormDialog open={dialog === "bill"} title="Add bill" onClose={() => setDialog(null)}>
        <AddBillForm
          inSheet
          combinedDue
          draft={billDraft}
          setDraft={setBillDraft}
          onAdd={() => { if (addBill()) setDialog(null); }}
          attempted={billAttempted}
        />
      </FormDialog>
    </section>
  );
}
