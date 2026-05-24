"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { defaultBudget, loadBudget, newId, saveBudget, type BudgetCategory, type BudgetState, type Goal, type PayCycle, type RecurringExpense } from "../lib/budgetStorage";
import { useHydrated } from "../lib/useHydrated";
import { todayISO } from "../lib/month";
import { UndoToast, type UndoEntry } from "../components/UndoToast";
import { jumpToAddForm } from "../lib/jumpToAddForm";

type IncomeDraft = { name: string; amount: number; payCycle: PayCycle; lastPaycheckDate: string };
type BillDraft = { id: string; name: string; amount: number; cadence: "monthly" | "annual"; dueDay: number; dueMonth: number };
type GoalDraft = { name: string; type: "savings" | "debt"; targetAmount: number };

export default function OnboardingPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState<IncomeDraft>({
    name: "Day job",
    amount: 1800,
    payCycle: "biweekly",
    lastPaycheckDate: todayISO(),
  });
  const [bills, setBills] = useState<BillDraft[]>([
    { id: newId(), name: "Rent", amount: 1200, cadence: "monthly", dueDay: 1, dueMonth: 1 },
    { id: newId(), name: "Utilities", amount: 120, cadence: "monthly", dueDay: 8, dueMonth: 1 },
    { id: newId(), name: "Internet", amount: 60, cadence: "monthly", dueDay: 15, dueMonth: 1 },
    { id: newId(), name: "Phone", amount: 45, cadence: "monthly", dueDay: 20, dueMonth: 1 },
    { id: newId(), name: "Car insurance", amount: 600, cadence: "annual", dueDay: 15, dueMonth: 6 },
  ]);
  const [billDraft, setBillDraft] = useState<Omit<BillDraft, "id">>({ name: "", amount: 0, cadence: "monthly", dueDay: 1, dueMonth: 1 });
  const [allocDraft, setAllocDraft] = useState<Omit<BudgetCategory, "id">>({ name: "", mode: "percent", value: 0 });
  const [allocations, setAllocations] = useState<BudgetCategory[]>([
    { id: newId(), name: "Savings", mode: "percent", value: 25 },
    { id: newId(), name: "Spending", mode: "percent", value: 50 },
    { id: newId(), name: "Gas", mode: "fixed", value: 60 },
    { id: newId(), name: "Buffer", mode: "percent", value: 25 },
  ]);
  const [goals, setGoals] = useState<(GoalDraft & { id: string })[]>([
    { id: newId(), name: "Emergency fund", type: "savings", targetAmount: 9000 },
  ]);
  const [goalDraft, setGoalDraft] = useState<GoalDraft>({ name: "", type: "savings", targetAmount: 0 });
  const [attemptedBill, setAttemptedBill] = useState(false);
  const [attemptedAlloc, setAttemptedAlloc] = useState(false);
  const [attemptedGoal, setAttemptedGoal] = useState(false);
  const [undo, setUndo] = useState<UndoEntry | null>(null);

  function addBill() {
    const name = billDraft.name.trim();
    if (!name || billDraft.amount <= 0) {
      setAttemptedBill(true);
      return;
    }
    setBills((xs) => [...xs, { id: newId(), ...billDraft, name }]);
    setBillDraft({ name: "", amount: 0, cadence: "monthly", dueDay: 1, dueMonth: 1 });
    setAttemptedBill(false);
  }

  function removeBill(id: string) {
    setBills((xs) => {
      const index = xs.findIndex((x) => x.id === id);
      const target = xs[index];
      if (!target) return xs;
      setUndo({
        id,
        message: `Removed ${target.name || "bill"}`,
        onUndo: () => setBills((cur) => {
          const restored = [...cur];
          restored.splice(index, 0, target);
          return restored;
        }),
      });
      return xs.filter((x) => x.id !== id);
    });
  }

  function addAllocation() {
    const name = allocDraft.name.trim();
    if (!name || allocDraft.value <= 0) {
      setAttemptedAlloc(true);
      return;
    }
    setAllocations((xs) => [...xs, { id: newId(), ...allocDraft, name }]);
    setAllocDraft({ name: "", mode: "percent", value: 0 });
    setAttemptedAlloc(false);
  }

  function removeAllocation(id: string) {
    setAllocations((xs) => {
      const index = xs.findIndex((x) => x.id === id);
      const target = xs[index];
      if (!target) return xs;
      setUndo({
        id,
        message: `Removed ${target.name || "category"}`,
        onUndo: () => setAllocations((cur) => {
          const restored = [...cur];
          restored.splice(index, 0, target);
          return restored;
        }),
      });
      return xs.filter((x) => x.id !== id);
    });
  }

  function addGoal() {
    const name = goalDraft.name.trim();
    if (!name || goalDraft.targetAmount <= 0) {
      setAttemptedGoal(true);
      return;
    }
    setGoals((xs) => [...xs, { id: newId(), ...goalDraft, name }]);
    setGoalDraft({ name: "", type: "savings", targetAmount: 0 });
    setAttemptedGoal(false);
  }

  function removeGoal(id: string) {
    setGoals((xs) => {
      const index = xs.findIndex((x) => x.id === id);
      const target = xs[index];
      if (!target) return xs;
      setUndo({
        id,
        message: `Removed ${target.name || "goal"}`,
        onUndo: () => setGoals((cur) => {
          const restored = [...cur];
          restored.splice(index, 0, target);
          return restored;
        }),
      });
      return xs.filter((x) => x.id !== id);
    });
  }

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
        incomes: [{ id: newId(), name: income.name.trim() || "Primary income", amount: Math.max(0, income.amount), cadence: "monthly", payCycle: income.payCycle, lastPaycheckDate: income.payCycle !== "semimonthly" ? income.lastPaycheckDate : "" }],
        recurringExpenses: bills.filter((b) => b.name.trim()).map((b) => ({ ...b, paidPeriods: [] }) as RecurringExpense),
        budgetCategories: allocations.filter((a) => a.name.trim()),
        goals: goals.filter((g) => g.name.trim()).map((g) => ({ id: g.id, name: g.name.trim(), type: g.type, targetAmount: g.targetAmount, linkedBudgetCategoryIds: [], linkedExpenseIds: [], manualAdjustments: [], appliedPeriods: [] }) as Goal),
        payCycle: income.payCycle,
        paycheckAmount: income.amount,
        incomeMonthly: income.payCycle === "weekly" ? (income.amount * 52) / 12 : income.payCycle === "biweekly" ? (income.amount * 26) / 12 : (income.amount * 24) / 12,
        lastPaycheckDate: income.payCycle !== "semimonthly" ? income.lastPaycheckDate : "",
      }),
    );
    router.replace("/");
  }

  if (!hydrated) {
    return (
      <div className="onboarding-stage">
        <div className="sheet onboarding-card">
          <p className="kicker">Opening Ledger</p>
          <h1 className="page-head__title">Bursar setup</h1>
          <p className="muted">Loading your first sheet…</p>
        </div>
      </div>
    );
  }

  const STEPS = ["Income", "Bills", "Plan", "Goals"];

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
                  {([["weekly", "Weekly"], ["biweekly", "Bi-weekly"], ["semimonthly", "Semi-monthly"]] as const).map(([val, lbl]) => (
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
                <details className="cycle-info">
                  <summary><Info size={14} aria-hidden="true" />About pay cycle types</summary>
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
              </div>
              {income.payCycle !== "semimonthly" && (
                <div className="field">
                  <label className="field__label">Most recent paycheck</label>
                  <input
                    className="input"
                    type="date"
                    value={income.lastPaycheckDate}
                    onChange={(e) => setIncome((d) => ({ ...d, lastPaycheckDate: e.target.value }))}
                  />
                  <p className="field__hint">Used to forecast your {income.payCycle === "weekly" ? "weekly" : "bi-weekly"} paycheck dates.</p>
                </div>
              )}
            </div>

            <div className="onboarding-divider">
              <span>or</span>
            </div>

            <div className="field">
              <label className="field__label">Import a saved ledger file</label>
              <p className="field__hint">Pick a .json file exported from Bursar (or Paper &amp; Ink) to skip setup entirely.</p>
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
            <div className="mobile-only-inline" style={{ width: "100%", justifyContent: "flex-end", marginBottom: 8 }}>
              <button type="button" className="btn btn--jump" onClick={() => jumpToAddForm()}>
                + Add bill
              </button>
            </div>
            <div className="ledger-table-wrap-no-line" style={{ borderRadius: "0 0 0 0" }}>
              <table className="ledger-table ledger-table--responsive onboarding-table">
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
                      <td data-label="Notation">
                        <input
                          className="input"
                          placeholder="Bill name"
                          value={b.name}
                          onChange={(e) => setBills((xs) => xs.map((x) => x.id === b.id ? { ...x, name: e.target.value } : x))}
                        />
                      </td>
                      <td className="text-right mono" data-label="Amount">
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
                      <td data-label="Cadence">
                        <select
                          className="select"
                          value={b.cadence}
                          onChange={(e) => setBills((xs) => xs.map((x) => x.id === b.id ? { ...x, cadence: e.target.value as "monthly" | "annual" } : x))}
                        >
                          <option value="monthly">Monthly</option>
                          <option value="annual">Annual</option>
                        </select>
                      </td>
                      <td data-label="Due">
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            className="input input--mono"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="1"
                            value={b.dueDay || ""}
                            style={{ width: "52px", flexShrink: 0 }}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
                              const n = digits === "" ? 0 : Math.min(31, Number(digits));
                              setBills((xs) => xs.map((x) => x.id === b.id ? { ...x, dueDay: n } : x));
                            }}
                            onBlur={() => { if (!b.dueDay || b.dueDay < 1) setBills((xs) => xs.map((x) => x.id === b.id ? { ...x, dueDay: 1 } : x)); }}
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
                          onClick={() => removeBill(b.id)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div id="add-form" className="inline-form inline-form--4col">
              <div className={`field${attemptedBill && !billDraft.name.trim() ? " field--has-error" : ""}`}>
                <label className="field__label" htmlFor="onb-bill-name">New notation</label>
                <input
                  id="onb-bill-name"
                  className="input"
                  placeholder="e.g. Internet"
                  value={billDraft.name}
                  aria-invalid={attemptedBill && !billDraft.name.trim()}
                  onChange={(e) => setBillDraft((d) => ({ ...d, name: e.target.value }))}
                />
                {attemptedBill && !billDraft.name.trim() && (
                  <span className="field__error">Required</span>
                )}
              </div>
              <div className={`field${attemptedBill && billDraft.amount <= 0 ? " field--has-error" : ""}`}>
                <label className="field__label" htmlFor="onb-bill-amount">Amount</label>
                <input
                  id="onb-bill-amount"
                  className="input input--mono"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={billDraft.amount || ""}
                  aria-invalid={attemptedBill && billDraft.amount <= 0}
                  onChange={(e) => setBillDraft((d) => ({ ...d, amount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) }))}
                />
                {attemptedBill && billDraft.amount <= 0 && (
                  <span className="field__error">Must be more than 0</span>
                )}
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="1"
                    value={billDraft.dueDay || ""}
                    style={{ width: "52px", flexShrink: 0 }}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
                      const n = digits === "" ? 0 : Math.min(31, Number(digits));
                      setBillDraft((d) => ({ ...d, dueDay: n }));
                    }}
                    onBlur={() => { if (!billDraft.dueDay || billDraft.dueDay < 1) setBillDraft((d) => ({ ...d, dueDay: 1 })); }}
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
                onClick={addBill}
              >
                Add bill
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
            <div className="mobile-only-inline" style={{ width: "100%", justifyContent: "flex-end", marginBottom: 8 }}>
              <button type="button" className="btn btn--jump" onClick={() => jumpToAddForm()}>
                + Add category
              </button>
            </div>
            <div className="ledger-table-wrap-no-line" style={{ borderRadius: "0 0 0 0" }}>
              <table className="ledger-table ledger-table--responsive onboarding-table">
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
                      <td data-label="Category">
                        <input
                          className="input"
                          placeholder="Category"
                          value={a.name}
                          onChange={(e) => setAllocations((xs) => xs.map((x) => x.id === a.id ? { ...x, name: e.target.value } : x))}
                        />
                      </td>
                      <td data-label="Type">
                        <select
                          className="select"
                          value={a.mode}
                          onChange={(e) => setAllocations((xs) => xs.map((x) => x.id === a.id ? { ...x, mode: e.target.value as "percent" | "fixed" } : x))}
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
                          onClick={() => removeAllocation(a.id)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div id="add-form" className="inline-form">
              <div className={`field${attemptedAlloc && !allocDraft.name.trim() ? " field--has-error" : ""}`}>
                <label className="field__label" htmlFor="onb-alloc-name">New category</label>
                <input
                  id="onb-alloc-name"
                  className="input"
                  placeholder="e.g. Travel fund"
                  value={allocDraft.name}
                  aria-invalid={attemptedAlloc && !allocDraft.name.trim()}
                  onChange={(e) => setAllocDraft((d) => ({ ...d, name: e.target.value }))}
                />
                {attemptedAlloc && !allocDraft.name.trim() && (
                  <span className="field__error">Required</span>
                )}
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
              <div className={`field${attemptedAlloc && allocDraft.value <= 0 ? " field--has-error" : ""}`}>
                <label className="field__label" htmlFor="onb-alloc-value">Value</label>
                <input
                  id="onb-alloc-value"
                  className="input input--mono"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={allocDraft.value || ""}
                  aria-invalid={attemptedAlloc && allocDraft.value <= 0}
                  onChange={(e) => setAllocDraft((d) => ({ ...d, value: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) }))}
                />
                {attemptedAlloc && allocDraft.value <= 0 && (
                  <span className="field__error">Must be more than 0</span>
                )}
              </div>
              <button
                className="btn"
                type="button"
                onClick={addAllocation}
              >
                Add category
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Goals */}
        {step === 3 && (
          <div>
            <p className="kicker">Goals</p>
            <h1 className="page-head__title" style={{ marginBottom: 10 }}>Set your targets</h1>
            <p className="page-head__lead" style={{ marginBottom: 8 }}>
              Optional — add savings targets or debt payoff goals to track alongside your budget.
            </p>
            <p className="field__hint" style={{ marginBottom: 24 }}>
              You can link goals to budget categories and bills from the Goals page after setup.
            </p>
            {goals.length > 0 && (
              <div className="mobile-only-inline" style={{ width: "100%", justifyContent: "flex-end", marginBottom: 8 }}>
                <button type="button" className="btn btn--jump" onClick={() => jumpToAddForm()}>
                  + Add goal
                </button>
              </div>
            )}
            {goals.length > 0 && (
              <div className="ledger-table-wrap-no-line" style={{ borderRadius: "0 0 0 0" }}>
                <table className="ledger-table ledger-table--responsive onboarding-table">
                  <thead>
                    <tr>
                      <th style={{ width: "45%" }}>Goal</th>
                      <th style={{ width: "25%" }}>Type</th>
                      <th className="text-right" style={{ width: "25%" }}>Target</th>
                      <th className="text-tight" />
                    </tr>
                  </thead>
                  <tbody>
                    {goals.map((g) => (
                      <tr key={g.id}>
                        <td data-label="Goal">
                          <input
                            className="input"
                            placeholder="Goal name"
                            value={g.name}
                            onChange={(e) => setGoals((xs) => xs.map((x) => x.id === g.id ? { ...x, name: e.target.value } : x))}
                          />
                        </td>
                        <td data-label="Type">
                          <select
                            className="select"
                            value={g.type}
                            onChange={(e) => setGoals((xs) => xs.map((x) => x.id === g.id ? { ...x, type: e.target.value as "savings" | "debt" } : x))}
                          >
                            <option value="savings">Savings</option>
                            <option value="debt">Debt payoff</option>
                          </select>
                        </td>
                        <td className="text-right mono" data-label="Target">
                          <input
                            className="input input--mono"
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={g.targetAmount || ""}
                            style={{ textAlign: "right" }}
                            onChange={(e) =>
                              setGoals((xs) => xs.map((x) => x.id === g.id ? { ...x, targetAmount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) } : x))
                            }
                          />
                        </td>
                        <td className="text-tight">
                          <button
                            className="btn btn--icon"
                            type="button"
                            aria-label={`Delete ${g.name}`}
                            onClick={() => removeGoal(g.id)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div id="add-form" className={`inline-form${goals.length > 0 ? "" : " inline-form--no-top-border"}`} style={goals.length === 0 ? { borderRadius: 10 } : {}}>
              <div className={`field${attemptedGoal && !goalDraft.name.trim() ? " field--has-error" : ""}`}>
                <label className="field__label" htmlFor="onb-goal-name">Goal name</label>
                <input
                  id="onb-goal-name"
                  className="input"
                  placeholder="e.g. Emergency fund"
                  value={goalDraft.name}
                  aria-invalid={attemptedGoal && !goalDraft.name.trim()}
                  onChange={(e) => setGoalDraft((d) => ({ ...d, name: e.target.value }))}
                />
                {attemptedGoal && !goalDraft.name.trim() && (
                  <span className="field__error">Required</span>
                )}
              </div>
              <div className="field">
                <label className="field__label">Type</label>
                <select
                  className="select"
                  value={goalDraft.type}
                  onChange={(e) => setGoalDraft((d) => ({ ...d, type: e.target.value as "savings" | "debt" }))}
                >
                  <option value="savings">Savings</option>
                  <option value="debt">Debt payoff</option>
                </select>
              </div>
              <div className={`field${attemptedGoal && goalDraft.targetAmount <= 0 ? " field--has-error" : ""}`}>
                <label className="field__label" htmlFor="onb-goal-target">Target ($)</label>
                <input
                  id="onb-goal-target"
                  className="input input--mono"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={goalDraft.targetAmount || ""}
                  aria-invalid={attemptedGoal && goalDraft.targetAmount <= 0}
                  onChange={(e) => setGoalDraft((d) => ({ ...d, targetAmount: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) }))}
                />
                {attemptedGoal && goalDraft.targetAmount <= 0 && (
                  <span className="field__error">Must be more than 0</span>
                )}
              </div>
              <button
                className="btn"
                type="button"
                onClick={addGoal}
              >
                Add goal
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
          {step < 3 ? (
            <button className="btn" type="button" onClick={() => setStep((s) => s + 1)}>
              Continue ›
            </button>
          ) : (
            <button className="btn" type="button" onClick={finish}>
              Open Bursar
            </button>
          )}
        </div>
      </div>
      <UndoToast entry={undo} onDismiss={() => setUndo(null)} />
    </div>
  );
}
