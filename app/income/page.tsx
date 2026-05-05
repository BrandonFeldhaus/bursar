"use client";

import { useEffect, useState } from "react";
import { loadState, newId, saveState, type BudgetState, type Income, type PayCycle } from "../lib/storage";
import { useHydrated } from "../lib/useHydrated";
import { todayISO, incomeDatesForMonth, monthlyIncomeOf } from "../lib/month";

function moneyFmt(value: number) {
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  return `${v < 0 ? "−" : ""}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function IncomePage() {
  const hydrated = useHydrated();
  const [state, setState] = useState<BudgetState | null>(null);
  const [draft, setDraft] = useState<Omit<Income, "id" | "cadence">>({
    name: "",
    amount: 0,
    payCycle: "biweekly",
    lastPaycheckDate: todayISO(),
  });

  useEffect(() => {
    if (!hydrated) return;
    setState(loadState());
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !state) return;
    saveState(state);
  }, [hydrated, state]);

  function update(id: string, patch: Partial<Income>) {
    setState((s) => s ? { ...s, incomes: s.incomes.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : s);
  }

  function remove(id: string) {
    setState((s) => s ? { ...s, incomes: s.incomes.filter((i) => i.id !== id) } : s);
  }

  function add() {
    const name = draft.name.trim();
    if (!name) return;
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        incomes: [
          ...s.incomes,
          {
            id: newId(),
            name,
            amount: Math.max(0, Number(draft.amount) || 0),
            cadence: "monthly" as const,
            payCycle: draft.payCycle,
            lastPaycheckDate: draft.payCycle === "biweekly" ? draft.lastPaycheckDate || todayISO() : "",
          },
        ],
      };
    });
    setDraft({ name: "", amount: 0, payCycle: "biweekly", lastPaycheckDate: todayISO() });
  }

  if (!hydrated || !state) {
    return (
      <section className="container">
        <header className="sheet page-head">
          <p className="kicker">Income</p>
          <h1 className="page-head__title">Income ledger</h1>
          <p className="page-head__lead">Loading income entries…</p>
        </header>
      </section>
    );
  }

  const monthly = monthlyIncomeOf(state);
  const annual = monthly * 12;
  const biweeklyCount = state.incomes.filter((i) => i.payCycle === "biweekly").length;
  const semiCount = state.incomes.filter((i) => i.payCycle === "semimonthly").length;

  return (
    <section className="container">
      {/* Page head */}
      <header className="sheet page-head">
        <p className="kicker">Income</p>
        <h1 className="page-head__title">Income ledger</h1>
        <p className="page-head__lead">Track all your income sources. Each one's paycheck dates are calculated independently and feed into your period breakdown.</p>
        <div className="page-head__meta">
          <div className="page-head__meta-item">
            <span className="page-head__meta-label">Sources</span>
            <span className="page-head__meta-value">{state.incomes.length}</span>
          </div>
          <div className="page-head__meta-item">
            <span className="page-head__meta-label">Monthly</span>
            <span className="page-head__meta-value">{moneyFmt(monthly)}</span>
          </div>
          <div className="page-head__meta-item">
            <span className="page-head__meta-label">Annualized</span>
            <span className="page-head__meta-value">{moneyFmt(annual)}</span>
          </div>
        </div>
      </header>

      {/* Stats row */}
      <div className="stat-row">
        <article className="sheet stat" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Monthly income</div>
          <div className="stat__value">{moneyFmt(monthly)}</div>
        </article>
        <article className="sheet stat" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Bi-weekly sources</div>
          <div className="stat__value">{biweeklyCount}</div>
        </article>
        <article className="sheet stat" style={{ padding: "16px 22px 18px" }}>
          <div className="stat__label">Semi-monthly sources</div>
          <div className="stat__value">{semiCount}</div>
        </article>
      </div>

      {/* Ledger table */}
      <div className="sheet" style={{ paddingTop: "20px", paddingBottom: 0 }}>
        <div style={{ padding: "0 28px" }} className="row-between mb-3">
          <div>
            <p className="kicker">Sources</p>
            <h2 className="section-title">All inflow lines</h2>
          </div>
          <span className="badge">{state.incomes.length} sources</span>
        </div>

        <div className="ledger-table-wrap-no-line" style={{ borderRadius: "10px 10px 0 0" }}>
          <table className="ledger-table">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Source</th>
                <th className="text-right" style={{ width: "20%" }}>Amount</th>
                <th style={{ width: "20%" }}>Cycle</th>
                <th style={{ width: "25%" }}>Anchor / Days</th>
                <th className="text-tight" />
              </tr>
            </thead>
            <tbody>
              {state.incomes.map((inc) => (
                <tr key={inc.id}>
                  <td>
                    <input
                      className="input"
                      value={inc.name}
                      onChange={(e) => update(inc.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="text-right mono">
                    <input
                      className="input input--mono"
                      type="text"
                      inputMode="decimal"
                      value={inc.amount}
                      style={{ textAlign: "right" }}
                      onChange={(e) =>
                        update(inc.id, { amount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) })
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="select"
                      value={inc.payCycle}
                      onChange={(e) =>
                        update(inc.id, {
                          payCycle: e.target.value as PayCycle,
                          lastPaycheckDate: e.target.value === "biweekly" ? inc.lastPaycheckDate || todayISO() : "",
                        })
                      }
                    >
                      <option value="biweekly">Bi-weekly</option>
                      <option value="semimonthly">Semi-monthly</option>
                    </select>
                  </td>
                  <td>
                    {inc.payCycle === "biweekly" ? (
                      <input
                        className="input"
                        type="date"
                        value={inc.lastPaycheckDate || ""}
                        onChange={(e) => update(inc.id, { lastPaycheckDate: e.target.value })}
                      />
                    ) : (
                      <span className="muted" style={{ fontStyle: "italic" }}>1st &amp; 15th</span>
                    )}
                  </td>
                  <td className="text-tight">
                    <button
                      className="btn btn--icon"
                      type="button"
                      aria-label={`Delete ${inc.name}`}
                      onClick={() => remove(inc.id)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inline add form */}
        <div className={`inline-form${draft.payCycle === "biweekly" ? " inline-form--4col" : ""}`}>
          <div className="field">
            <label className="field__label">New source</label>
            <input
              className="input"
              placeholder="e.g. Day job"
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
            <label className="field__label">Cycle</label>
            <select
              className="select"
              value={draft.payCycle}
              onChange={(e) => setDraft((d) => ({ ...d, payCycle: e.target.value as PayCycle }))}
            >
              <option value="biweekly">Bi-weekly</option>
              <option value="semimonthly">Semi-monthly</option>
            </select>
          </div>
          {draft.payCycle === "biweekly" && (
            <div className="field">
              <label className="field__label">Last paycheck</label>
              <input
                className="input"
                type="date"
                value={draft.lastPaycheckDate}
                onChange={(e) => setDraft((d) => ({ ...d, lastPaycheckDate: e.target.value }))}
              />
            </div>
          )}
          <button className="btn" type="button" onClick={add} disabled={!draft.name.trim()}>
            Add source
          </button>
        </div>
      </div>
    </section>
  );
}
