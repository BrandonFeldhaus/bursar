"use client";

import { useEffect, useState } from "react";
import { IconInfoCircle, IconPlus, IconX } from "@tabler/icons-react";
import { loadState, saveState, type BudgetState, type Income, type PayCycle } from "../lib/storage";
import { useHydrated } from "../lib/useHydrated";
import { useIsMobile } from "../lib/useIsMobile";
import { todayISO, monthlyIncomeOf } from "../lib/month";
import { UndoToast, type UndoEntry } from "../components/UndoToast";
import { SavedIndicator, useSavedIndicator } from "../components/SavedIndicator";
import { BottomSheet } from "../components/BottomSheet";
import { moneyFmt } from "../lib/currency";
import { jumpToAddForm } from "../lib/jumpToAddForm";
import { AddSourceForm, CYCLE_OPTIONS, emptySourceDraft, incomeFromDraft, needsAnchor, sourceDraftErrors, type SourceDraft } from "../components/AddSourceForm";
import { Hint, dismissHint, type HintId } from "../components/Hint";

export default function IncomePage() {
  const hydrated = useHydrated();
  const isMobile = useIsMobile();
  const [state, setState] = useState<BudgetState | null>(null);
  const [draft, setDraft] = useState<SourceDraft>(emptySourceDraft);
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

  function dismiss(id: HintId) {
    setState((s) => (s ? dismissHint(s, id) : s));
  }

  function update(id: string, patch: Partial<Income>) {
    setState((s) => s ? { ...s, incomes: s.incomes.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : s);
    saved.flash();
  }

  function remove(id: string) {
    setState((s) => {
      if (!s) return s;
      const index = s.incomes.findIndex((i) => i.id === id);
      const target = s.incomes[index];
      if (!target) return s;
      setUndo({
        id,
        message: `Deleted ${target.name || "income"}`,
        onUndo: () => {
          setState((cur) => {
            if (!cur) return cur;
            const restored = [...cur.incomes];
            restored.splice(index, 0, target);
            return { ...cur, incomes: restored };
          });
          saved.flash();
        },
      });
      return { ...s, incomes: s.incomes.filter((i) => i.id !== id) };
    });
  }

  function add(): boolean {
    const errs = sourceDraftErrors(draft);
    if (errs.name || errs.amount || errs.date) {
      setAttempted(true);
      return false;
    }
    const income = incomeFromDraft(draft, errs);
    setState((s) => (s ? { ...s, incomes: [...s.incomes, income] } : s));
    setDraft(emptySourceDraft());
    setAttempted(false);
    saved.flash();
    return true;
  }

  if (!hydrated || !state) {
    return (
      <section className="container" aria-busy="true">
        <header className="sheet page-head">
          <p className="kicker">Income</p>
          <h1 className="page-head__title">Income ledger</h1>
          <p className="page-head__lead">Loading income entries…</p>
        </header>
        <div className="sheet skeleton-card" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton--row" />
          ))}
        </div>
      </section>
    );
  }

  const monthly = monthlyIncomeOf(state);
  const annual = monthly * 12;
  const weeklyCount = state.incomes.filter((i) => i.payCycle === "weekly").length;
  const biweeklyCount = state.incomes.filter((i) => i.payCycle === "biweekly").length;
  const semiCount = state.incomes.filter((i) => i.payCycle === "semimonthly").length;

  return (
    <section className="container">
      {/* Page head */}
      <header className="sheet page-head">
        <p className="kicker">Income</p>
        <h1 className="page-head__title">Income ledger</h1>
        <p className="page-head__lead">Track all your income sources. Each one's paycheck dates are calculated independently and feed into your period breakdown.</p>
        <details className="cycle-info">
          <summary><IconInfoCircle size={14} aria-hidden="true" />About pay cycle types</summary>
          <dl className="cycle-info__list">
            <div>
              <dt>Weekly</dt>
              <dd>52 paychecks/year, every 7 days. Anchored to your most recent paycheck date.</dd>
            </div>
            <div>
              <dt>Bi-weekly</dt>
              <dd>26 paychecks/year, every 14 days. Anchored to your most recent paycheck date.</dd>
            </div>
            <div>
              <dt>Semi-monthly</dt>
              <dd>24 paychecks/year, always on the 1st and 15th. No anchor needed.</dd>
            </div>
          </dl>
        </details>
      </header>

      <Hint id="income" hints={state.meta.hints} onDismiss={dismiss} />

      {/* Stats row */}
      <div className="stat-row stat-row--4">
        <article className="sheet stat sheet--stat">
          <div className="stat__label">Monthly income</div>
          <div className="stat__value">{moneyFmt(monthly)}</div>
        </article>
        <article className="sheet stat sheet--stat">
          <div className="stat__label">Weekly sources</div>
          <div className="stat__value">{weeklyCount}</div>
        </article>
        <article className="sheet stat sheet--stat">
          <div className="stat__label">Bi-weekly sources</div>
          <div className="stat__value">{biweeklyCount}</div>
        </article>
        <article className="sheet stat sheet--stat">
          <div className="stat__label">Semi-monthly sources</div>
          <div className="stat__value">{semiCount}</div>
        </article>
      </div>

      {/* Ledger table */}
      <div className="sheet table-card">
        <div className="table-card__head row-between mb-3">
          <div className="table-card__title">
            <div>
              <p className="kicker">Sources</p>
              <h2 className="section-title">All inflow lines</h2>
            </div>
            <SavedIndicator visible={saved.visible} />
          </div>
          <div className="table-card__actions">
            <button
              type="button"
              className="btn mobile-only-inline btn--jump"
              onClick={() => (isMobile ? setAddOpen(true) : jumpToAddForm())}
            >
              <IconPlus size={12} aria-hidden="true" />Add source
            </button>
            <span className="badge mobile-hidden">{state.incomes.length} sources</span>
          </div>
        </div>

        <div className="ledger-table-wrap-no-line ledger-table-wrap--flush">
          <table className="ledger-table ledger-table--responsive ledger-table--income">
            <thead>
              <tr>
                <th>Source</th>
                <th className="text-right">Amount</th>
                <th>Cycle</th>
                <th>Anchor / Days</th>
                <th className="text-tight" />
              </tr>
            </thead>
            <tbody>
              {state.incomes.map((inc) => (
                <tr key={inc.id}>
                  <td data-label="Source">
                    <input
                      className="input"
                      value={inc.name}
                      aria-label="Income source name"
                      onChange={(e) => update(inc.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="text-right mono" data-label="Amount">
                    <input
                      className="input input--mono"
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9.]*"
                      value={inc.amount}
                      aria-label="Income amount"
                      onChange={(e) =>
                        update(inc.id, { amount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) })
                      }
                    />
                  </td>
                  <td data-label="Cycle">
                    <select
                      className="select"
                      value={inc.payCycle}
                      aria-label="Pay cycle"
                      onChange={(e) => {
                        const next = e.target.value as PayCycle;
                        update(inc.id, {
                          payCycle: next,
                          lastPaycheckDate: needsAnchor(next) ? inc.lastPaycheckDate || todayISO() : "",
                        });
                      }}
                    >
                      {CYCLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Anchor">
                    {needsAnchor(inc.payCycle) ? (
                      <input
                        className="input"
                        type="date"
                        value={inc.lastPaycheckDate || ""}
                        aria-label="Last paycheck date"
                        onChange={(e) => update(inc.id, { lastPaycheckDate: e.target.value })}
                      />
                    ) : (
                      <span className="muted muted--italic">1st &amp; 15th</span>
                    )}
                  </td>
                  <td className="text-tight">
                    <button
                      className="btn btn--icon"
                      type="button"
                      aria-label={`Delete ${inc.name || "income"}`}
                      onClick={() => remove(inc.id)}
                    >
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
          <AddSourceForm formId="add-form" draft={draft} setDraft={setDraft} onAdd={add} attempted={attempted} />
        )}
      </div>

      {/* Mobile add sheet */}
      {isMobile && addOpen && (
        <BottomSheet open title="Add source" onClose={() => setAddOpen(false)}>
          <AddSourceForm
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
