"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultBudget, loadBudget, newId, saveBudget, type BudgetCategory, type BudgetState, type PayCycle, type RecurringExpense } from "../lib/budgetStorage";
import { useHydrated } from "../lib/useHydrated";
import { todayISO } from "../lib/month";

type IncomeDraft = { name: string; amount: number; payCycle: PayCycle; lastPaycheckDate: string };
type BillDraft = { id: string; name: string; amount: number; cadence: "monthly" | "annual"; dueDay: number; dueMonth: number };

export default function OnboardingPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState<IncomeDraft>({
    name: "Day job",
    amount: 2400,
    payCycle: "biweekly",
    lastPaycheckDate: todayISO(),
  });
  const [bills, setBills] = useState<BillDraft[]>([
    { id: newId(), name: "Rent", amount: 1200, cadence: "monthly", dueDay: 1, dueMonth: 1 },
    { id: newId(), name: "Utilities", amount: 120, cadence: "monthly", dueDay: 8, dueMonth: 1 },
  ]);
  const [billDraft, setBillDraft] = useState<Omit<BillDraft, "id">>({ name: "", amount: 0, cadence: "monthly", dueDay: 1, dueMonth: 1 });
  const [allocDraft, setAllocDraft] = useState<Omit<BudgetCategory, "id">>({ name: "", mode: "percent", value: 0 });
  const [allocations, setAllocations] = useState<BudgetCategory[]>([
    { id: newId(), name: "Savings", mode: "percent", value: 25 },
    { id: newId(), name: "Spending", mode: "percent", value: 50 },
    { id: newId(), name: "Buffer", mode: "percent", value: 25 },
  ]);

  useEffect(() => {
    if (!hydrated) return;
    const existing = loadBudget();
    if (existing?.meta?.onboardingComplete) {
      router.replace("/");
    }
  }, [hydrated, router]);

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const incoming =
        typeof parsed === "object" && parsed !== null && "data" in parsed
          ? (parsed as { data?: unknown }).data
          : typeof parsed === "object" && parsed !== null && "budgetAppV1" in parsed
          ? (parsed as { budgetAppV1?: unknown }).budgetAppV1
          : parsed;
      if (!incoming || typeof incoming !== "object") return;
      saveBudget(incoming as BudgetState);
      router.replace("/");
    } catch {
      // invalid file — stay on onboarding
    } finally {
      e.target.value = "";
    }
  }

  function finish() {
    saveBudget(
      defaultBudget({
        meta: { onboardingComplete: true, version: 1, createdAt: new Date().toISOString() },
        incomes: [{ id: newId(), name: income.name.trim() || "Primary income", amount: Math.max(0, income.amount), cadence: "monthly", payCycle: income.payCycle, lastPaycheckDate: income.payCycle === "biweekly" ? income.lastPaycheckDate : "" }],
        recurringExpenses: bills.filter((b) => b.name.trim()).map((b) => ({ ...b, paidPeriods: [] }) as RecurringExpense),
        budgetCategories: allocations.filter((a) => a.name.trim()),
        payCycle: income.payCycle,
        paycheckAmount: income.amount,
        incomeMonthly: income.payCycle === "biweekly" ? (income.amount * 26) / 12 : (income.amount * 24) / 12,
        lastPaycheckDate: income.payCycle === "biweekly" ? income.lastPaycheckDate : "",
      }),
    );
    router.replace("/");
  }

  if (!hydrated) {
    return (
      <div className="onboarding-stage">
        <div className="sheet onboarding-card">
          <p className="kicker">Opening Ledger</p>
          <h1 className="page-head__title">Paper &amp; Ink setup</h1>
          <p className="muted">Loading your first sheet…</p>
        </div>
      </div>
    );
  }

  const STEPS = ["Income", "Bills", "Plan"];

  return (
    <div className="onboarding-stage">
      <div className="sheet onboarding-card">
        {/* Step dots */}
        <div className="onboarding-step-meta">
          {STEPS.map((s, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span
                className={[
                  "onboarding-step-dot",
                  i === step ? "onboarding-step-dot--active" : "",
                  i < step ? "onboarding-step-dot--done" : "",
                ].filter(Boolean).join(" ")}
              />
              <span style={{ color: i === step ? "var(--ink-1)" : "var(--ink-3)" }}>{s}</span>
              {i < STEPS.length - 1 && <span style={{ color: "var(--ink-4)", margin: "0 6px" }}>·</span>}
            </span>
          ))}
        </div>

        {/* Step 1: Income */}
        {step === 0 && (
          <div>
            <p className="kicker">Income</p>
            <h1 className="page-head__title" style={{ marginBottom: 10 }}>Open the book</h1>
            <p className="page-head__lead" style={{ marginBottom: 24 }}>
              Start with your primary paycheck. You can add more sources after.
            </p>
            <div style={{ display: "grid", gap: 18 }}>
              <div className="field">
                <label className="field__label">Source name</label>
                <input
                  className="input"
                  value={income.name}
                  onChange={(e) => setIncome((d) => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div className="field">
                <label className="field__label">Amount per paycheck (after taxes)</label>
                <input
                  className="input input--mono"
                  type="text"
                  inputMode="decimal"
                  value={income.amount || ""}
                  onChange={(e) =>
                    setIncome((d) => ({ ...d, amount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) }))
                  }
                />
              </div>
              <div className="field">
                <label className="field__label">Pay cycle</label>
                <div className="segment" role="radiogroup">
                  {([["biweekly", "Bi-weekly"], ["semimonthly", "Semi-monthly"]] as const).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      aria-checked={income.payCycle === val}
                      className={`segment__btn${income.payCycle === val ? " segment__btn--active" : ""}`}
                      onClick={() => setIncome((d) => ({ ...d, payCycle: val }))}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              {income.payCycle === "biweekly" && (
                <div className="field">
                  <label className="field__label">Most recent paycheck</label>
                  <input
                    className="input"
                    type="date"
                    value={income.lastPaycheckDate}
                    onChange={(e) => setIncome((d) => ({ ...d, lastPaycheckDate: e.target.value }))}
                  />
                  <p className="field__hint">Used to forecast your bi-weekly paycheck dates.</p>
                </div>
              )}
            </div>

            <div className="onboarding-divider">
              <span>or</span>
            </div>

            <div className="field">
              <label className="field__label">Import a saved ledger file</label>
              <p className="field__hint">Pick a .json file exported from Paper &amp; Ink to skip setup entirely.</p>
              <label className="btn btn--ghost onboarding-file-btn">
                Choose file
                <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={importFile} />
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Bills */}
        {step === 1 && (
          <div>
            <p className="kicker">Bills</p>
            <h1 className="page-head__title" style={{ marginBottom: 10 }}>List your bills</h1>
            <p className="page-head__lead" style={{ marginBottom: 24 }}>
              Recurring obligations. Annual ones get spread across the year automatically.
            </p>
            <div className="ledger-table-wrap-no-line" style={{ borderRadius: "10px 10px 0 0" }}>
              <table className="ledger-table onboarding-table">
                <thead>
                  <tr>
                    <th style={{ width: "32%" }}>Notation</th>
                    <th className="text-right" style={{ width: "16%" }}>Amount</th>
                    <th style={{ width: "22%" }}>Cadence</th>
                    <th style={{ width: "26%" }}>Due</th>
                    <th className="text-tight" />
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <input
                          className="input"
                          placeholder="Bill name"
                          value={b.name}
                          onChange={(e) => setBills((xs) => xs.map((x) => x.id === b.id ? { ...x, name: e.target.value } : x))}
                        />
                      </td>
                      <td className="text-right mono">
                        <input
                          className="input input--mono"
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={b.amount || ""}
                          style={{ textAlign: "right" }}
                          onChange={(e) =>
                            setBills((xs) => xs.map((x) => x.id === b.id ? { ...x, amount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) } : x))
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="select"
                          value={b.cadence}
                          onChange={(e) => setBills((xs) => xs.map((x) => x.id === b.id ? { ...x, cadence: e.target.value as "monthly" | "annual" } : x))}
                        >
                          <option value="monthly">Monthly</option>
                          <option value="annual">Annual</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            className="input input--mono"
                            type="number"
                            min={1}
                            max={31}
                            value={b.dueDay}
                            style={{ width: "52px", flexShrink: 0 }}
                            onChange={(e) => setBills((xs) => xs.map((x) => x.id === b.id ? { ...x, dueDay: Math.max(1, Math.min(31, Number(e.target.value))) } : x))}
                          />
                          {b.cadence === "annual" && (
                            <select
                              className="select"
                              value={b.dueMonth}
                              onChange={(e) => setBills((xs) => xs.map((x) => x.id === b.id ? { ...x, dueMonth: Number(e.target.value) } : x))}
                            >
                              {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                  {new Date(2026, i, 1).toLocaleDateString("en-US", { month: "short" })}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="text-tight">
                        <button
                          className="btn btn--icon"
                          type="button"
                          aria-label={`Delete ${b.name}`}
                          onClick={() => setBills((xs) => xs.filter((x) => x.id !== b.id))}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="inline-form inline-form--4col">
              <div className="field">
                <label className="field__label">New notation</label>
                <input
                  className="input"
                  placeholder="e.g. Internet"
                  value={billDraft.name}
                  onChange={(e) => setBillDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div className="field">
                <label className="field__label">Amount</label>
                <input
                  className="input input--mono"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={billDraft.amount || ""}
                  onChange={(e) => setBillDraft((d) => ({ ...d, amount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) }))}
                />
              </div>
              <div className="field">
                <label className="field__label">Cadence</label>
                <select
                  className="select"
                  value={billDraft.cadence}
                  onChange={(e) => setBillDraft((d) => ({ ...d, cadence: e.target.value as "monthly" | "annual" }))}
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div className="field">
                <label className="field__label">Due{billDraft.cadence === "annual" ? " day / month" : " day"}</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    className="input input--mono"
                    type="number"
                    min={1}
                    max={31}
                    placeholder="1"
                    value={billDraft.dueDay || ""}
                    style={{ width: "52px", flexShrink: 0 }}
                    onChange={(e) => setBillDraft((d) => ({ ...d, dueDay: Math.max(1, Math.min(31, Number(e.target.value))) }))}
                  />
                  {billDraft.cadence === "annual" && (
                    <select
                      className="select"
                      value={billDraft.dueMonth}
                      onChange={(e) => setBillDraft((d) => ({ ...d, dueMonth: Number(e.target.value) }))}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(2026, i, 1).toLocaleDateString("en-US", { month: "short" })}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <button
                className="btn"
                type="button"
                disabled={!billDraft.name.trim()}
                onClick={() => {
                  if (!billDraft.name.trim()) return;
                  setBills((xs) => [...xs, { id: newId(), ...billDraft, name: billDraft.name.trim() }]);
                  setBillDraft({ name: "", amount: 0, cadence: "monthly", dueDay: 1, dueMonth: 1 });
                }}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Plan */}
        {step === 2 && (
          <div>
            <p className="kicker">Plan</p>
            <h1 className="page-head__title" style={{ marginBottom: 10 }}>Plan the leftover</h1>
            <p className="page-head__lead" style={{ marginBottom: 24 }}>
              How should every paycheck be split after bills?
            </p>
            <div className="ledger-table-wrap-no-line" style={{ borderRadius: "10px 10px 0 0" }}>
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th style={{ width: "45%" }}>Category</th>
                    <th style={{ width: "25%" }}>Type</th>
                    <th className="text-right" style={{ width: "25%" }}>Value</th>
                    <th className="text-tight" />
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <input
                          className="input"
                          placeholder="Category"
                          value={a.name}
                          onChange={(e) => setAllocations((xs) => xs.map((x) => x.id === a.id ? { ...x, name: e.target.value } : x))}
                        />
                      </td>
                      <td>
                        <select
                          className="select"
                          value={a.mode}
                          onChange={(e) => setAllocations((xs) => xs.map((x) => x.id === a.id ? { ...x, mode: e.target.value as "percent" | "fixed" } : x))}
                        >
                          <option value="percent">Percent</option>
                          <option value="fixed">Fixed $</option>
                        </select>
                      </td>
                      <td className="text-right mono">
                        <input
                          className="input input--mono"
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={a.value || ""}
                          style={{ textAlign: "right" }}
                          onChange={(e) =>
                            setAllocations((xs) => xs.map((x) => x.id === a.id ? { ...x, value: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) } : x))
                          }
                        />
                      </td>
                      <td className="text-tight">
                        <button
                          className="btn btn--icon"
                          type="button"
                          aria-label={`Delete ${a.name}`}
                          onClick={() => setAllocations((xs) => xs.filter((x) => x.id !== a.id))}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="inline-form">
              <div className="field">
                <label className="field__label">New category</label>
                <input
                  className="input"
                  placeholder="e.g. Travel fund"
                  value={allocDraft.name}
                  onChange={(e) => setAllocDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div className="field">
                <label className="field__label">Type</label>
                <select
                  className="select"
                  value={allocDraft.mode}
                  onChange={(e) => setAllocDraft((d) => ({ ...d, mode: e.target.value as "percent" | "fixed" }))}
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
                  value={allocDraft.value || ""}
                  onChange={(e) => setAllocDraft((d) => ({ ...d, value: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) }))}
                />
              </div>
              <button
                className="btn"
                type="button"
                disabled={!allocDraft.name.trim()}
                onClick={() => {
                  if (!allocDraft.name.trim()) return;
                  setAllocations((xs) => [...xs, { id: newId(), ...allocDraft, name: allocDraft.name.trim() }]);
                  setAllocDraft({ name: "", mode: "percent", value: 0 });
                }}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="row-between" style={{ marginTop: 32 }}>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            ‹ Back
          </button>
          {step < 2 ? (
            <button className="btn" type="button" onClick={() => setStep((s) => s + 1)}>
              Continue ›
            </button>
          ) : (
            <button className="btn" type="button" onClick={finish}>
              Open ledger
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
