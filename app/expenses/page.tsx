"use client";

import { useEffect, useMemo, useState } from "react";
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

function moneyFmt(value: number) {
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  return `${v < 0 ? "−" : ""}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function moneyShort(value: number) {
  const v = Math.abs(Number(value) || 0);
  if (v >= 10000) return `$${Math.round(v / 1000)}k`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return moneyFmt(v);
}

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

export default function ExpensesPage() {
  const hydrated = useHydrated();
  const [state, setState] = useState<BudgetState | null>(null);
  const [month, setMonth] = useState(currentMonthKey());
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [draft, setDraft] = useState({ name: "", amount: 0, cadence: "monthly" as "monthly" | "annual", dueDay: 1, dueMonth: 1 });

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
  }

  function remove(id: string) {
    setState((s) => s ? { ...s, recurringExpenses: s.recurringExpenses.filter((e) => e.id !== id) } : s);
  }

  function add() {
    const name = draft.name.trim();
    if (!name) return;
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        recurringExpenses: [
          ...s.recurringExpenses,
          { ...draft, id: newId(), name, amount: Math.max(0, Number(draft.amount) || 0), paidPeriods: [] },
        ],
      };
    });
    setDraft({ name: "", amount: 0, cadence: "monthly", dueDay: 1, dueMonth: 1 });
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
      <section className="container">
        <header className="sheet sheet--ledger page-head">
          <p className="kicker">Expenses</p>
          <h1 className="page-head__title">Bill notations</h1>
          <p className="page-head__lead">Loading the ruled bill register…</p>
        </header>
      </section>
    );
  }

  const balanced = totals.monthlyIncome >= totals.totalMonthly;

  return (
    <section className="container">
      {/* Page head */}
      <header className="sheet sheet--ledger page-head">
        <p className="kicker">Expenses</p>
        <h1 className="page-head__title">Bill notations</h1>
        <p className="page-head__lead">Track each recurring notation. Annual costs are spread across the year automatically.</p>
        <div className="page-head__meta">
          <div className="page-head__meta-item">
            <span className="page-head__meta-label">Monthly bills</span>
            <span className="page-head__meta-value">{moneyFmt(totals.monthlyBills)}</span>
          </div>
          <div className="page-head__meta-item">
            <span className="page-head__meta-label">Annual set-aside</span>
            <span className="page-head__meta-value">{moneyFmt(totals.annualSetAside)}</span>
          </div>
          <div className="page-head__meta-item">
            <span className="page-head__meta-label">Total / mo</span>
            <span className="page-head__meta-value">{moneyFmt(totals.totalMonthly)}</span>
          </div>
        </div>
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
          <BillsCalendar state={state} month={month} />
        </div>
      )}

      {/* Bill register table */}
      <div className="sheet" style={{ paddingTop: "20px", paddingBottom: 0 }}>
        <div style={{ padding: "0 28px" }} className="row-between mb-3">
          <div>
            <p className="kicker">Recurring entries</p>
            <h2 className="section-title">Bill register</h2>
          </div>
          {balanced && <span className="stamp stamp--audited">Balanced</span>}
        </div>

        <div className="ledger-table-wrap" style={{ borderRadius: "10px 10px 0 0" }}>
          <table className="ledger-table">
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
                  <td>
                    <input className="input" value={exp.name} onChange={(e) => update(exp.id, { name: e.target.value })} />
                  </td>
                  <td className="text-right mono">
                    <input
                      className="input input--mono"
                      type="text"
                      inputMode="decimal"
                      value={exp.amount}
                      style={{ textAlign: "right" }}
                      onChange={(e) =>
                        update(exp.id, { amount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) })
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="select"
                      value={exp.cadence}
                      onChange={(e) => update(exp.id, { cadence: e.target.value as "monthly" | "annual" })}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="input input--mono"
                      type="number"
                      min={1}
                      max={31}
                      value={exp.dueDay ?? 1}
                      onChange={(e) => update(exp.id, { dueDay: Math.max(1, Math.min(31, Number(e.target.value))) })}
                    />
                  </td>
                  <td>
                    {exp.cadence === "annual" ? (
                      <select
                        className="select"
                        value={exp.dueMonth ?? 1}
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
                    <button className="btn btn--icon" type="button" onClick={() => remove(exp.id)} aria-label={`Delete ${exp.name}`}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inline add form */}
        <div className={`inline-form${draft.cadence === "annual" ? " inline-form--5col" : " inline-form--4col"}`}>
          <div className="field">
            <label className="field__label">New notation</label>
            <input
              className="input"
              placeholder="e.g. Internet"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="field__label">Amount</label>
            <input
              className="input input--mono"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={draft.amount || ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, amount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) }))
              }
            />
          </div>
          <div className="field">
            <label className="field__label">Cadence</label>
            <select
              className="select"
              value={draft.cadence}
              onChange={(e) => setDraft((d) => ({ ...d, cadence: e.target.value as "monthly" | "annual" }))}
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label">Due day</label>
            <input
              className="input input--mono"
              type="number"
              min={1}
              max={31}
              value={draft.dueDay}
              onChange={(e) => setDraft((d) => ({ ...d, dueDay: Math.max(1, Math.min(31, Number(e.target.value))) }))}
            />
          </div>
          {draft.cadence === "annual" && (
            <div className="field">
              <label className="field__label">Month</label>
              <select
                className="select"
                value={draft.dueMonth}
                onChange={(e) => setDraft((d) => ({ ...d, dueMonth: Number(e.target.value) }))}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2026, i, 1).toLocaleDateString("en-US", { month: "short" })}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button className="btn" type="button" onClick={add} disabled={!draft.name.trim()}>
            Add
          </button>
        </div>
      </div>
    </section>
  );
}
