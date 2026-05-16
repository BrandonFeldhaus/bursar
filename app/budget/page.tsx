"use client";

import { useEffect, useMemo, useState } from "react";
import { loadState, newId, saveState, type BudgetCategory, type BudgetState } from "../lib/storage";
import { useHydrated } from "../lib/useHydrated";
import { isBudgetOverdrawn } from "../lib/allocations";
import { monthlyIncomeOf } from "../lib/month";
import { moneyFmt } from "../lib/currency";
import { SavedIndicator, useSavedIndicator } from "../components/SavedIndicator";
import { UndoToast, type UndoEntry } from "../components/UndoToast";

function AllocationRing({
  segments,
  total,
  label,
  sublabel,
}: {
  segments: { name: string; color: string; value: number }[];
  total: number;
  label?: string;
  sublabel?: string;
}) {
  const size = 200;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-sunk)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const frac = total > 0 ? s.value / total : 0;
          const dash = circ * frac;
          const offset = circ * acc;
          acc += frac;
          return (
            <circle
              key={i}
              cx={c} cy={c} r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              style={{ transition: "stroke-dasharray 300ms" }}
            />
          );
        })}
      </svg>
      {(label || sublabel) && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div>
            {label && (
              <div style={{ fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 1, color: "var(--ink-1)" }}>
                {label}
              </div>
            )}
            {sublabel && (
              <div style={{ fontFamily: "var(--font-stamp)", fontSize: 9, letterSpacing: "0.18em", color: "var(--ink-3)", marginTop: 4, textTransform: "uppercase" }}>
                {sublabel}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const COLORS = ["#2b2a26", "#5b5852", "#8a877e", "#b6301f", "#2f6a4a", "#a0522d", "#8b6f47"];

export default function BudgetPage() {
  const hydrated = useHydrated();
  const [state, setState] = useState<BudgetState | null>(null);
  const [draft, setDraft] = useState<Omit<BudgetCategory, "id">>({ name: "", mode: "percent", value: 0 });
  const [attempted, setAttempted] = useState(false);
  const savedIndicator = useSavedIndicator();
  const [undo, setUndo] = useState<UndoEntry | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    setState(loadState());
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !state) return;
    saveState(state);
  }, [hydrated, state]);

  function update(id: string, patch: Partial<BudgetCategory>) {
    setState((s) => s ? { ...s, budgetCategories: s.budgetCategories.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : s);
    savedIndicator.flash();
  }

  function remove(id: string) {
    setState((s) => {
      if (!s) return s;
      const index = s.budgetCategories.findIndex((c) => c.id === id);
      const target = s.budgetCategories[index];
      if (!target) return s;
      setUndo({
        id,
        message: `Deleted ${target.name || "category"}`,
        onUndo: () => {
          setState((cur) => {
            if (!cur) return cur;
            const restored = [...cur.budgetCategories];
            restored.splice(index, 0, target);
            return { ...cur, budgetCategories: restored };
          });
          savedIndicator.flash();
        },
      });
      return { ...s, budgetCategories: s.budgetCategories.filter((c) => c.id !== id) };
    });
  }

  function add() {
    const name = draft.name.trim();
    const value = Math.max(0, Number(draft.value) || 0);
    if (!name || value === 0) {
      setAttempted(true);
      return;
    }
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        budgetCategories: [...s.budgetCategories, { id: newId(), name, mode: draft.mode, value }],
      };
    });
    setDraft({ name: "", mode: "percent", value: 0 });
    setAttempted(false);
    savedIndicator.flash();
  }

  const derived = useMemo(() => {
    if (!state) return { monthlyIncome: 0, percentTotal: 0, fixedTotal: 0, overdrawn: false, segments: [] };
    const cats = state.budgetCategories;
    const monthlyIncome = monthlyIncomeOf(state);
    const percentTotal = cats.filter((c) => c.mode === "percent").reduce((s, c) => s + c.value, 0);
    const fixedTotal = cats.filter((c) => c.mode === "fixed").reduce((s, c) => s + c.value, 0);
    const overdrawn = isBudgetOverdrawn(percentTotal, fixedTotal, monthlyIncome);
    // Ring: fixed items claim their fraction of income; percent items split the remaining fraction.
    const fixedFrac = monthlyIncome > 0 ? Math.min(fixedTotal / monthlyIncome, 1) : 0;
    const remainderFrac = 1 - fixedFrac;
    const segments = cats.map((c, i) => ({
      name: c.name,
      color: COLORS[i % COLORS.length],
      value: c.mode === "fixed"
        ? fixedFrac * 100 * (monthlyIncome > 0 ? c.value / fixedTotal || 0 : 0)
        : (c.value / 100) * remainderFrac * 100,
      raw: c,
    }));
    return { monthlyIncome, percentTotal, fixedTotal, overdrawn, segments };
  }, [state]);

  if (!hydrated || !state) {
    return (
      <section className="container" aria-busy="true">
        <header className="sheet page-head">
          <p className="kicker">Budget</p>
          <h1 className="page-head__title">Allocation plan</h1>
          <p className="page-head__lead">Loading budget categories…</p>
        </header>
        <div className="sheet" style={{ padding: "20px 28px" }} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton--row" />
          ))}
        </div>
      </section>
    );
  }

  const { monthlyIncome, percentTotal, fixedTotal, overdrawn, segments } = derived;
  const cats = state.budgetCategories;

  return (
    <section className="container">
      {/* Page head */}
      <header className="sheet page-head">
        <p className="kicker">Budget</p>
        <h1 className="page-head__title">Allocation plan</h1>
        <p className="page-head__lead">Decide how each paycheck's leftover gets divided. Fixed amounts are reserved first; percentages split whatever remains.</p>
      </header>

      {/* Stats row */}
      <div className="stat-row">
        <article className="sheet stat" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Percent planned</div>
          <div className="stat__value">{percentTotal.toFixed(0)}%</div>
        </article>
        <article className="sheet stat" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Fixed planned</div>
          <div className="stat__value">{moneyFmt(fixedTotal)}</div>
        </article>
        <article className="sheet stat stat--accent" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Status</div>
          <div className={`stat__value${overdrawn ? " stat__value--neg" : ""}`}>
            {overdrawn ? "Overdrawn" : "In balance"}
          </div>
        </article>
      </div>

      {/* Allocation ring */}
      <div className="sheet" style={{ padding: "24px 28px" }}>
        <div className="ring-wrap">
          <AllocationRing
            segments={segments}
            total={100}
            label={`${percentTotal.toFixed(0)}%`}
            sublabel="of remainder"
          />
          <div>
            <p className="kicker">Distribution</p>
            <h2 className="section-title mb-3">Where each dollar goes</h2>
            <div className="allocation-list">
              {segments.map((s, i) => (
                <div key={i} className="allocation-row">
                  <div className="allocation-label">
                    <span style={{ width: 12, height: 12, borderRadius: 2, background: s.color, flexShrink: 0, display: "inline-block" }} />
                    <span className="allocation-name">{s.name}</span>
                  </div>
                  <div className="allocation-bar">
                    <div
                      className={`allocation-bar__fill${s.value > 100 ? " allocation-bar__fill--over" : ""}`}
                      style={{ width: `${Math.min(100, s.value)}%`, background: s.color }}
                    />
                  </div>
                  <span className="allocation-amount">
                    {s.raw.mode === "percent" ? `${s.raw.value}%` : moneyFmt(s.raw.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Budget entries table */}
      <div className="sheet" style={{ paddingTop: "20px", paddingBottom: 0 }}>
        <div style={{ padding: "0 28px" }} className="row-between mb-3">
          <div>
            <p className="kicker">Categories</p>
            <h2 className="section-title">Budget entries</h2>
          </div>
          <span className={`badge${overdrawn ? " badge--red" : ""}`}>{percentTotal.toFixed(0)}% of remainder</span>
        </div>

        <div className="ledger-table-wrap-no-line" style={{ borderRadius: "0 0 0 0" }}>
          <table className="ledger-table ledger-table--responsive">
            <thead>
              <tr>
                <th style={{ width: "50%" }}>Category</th>
                <th style={{ width: "22%" }}>Type</th>
                <th className="text-right" style={{ width: "22%" }}>Value</th>
                <th className="text-tight" />
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Category">
                      <input className="input" value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} />
                    </td>
                    <td data-label="Type">
                      <select
                        className="select"
                        value={c.mode}
                        onChange={(e) => update(c.id, { mode: e.target.value as "percent" | "fixed" })}
                      >
                        <option value="percent">Percent</option>
                        <option value="fixed">Fixed $</option>
                      </select>
                    </td>
                    <td className="text-right mono" data-label="Value">
                      <input
                        className="input input--mono"
                        type="text"
                        inputMode="decimal"
                        value={c.value}
                        onChange={(e) =>
                          update(c.id, { value: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) })
                        }
                        pattern="[0-9.]*"
                      />
                    </td>
                    <td className="text-tight">
                      <button className="btn btn--icon" type="button" onClick={() => remove(c.id)} aria-label={`Delete ${c.name}`}>
                        ×
                      </button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inline add form */}
        <div className="inline-form">
          <div className="field">
            <label className="field__label">New category</label>
            <input
              className="input"
              placeholder="e.g. Travel fund"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
            {attempted && !draft.name.trim() && <p className="field__error">Required</p>}
          </div>
          <div className="field">
            <label className="field__label">Type</label>
            <select
              className="select"
              value={draft.mode}
              onChange={(e) => setDraft((d) => ({ ...d, mode: e.target.value as "percent" | "fixed" }))}
            >
              <option value="percent">Percent</option>
              <option value="fixed">Fixed $</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label">Value</label>
            <input
              className="input input--mono"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={draft.value || ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, value: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) }))
              }
              pattern="[0-9.]*"
            />
            {attempted && (Math.max(0, Number(draft.value) || 0) === 0) && <p className="field__error">Must be more than 0</p>}
          </div>
          <button className="btn" type="button" onClick={add}>
            Add
          </button>
        </div>
      </div>

      {/* SavedIndicator and UndoToast */}
      <SavedIndicator visible={savedIndicator.visible} />
      <UndoToast entry={undo} onDismiss={() => setUndo(null)} />
    </section>
  );
}
