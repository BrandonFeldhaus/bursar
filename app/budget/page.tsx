"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { loadState, newId, saveState, type BudgetCategory, type BudgetState } from "../lib/storage";
import { useHydrated } from "../lib/useHydrated";
import { isBudgetOverdrawn } from "../lib/allocations";
import { monthlyIncomeOf } from "../lib/month";
import { moneyFmt } from "../lib/currency";
import { SavedIndicator, useSavedIndicator } from "../components/SavedIndicator";
import { UndoToast, type UndoEntry } from "../components/UndoToast";
import { AddCategoryForm, emptyCategoryDraft, type CategoryFormDraft } from "../components/AddCategoryForm";
import { FormDialog } from "../components/FormDialog";
import { Hint, dismissHint, type HintId } from "../components/Hint";
import { advanceOnEnter } from "../components/Form";

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
    <div className="ring">
      <svg className="ring__svg" width={size} height={size}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-sunk)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const frac = total > 0 ? s.value / total : 0;
          const dash = circ * frac;
          const offset = circ * acc;
          acc += frac;
          return (
            <circle
              key={i}
              className="ring__segment"
              cx={c} cy={c} r={r}
              fill="none"
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              style={{ "--swatch": s.color } as CSSProperties}
            />
          );
        })}
      </svg>
      {(label || sublabel) && (
        <div className="ring__center">
          <div>
            {label && (
              <div className="ring__label">
                {label}
              </div>
            )}
            {sublabel && (
              <div className="ring__sublabel">
                {sublabel}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const COLORS = Array.from({ length: 7 }, (_, i) => `var(--chart-${i + 1})`);

export default function BudgetPage() {
  const hydrated = useHydrated();
  const [state, setState] = useState<BudgetState | null>(null);
  const [draft, setDraft] = useState<CategoryFormDraft>(emptyCategoryDraft);
  const [addOpen, setAddOpen] = useState(false);
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

  function dismiss(id: HintId) {
    setState((s) => (s ? dismissHint(s, id) : s));
  }

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

  function add(): boolean {
    const name = draft.name.trim();
    const value = Math.max(0, Number(draft.value) || 0);
    if (!name || value === 0) {
      setAttempted(true);
      return false;
    }
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        budgetCategories: [...s.budgetCategories, { id: newId(), name, mode: draft.mode, value }],
      };
    });
    setDraft(emptyCategoryDraft);
    setAttempted(false);
    savedIndicator.flash();
    return true;
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
          <h1 className="page-head__title">Budget</h1>
          <p className="page-head__lead">Loading budget…</p>
        </header>
        <div className="sheet skeleton-card" aria-hidden="true">
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
        <h1 className="page-head__title">Budget</h1>
        <p className="page-head__lead">Decide how each paycheck's leftover gets divided. Fixed amounts are reserved first; percentages split whatever remains.</p>
      </header>

      <Hint id="budget" hints={state.meta.hints} onDismiss={dismiss} />

      {/* Stats row */}
      <div className="stat-row">
        <article className="sheet stat sheet--stat">
          <div className="stat__label">Percent planned</div>
          <div className="stat__value">{percentTotal.toFixed(0)}%</div>
        </article>
        <article className="sheet stat sheet--stat">
          <div className="stat__label">Fixed planned</div>
          <div className="stat__value">{moneyFmt(fixedTotal)}</div>
        </article>
        <article className="sheet stat stat--accent sheet--stat">
          <div className="stat__label">Status</div>
          <div className={`stat__value${overdrawn ? " stat__value--neg" : ""}`}>
            {overdrawn ? "Overdrawn" : "In balance"}
          </div>
        </article>
      </div>

      {/* Allocation ring */}
      <div className="sheet ring-card">
        <div className="ring-wrap">
          <AllocationRing
            segments={segments}
            total={100}
            label={`${percentTotal.toFixed(0)}%`}
            sublabel="of remainder"
          />
          <div>
            <h2 className="section-title mb-3">Where each dollar goes</h2>
            <div className="allocation-list">
              {segments.map((s, i) => (
                <div key={i} className="allocation-row">
                  <div className="allocation-label">
                    <span className="allocation-swatch" style={{ "--swatch": s.color } as CSSProperties} />
                    <span className="allocation-name">{s.name}</span>
                  </div>
                  <div className="allocation-bar">
                    <div
                      className={`allocation-bar__fill allocation-bar__fill--swatch${s.value > 100 ? " allocation-bar__fill--over" : ""}`}
                      style={{ "--pct": `${Math.min(100, s.value)}%`, "--swatch": s.color } as CSSProperties}
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

      {/* Categories table */}
      <div className="sheet table-card">
        <div className="table-card__head row-between mb-3">
          <div className="table-card__title">
            <h2 className="section-title">Categories</h2>
            <SavedIndicator visible={savedIndicator.visible} />
          </div>
          <div className="table-card__actions">
            <button type="button" className="btn btn--add" onClick={() => setAddOpen(true)}>
              <IconPlus size={14} aria-hidden="true" />Add category
            </button>
            {cats.length > 0 && (
              <span className={`badge mobile-hidden${overdrawn ? " badge--red" : ""}`}>{percentTotal.toFixed(0)}% of remainder</span>
            )}
          </div>
        </div>

        {cats.length === 0 ? (
          <div className="table-empty">
            <p className="table-empty__text">No categories yet.</p>
            <button type="button" className="btn" onClick={() => setAddOpen(true)}>Add your first category</button>
          </div>
        ) : (
        <div className="ledger-table-wrap-no-line ledger-table-wrap--flush">
          <table className="ledger-table ledger-table--responsive ledger-table--budget">
            <thead>
              <tr>
                <th>Category</th>
                <th>Type</th>
                <th className="text-right">Value</th>
                <th className="text-tight" />
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                  <tr key={c.id} onKeyDown={advanceOnEnter}>
                    <td data-label="Category">
                      <input className="input" value={c.name} enterKeyHint="next" aria-label="Category name" onChange={(e) => update(c.id, { name: e.target.value })} />
                    </td>
                    <td data-label="Type">
                      <select
                        className="select"
                        value={c.mode}
                        aria-label="Category type"
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
                        enterKeyHint="done"
                        value={c.value}
                        aria-label="Category value"
                        onChange={(e) =>
                          update(c.id, { value: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) })
                        }
                        pattern="[0-9.]*"
                      />
                    </td>
                    <td className="text-tight">
                      <button className="btn btn--icon" type="button" onClick={() => remove(c.id)} aria-label={`Delete ${c.name}`}>
                        <IconX size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* "+ Add category": dialog on desktop, bottom sheet on mobile */}
      <FormDialog open={addOpen} title="Add category" onClose={() => setAddOpen(false)}>
        <AddCategoryForm
          inSheet
          draft={draft}
          setDraft={setDraft}
          onAdd={() => { if (add()) setAddOpen(false); }}
          attempted={attempted}
        />
      </FormDialog>

      <UndoToast entry={undo} onDismiss={() => setUndo(null)} />
    </section>
  );
}
