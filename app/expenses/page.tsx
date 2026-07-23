"use client";

import { useEffect, useMemo, useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { loadState, newId, saveState, type BudgetState, type RecurringExpense } from "../lib/storage";
import { useHydrated } from "../lib/useHydrated";
import {
  currentMonthKey,
  formatMonthLabel,
  incomeDatesForMonth,
  monthBounds,
  monthlyIncomeOf,
  recurringDueDate,
  annualSetAside,
  shiftMonth,
} from "../lib/month";
import { UndoToast, type UndoEntry } from "../components/UndoToast";
import { SavedIndicator, useSavedIndicator } from "../components/SavedIndicator";
import { AddBillForm, billDraftErrors, emptyBillDraft, type BillFormDraft } from "../components/AddBillForm";
import { BottomSheet } from "../components/BottomSheet";
import { moneyFmt, moneyShort } from "../lib/currency";
import { jumpToAddForm } from "../lib/jumpToAddForm";
import { useIsMobile } from "../lib/useIsMobile";

function BillsCalendar({ state, month }: { state: BudgetState; month: string }) {
  const { year, monthIndex, lastDay } = monthBounds(month);
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const today = new Date();
  const todayDay = today.getFullYear() === year && today.getMonth() === monthIndex ? today.getDate() : null;

  const byDay: Record<number, { kind: string; name: string; amount: number; paid?: boolean; overdue?: boolean }[]> = {};
  for (let d = 1; d <= lastDay; d++) byDay[d] = [];

  state.incomes.forEach((inc) => {
    incomeDatesForMonth(inc, month).forEach((date) => {
      byDay[date.getDate()].push({ kind: "income", name: inc.name, amount: inc.amount });
    });
  });

  state.recurringExpenses.forEach((exp) => {
    const due = recurringDueDate(exp, month);
    if (!due) return;
    const periodId = `${month}-${due.getDate() <= 15 ? "first" : "second"}`;
    const paid = (exp.paidPeriods ?? []).includes(periodId);
    const overdue = !paid && todayDay !== null && due.getDate() < todayDay;
    const amount = exp.cadence === "annual" ? annualSetAside(exp.amount) : exp.amount;
    byDay[due.getDate()].push({ kind: "bill", name: exp.name, amount, paid, overdue });
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="calendar">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
        <div key={d} className="calendar__head">{d}</div>
      ))}
      {cells.map((d, i) => {
        if (d === null) return <div key={i} className="calendar__day calendar__day--out" />;
        const entries = byDay[d] ?? [];
        return (
          <div key={i} className={`calendar__day${todayDay === d ? " calendar__day--today" : ""}`}>
            <span className="calendar__num">{d}</span>
            <div className="calendar__entries">
              {entries.slice(0, 3).map((e, j) => (
                <div
                  key={j}
                  className={[
                    "calendar__entry",
                    e.kind === "income" ? "calendar__entry--income" : "",
                    e.paid ? "calendar__entry--paid" : "",
                    e.overdue ? "calendar__entry--overdue" : "",
                  ].filter(Boolean).join(" ")}
                  title={`${e.name} · ${moneyFmt(e.amount)}`}
                >
                  {e.kind === "income" ? `+${moneyShort(e.amount)}` : e.name}
                </div>
              ))}
              {entries.length > 3 && <div className="calendar__entry">+{entries.length - 3} more</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BillsAgenda({ state, month }: { state: BudgetState; month: string }) {
  const { year, monthIndex, lastDay } = monthBounds(month);
  const today = new Date();
  const todayDay = today.getFullYear() === year && today.getMonth() === monthIndex ? today.getDate() : null;

  const byDay: Record<number, { kind: "income" | "bill"; name: string; amount: number; paid?: boolean; overdue?: boolean }[]> = {};

  state.incomes.forEach((inc) => {
    incomeDatesForMonth(inc, month).forEach((date) => {
      const d = date.getDate();
      (byDay[d] ||= []).push({ kind: "income", name: inc.name, amount: inc.amount });
    });
  });

  state.recurringExpenses.forEach((exp) => {
    const due = recurringDueDate(exp, month);
    if (!due) return;
    const periodId = `${month}-${due.getDate() <= 15 ? "first" : "second"}`;
    const paid = (exp.paidPeriods ?? []).includes(periodId);
    const overdue = !paid && todayDay !== null && due.getDate() < todayDay;
    const amount = exp.cadence === "annual" ? annualSetAside(exp.amount) : exp.amount;
    (byDay[due.getDate()] ||= []).push({ kind: "bill", name: exp.name, amount, paid, overdue });
  });

  const days = Object.keys(byDay)
    .map((d) => parseInt(d, 10))
    .filter((d) => d >= 1 && d <= lastDay)
    .sort((a, b) => a - b);

  if (days.length === 0) {
    return <p className="agenda-empty">No income or bills scheduled this month.</p>;
  }

  return (
    <div className="agenda-list">
      {days.map((d) => {
        const date = new Date(year, monthIndex, d);
        const wk = date.toLocaleDateString("en-US", { weekday: "short" });
        return (
          <div key={d} className={`agenda-day${todayDay === d ? " agenda-day--today" : ""}`}>
            <div className="agenda-day__date">
              <span className="agenda-day__num">{d}</span>
              <span>{wk}</span>
            </div>
            <div className="agenda-day__entries">
              {byDay[d].map((e, i) => (
                <div
                  key={i}
                  className={[
                    "agenda-entry",
                    e.kind === "income" ? "agenda-entry--income" : "",
                    e.paid ? "agenda-entry--paid" : "",
                    e.overdue ? "agenda-entry--overdue" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <span className="agenda-entry__name">{e.name}</span>
                  <span className="agenda-entry__amount">
                    {e.kind === "income" ? `+${moneyFmt(e.amount)}` : moneyFmt(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ExpensesPage() {
  const hydrated = useHydrated();
  const isMobile = useIsMobile();
  const [state, setState] = useState<BudgetState | null>(null);
  const [month, setMonth] = useState(currentMonthKey());
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [draft, setDraft] = useState<BillFormDraft>(emptyBillDraft);
  const [addOpen, setAddOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [undo, setUndo] = useState<UndoEntry | null>(null);
  const saved = useSavedIndicator();

  useEffect(() => {
    if (!hydrated) return;
    setState(loadState());
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !state) return;
    saveState(state);
  }, [hydrated, state]);

  function update(id: string, patch: Partial<RecurringExpense>) {
    setState((s) => s ? { ...s, recurringExpenses: s.recurringExpenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : s);
    saved.flash();
  }

  function remove(id: string) {
    setState((s) => {
      if (!s) return s;
      const index = s.recurringExpenses.findIndex((e) => e.id === id);
      const target = s.recurringExpenses[index];
      if (!target) return s;
      const next = { ...s, recurringExpenses: s.recurringExpenses.filter((e) => e.id !== id) };
      setUndo({
        id,
        message: `Deleted ${target.name || "bill"}`,
        onUndo: () => {
          setState((cur) => {
            if (!cur) return cur;
            const restored = [...cur.recurringExpenses];
            restored.splice(index, 0, target);
            return { ...cur, recurringExpenses: restored };
          });
          saved.flash();
        },
      });
      return next;
    });
  }

  function add(): boolean {
    const errs = billDraftErrors(draft);
    if (errs.name || errs.amount) {
      setAttempted(true);
      return false;
    }
    const name = draft.name.trim();
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        recurringExpenses: [
          ...s.recurringExpenses,
          {
            id: newId(),
            name,
            amount: Math.max(0, errs.parsedAmount),
            cadence: draft.cadence,
            dueDay: draft.dueDay,
            dueMonth: draft.dueMonth,
            paidPeriods: [],
          },
        ],
      };
    });
    setDraft(emptyBillDraft);
    setAttempted(false);
    saved.flash();
    return true;
  }

  const totals = useMemo(() => {
    if (!state) return { monthlyBills: 0, annualSetAside: 0, totalMonthly: 0, monthlyIncome: 0 };
    const monthlyBills = state.recurringExpenses.filter((e) => e.cadence === "monthly").reduce((s, e) => s + e.amount, 0);
    const annualSA = state.recurringExpenses.filter((e) => e.cadence === "annual").reduce((s, e) => s + annualSetAside(e.amount), 0);
    return {
      monthlyBills,
      annualSetAside: annualSA,
      totalMonthly: monthlyBills + annualSA,
      monthlyIncome: monthlyIncomeOf(state),
    };
  }, [state]);

  if (!hydrated || !state) {
    return (
      <section className="container" aria-busy="true">
        <header className="sheet page-head">
          <p className="kicker">Expenses</p>
          <h1 className="page-head__title">Bill notations</h1>
          <p className="page-head__lead">Loading your bill register…</p>
        </header>
        <div className="sheet" style={{ padding: "20px 28px" }} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton--row" />
          ))}
        </div>
      </section>
    );
  }

  const balanced = totals.monthlyIncome >= totals.totalMonthly;

  return (
    <section className="container">
      {/* Page head */}
      <header className="sheet page-head">
        <p className="kicker">Expenses</p>
        <h1 className="page-head__title">Bill notations</h1>
        <p className="page-head__lead">Log your recurring bills here. Annual expenses are divided across 12 months so every period shares the cost evenly.</p>
      </header>

      {/* Stats row */}
      <div className="stat-row">
        <article className="sheet stat stat--accent" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Monthly obligations</div>
          <div className="stat__value">{moneyFmt(totals.totalMonthly)}</div>
        </article>
        <article className="sheet stat" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Monthly income</div>
          <div className="stat__value">{moneyFmt(totals.monthlyIncome)}</div>
        </article>
        <article className="sheet stat" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">{balanced ? "Cushion" : "Shortfall"}</div>
          <div className={`stat__value${!balanced ? " stat__value--neg" : ""}`}>
            {moneyFmt(Math.abs(totals.monthlyIncome - totals.totalMonthly))}
          </div>
          <div className="stat__sub">
            {balanced ? "Income covers obligations." : "Income does not cover obligations."}
          </div>
        </article>
      </div>

      {/* View toggle + month nav */}
      <div className="sheet" style={{ padding: "14px 22px" }}>
        <div className="row-between">
          <div className="row gap-sm">
            <p className="kicker" style={{ margin: 0 }}>View</p>
            <div className="segment" role="radiogroup">
              {(["calendar", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  className={`segment__btn${view === v ? " segment__btn--active" : ""}`}
                  onClick={() => setView(v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="row gap-sm">
            <button className="btn btn--ghost" type="button" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink-1)" }}>
              {formatMonthLabel(month)}
            </span>
            <button className="btn btn--ghost" type="button" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          </div>
        </div>
      </div>

      {/* Calendar view */}
      {view === "calendar" && (
        <div className="sheet" style={{ padding: "20px 24px" }}>
          <p className="kicker">{formatMonthLabel(month)}</p>
          <h2 className="section-title mb-3">Bills due calendar</h2>
          <div className="calendar-desktop">
            <BillsCalendar state={state} month={month} />
          </div>
          <div className="calendar-agenda">
            <BillsAgenda state={state} month={month} />
          </div>
        </div>
      )}

      {/* Bill register table */}
      <div className="sheet" style={{ paddingTop: "20px", paddingBottom: 0 }}>
        <div style={{ padding: "0 28px" }} className="row-between mb-3">
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p className="kicker">Recurring entries</p>
              <h2 className="section-title">Bill register</h2>
            </div>
            <SavedIndicator visible={saved.visible} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="btn mobile-only-inline btn--jump"
              onClick={() => (isMobile ? setAddOpen(true) : jumpToAddForm())}
            >
              <IconPlus size={12} aria-hidden="true" />Add bill
            </button>
            {balanced && <span className="stamp stamp--audited mobile-hidden">Balanced</span>}
          </div>
        </div>

        <div className="ledger-table-wrap-no-line" style={{ borderRadius: "0 0 0 0" }}>
          <table className="ledger-table ledger-table--responsive">
            <thead>
              <tr>
                <th style={{ width: "28%" }}>Notation</th>
                <th className="text-right" style={{ width: "16%" }}>Amount</th>
                <th style={{ width: "16%" }}>Cadence</th>
                <th style={{ width: "16%" }}>Due day</th>
                <th style={{ width: "16%" }}>Annual month</th>
                <th className="text-tight" />
              </tr>
            </thead>
            <tbody>
              {state.recurringExpenses.map((exp) => (
                <tr key={exp.id}>
                  <td data-label="Notation">
                    <input className="input" value={exp.name} onChange={(e) => update(exp.id, { name: e.target.value })} aria-label="Bill name" />
                  </td>
                  <td className="text-right mono" data-label="Amount">
                    <input
                      className="input input--mono"
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9.]*"
                      value={exp.amount}
                      aria-label="Bill amount"
                      onChange={(e) =>
                        update(exp.id, { amount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) })
                      }
                    />
                  </td>
                  <td data-label="Cadence">
                    <select
                      className="select"
                      value={exp.cadence}
                      aria-label="Cadence"
                      onChange={(e) => update(exp.id, { cadence: e.target.value as "monthly" | "annual" })}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </td>
                  <td data-label="Due day">
                    <input
                      className="input input--mono"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="1"
                      value={exp.dueDay || ""}
                      aria-label="Due day"
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
                        const n = digits === "" ? 0 : Math.min(31, Number(digits));
                        update(exp.id, { dueDay: n });
                      }}
                      onBlur={() => { if (!exp.dueDay || exp.dueDay < 1) update(exp.id, { dueDay: 1 }); }}
                    />
                  </td>
                  <td data-label="Annual month">
                    {exp.cadence === "annual" ? (
                      <select
                        className="select"
                        value={exp.dueMonth ?? 1}
                        aria-label="Annual month"
                        onChange={(e) => update(exp.id, { dueMonth: Number(e.target.value) })}
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {new Date(2026, i, 1).toLocaleDateString("en-US", { month: "short" })}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="text-tight">
                    <button className="btn btn--icon" type="button" onClick={() => remove(exp.id)} aria-label={`Delete ${exp.name || "bill"}`}>
                      <IconX size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inline add form (desktop) */}
        {!isMobile && (
          <AddBillForm formId="add-form" draft={draft} setDraft={setDraft} onAdd={add} attempted={attempted} />
        )}
      </div>

      {/* Mobile add sheet */}
      {isMobile && addOpen && (
        <BottomSheet open title="Add bill" onClose={() => setAddOpen(false)}>
          <AddBillForm
            inSheet
            draft={draft}
            setDraft={setDraft}
            onAdd={() => { if (add()) setAddOpen(false); }}
            attempted={attempted}
          />
        </BottomSheet>
      )}
      <UndoToast entry={undo} onDismiss={() => setUndo(null)} />
    </section>
  );
}
