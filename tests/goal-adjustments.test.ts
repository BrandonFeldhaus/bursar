import { expect } from "chai";
import { formatAdjustmentDate, sortAdjustmentsForDisplay, type ManualAdjustment } from "../app/lib/goalAdjustments";
import { normalizeParsed } from "../app/lib/budgetStorage";

// ─── sortAdjustmentsForDisplay ──────────────────────────────────────────────

function adj(id: string, amount: number, date?: string): ManualAdjustment {
  return { id, amount, date };
}

describe("sortAdjustmentsForDisplay", () => {
  it("orders dated adjustments newest first", () => {
    const sorted = sortAdjustmentsForDisplay([
      adj("a", 100, "2026-05-01"),
      adj("b", 200, "2026-07-15"),
      adj("c", 300, "2026-06-10"),
    ]);
    expect(sorted.map((a) => a.id)).to.deep.equal(["b", "c", "a"]);
  });

  it("puts later insertions first within the same date", () => {
    const sorted = sortAdjustmentsForDisplay([
      adj("first", 100, "2026-07-22"),
      adj("second", 200, "2026-07-22"),
    ]);
    expect(sorted.map((a) => a.id)).to.deep.equal(["second", "first"]);
  });

  it("sinks undated legacy entries below dated ones, keeping their original order", () => {
    const sorted = sortAdjustmentsForDisplay([
      adj("legacy1", 50),
      adj("dated", 100, "2026-01-01"),
      adj("legacy2", 75),
    ]);
    expect(sorted.map((a) => a.id)).to.deep.equal(["dated", "legacy1", "legacy2"]);
  });

  it("does not mutate the input array", () => {
    const input = [adj("a", 100, "2026-05-01"), adj("b", 200, "2026-07-15")];
    sortAdjustmentsForDisplay(input);
    expect(input.map((a) => a.id)).to.deep.equal(["a", "b"]);
  });
});

// ─── formatAdjustmentDate ───────────────────────────────────────────────────

describe("formatAdjustmentDate", () => {
  const today = new Date(2026, 6, 22); // Jul 22, 2026

  it("omits the year for current-year dates", () => {
    expect(formatAdjustmentDate("2026-07-22", today)).to.equal("Jul 22");
  });

  it("appends the year for other years", () => {
    expect(formatAdjustmentDate("2025-12-31", today)).to.equal("Dec 31, 2025");
  });

  it("falls back to an em dash for malformed dates", () => {
    expect(formatAdjustmentDate("not-a-date", today)).to.equal("—");
  });
});

// ─── normalizeParsed — adjustment dates ─────────────────────────────────────

describe("normalizeParsed — manual adjustment dates", () => {
  function stateWithAdjustments(manualAdjustments: any[]) {
    return normalizeParsed({
      goals: [
        {
          id: "g1",
          name: "Emergency fund",
          type: "savings",
          targetAmount: 1000,
          linkedBudgetCategoryIds: [],
          linkedExpenseIds: [],
          manualAdjustments,
          appliedPeriods: [],
        },
      ],
    });
  }

  it("keeps a valid YYYY-MM-DD date", () => {
    const state = stateWithAdjustments([{ id: "a1", amount: 100, date: "2026-07-22" }]);
    expect(state.goals[0].manualAdjustments[0].date).to.equal("2026-07-22");
  });

  it("drops malformed dates", () => {
    const state = stateWithAdjustments([
      { id: "a1", amount: 100, date: "July 22" },
      { id: "a2", amount: 200, date: 20260722 },
    ]);
    expect(state.goals[0].manualAdjustments[0].date).to.equal(undefined);
    expect(state.goals[0].manualAdjustments[1].date).to.equal(undefined);
  });

  it("leaves legacy entries without a date undated", () => {
    const state = stateWithAdjustments([{ id: "a1", amount: 100, note: "old entry" }]);
    const a = state.goals[0].manualAdjustments[0];
    expect(a.date).to.equal(undefined);
    expect(a.amount).to.equal(100);
    expect(a.note).to.equal("old entry");
  });
});
