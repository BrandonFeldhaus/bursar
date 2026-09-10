import { expect } from "chai";
import { computeAllocations } from "../app/lib/allocations";
import { paycheckPeriodsForMonth } from "../app/lib/month";
import {
  currentPeriod,
  fundingCandidates,
  goalFundingSources,
  goalFundingTotal,
  paychecksToGo,
  sourceAmount,
} from "../app/lib/goalFunding";
import type { Goal } from "../app/lib/budgetStorage";
import { fixedCat, makeState, monthlyExpense, percentCat, semiIncome } from "./helpers";

// Semi-monthly $3,000 on May 1 and May 15 2026; rent is due on the 5th, gym on the 20th.
const state = makeState(
  [semiIncome("inc", "Salary", 3000)],
  [monthlyExpense("rent", "Rent", 1300, 5), monthlyExpense("gym", "Gym", 40, 20)],
  [percentCat("savings", "Savings", 20), fixedCat("gas", "Gas", 100)],
);
const [first, second] = paycheckPeriodsForMonth(state, "2026-05");
const firstAllocs = computeAllocations(first.leftover, state.budgetCategories);

function goal(links: Partial<Pick<Goal, "linkedBudgetCategoryIds" | "linkedExpenseIds">>): Goal {
  return {
    id: "g",
    name: "Goal",
    type: "savings",
    targetAmount: 1000,
    linkedBudgetCategoryIds: links.linkedBudgetCategoryIds ?? [],
    linkedExpenseIds: links.linkedExpenseIds ?? [],
    manualAdjustments: [],
    appliedPeriods: [],
  };
}

describe("goalFunding — per-source amounts", () => {
  it("a category contributes its allocation for the period", () => {
    // leftover 3000 − 1300 = 1700; fixed 100 comes out first; Savings gets 20% of 1600.
    expect(first.leftover).to.equal(1700);
    expect(sourceAmount("category", "savings", firstAllocs, first.bills)).to.equal(320);
    expect(sourceAmount("category", "gas", firstAllocs, first.bills)).to.equal(100);
  });

  it("a bill contributes its amount only in the period it is due", () => {
    expect(sourceAmount("bill", "rent", firstAllocs, first.bills)).to.equal(1300);
    const secondAllocs = computeAllocations(second.leftover, state.budgetCategories);
    expect(sourceAmount("bill", "rent", secondAllocs, second.bills)).to.equal(0);
    expect(sourceAmount("bill", "gym", secondAllocs, second.bills)).to.equal(40);
  });

  it("a mix of categories and bills adds up", () => {
    const g = goal({ linkedBudgetCategoryIds: ["savings", "gas"], linkedExpenseIds: ["rent"] });
    expect(goalFundingTotal(g, firstAllocs, first.bills)).to.equal(320 + 100 + 1300);
  });

  it("a source that no longer exists contributes 0", () => {
    const g = goal({ linkedBudgetCategoryIds: ["deleted-category", "savings"], linkedExpenseIds: ["deleted-bill"] });
    expect(sourceAmount("category", "deleted-category", firstAllocs, first.bills)).to.equal(0);
    expect(sourceAmount("bill", "deleted-bill", firstAllocs, first.bills)).to.equal(0);
    expect(goalFundingTotal(g, firstAllocs, first.bills)).to.equal(320);
  });

  it("a goal with no links contributes 0", () => {
    expect(goalFundingTotal(goal({}), firstAllocs, first.bills)).to.equal(0);
  });
});

describe("goalFunding — candidates and selected sources", () => {
  const candidates = fundingCandidates(firstAllocs, first.bills, state.recurringExpenses);

  it("lists every category and every bill with its amount for the period", () => {
    expect(candidates.map((c) => `${c.kind}:${c.id}=${c.amount}`)).to.deep.equal([
      "category:savings=320",
      "category:gas=100",
      "bill:rent=1300",
      "bill:gym=0",
    ]);
  });

  it("returns the goal's linked sources, categories first, and drops missing ids", () => {
    const g = goal({ linkedBudgetCategoryIds: ["gas", "gone"], linkedExpenseIds: ["gym", "rent"] });
    expect(goalFundingSources(g, candidates).map((s) => s.id)).to.deep.equal(["gas", "gym", "rent"]);
  });
});

describe("paychecksToGo", () => {
  it("rounds up remaining / per-paycheck", () => {
    expect(paychecksToGo(900, 250)).to.equal(4);
    expect(paychecksToGo(1000, 250)).to.equal(4);
  });

  it("is null when the rate is 0 or nothing remains", () => {
    expect(paychecksToGo(900, 0)).to.equal(null);
    expect(paychecksToGo(0, 250)).to.equal(null);
    expect(paychecksToGo(-5, 250)).to.equal(null);
  });
});

describe("currentPeriod", () => {
  it("returns the period of the current month that contains today", () => {
    const p = currentPeriod(state, new Date(2026, 4, 20));
    expect(p?.monthKey).to.equal("2026-05");
    expect(p?.key).to.equal("second");
  });

  it("falls back to last month's last period before this month's first payday", () => {
    const biweekly = makeState([{ id: "b", name: "Job", amount: 1000, cadence: "monthly", payCycle: "biweekly", lastPaycheckDate: "2026-05-08" }]);
    // June 2026 paydays: 5th and 19th → June 3 still belongs to May's last period.
    const p = currentPeriod(biweekly, new Date(2026, 5, 3));
    expect(p?.monthKey).to.equal("2026-05");
    expect(p?.index).to.equal(p?.total);
  });
});
