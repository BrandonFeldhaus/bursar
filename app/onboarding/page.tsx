"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultBudget, loadBudget, newId, saveBudget, type BudgetCategory, type PayCycle, type RecurringExpense } from "../lib/budgetStorage";
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
        <div className="sheet sheet--ledger onboarding-card">
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
      <div className="sheet sheet--ledger onboarding-card">
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
            <p className="kicker">Step 1 of 3</p>
            <h1 className="page-head__title" style={{ marginBottom: 10 }}>Open the book</h1>
            <p className="muted" style={{ fontSize: 17, marginBottom: 24, color: "var(--ink-2)" }}>
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
          </div>
        )}

        {/* Step 2: Bills */}
        {step === 1 && (
          <div>
            <p className="kicker">Step 2 of 3</p>
            <h1 className="page-head__title" style={{ marginBottom: 10 }}>List your bills</h1>
            <p className="muted" style={{ fontSize: 17, marginBottom: 24, color: "var(--ink-2)" }}>
              Recurring obligations. Annual ones get spread across the year automatically.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {bills.map((b) => (
                <div key={b.id} style={{ display: "grid", gridTemplateColumns: b.cadence === "annual" ? "2fr 1fr 1fr 1fr 1fr auto" : "2fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
                  <input
                    className="input"
                    placeholder="Bill name"
                    value={b.name}
                    onChange={(e) => setBills((xs) => xs.map((x) => x.id === b.id ? { ...x, name: e.target.value } : x))}
                  />
                  <input
                    className="input input--mono"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={b.amount || ""}
                    onChange={(e) =>
                      setBills((xs) => xs.map((x) => x.id === b.id ? { ...x, amount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) } : x))
                    }
                  />
                  <select
                    className="select"
                    value={b.cadence}
                    onChange={(e) => setBills((xs) => xs.map((x) => x.id === b.id ? { ...x, cadence: e.target.value as "monthly" | "annual" } : x))}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                  <input
                    className="input input--mono"
                    type="number"
                    min={1}
                    max={31}
                    title="Due day"
                    value={b.dueDay}
                    onChange={(e) => setBills((xs) => xs.map((x) => x.id === b.id ? { ...x, dueDay: Math.max(1, Math.min(31, Number(e.target.value))) } : x))}
                  />
                  {b.cadence === "annual" && (
                    <select
                      className="select"
                      title="Due month"
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
                  <button
                    className="btn btn--icon"
                    type="button"
                    onClick={() => setBills((xs) => xs.filter((x) => x.id !== b.id))}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => setBills((xs) => [...xs, { id: newId(), name: "", amount: 0, cadence: "monthly", dueDay: 1, dueMonth: 1 }])}
              >
                + Add bill
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Plan */}
        {step === 2 && (
          <div>
            <p className="kicker">Step 3 of 3</p>
            <h1 className="page-head__title" style={{ marginBottom: 10 }}>Plan the leftover</h1>
            <p className="muted" style={{ fontSize: 17, marginBottom: 24, color: "var(--ink-2)" }}>
              How should every paycheck be split after bills?
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {allocations.map((a) => (
                <div key={a.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
                  <input
                    className="input"
                    placeholder="Category"
                    value={a.name}
                    onChange={(e) => setAllocations((xs) => xs.map((x) => x.id === a.id ? { ...x, name: e.target.value } : x))}
                  />
                  <select
                    className="select"
                    value={a.mode}
                    onChange={(e) => setAllocations((xs) => xs.map((x) => x.id === a.id ? { ...x, mode: e.target.value as "percent" | "fixed" } : x))}
                  >
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed $</option>
                  </select>
                  <input
                    className="input input--mono"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={a.value || ""}
                    onChange={(e) =>
                      setAllocations((xs) => xs.map((x) => x.id === a.id ? { ...x, value: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) } : x))
                    }
                  />
                  <button
                    className="btn btn--icon"
                    type="button"
                    onClick={() => setAllocations((xs) => xs.filter((x) => x.id !== a.id))}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => setAllocations((xs) => [...xs, { id: newId(), name: "", mode: "percent", value: 0 }])}
              >
                + Add category
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
