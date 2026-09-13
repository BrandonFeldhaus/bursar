import { expect } from "chai";
import { computeAllocations } from "../app/lib/allocations";
import { paycheckPeriodsForMonth } from "../app/lib/month";
import {
  fundingAmountLabel,
  fundingCandidates,
  goalFundingSources,
  goalFundingTotal,
  paychecksToGo,
  sourceAmount,
} from "../app/lib/goalFunding";
import type { Goal } from "../app/lib/budgetStorage";
import { annualExpense, biwIncome, fixedCat, makeState, monthlyExpense, percentCat, semiIncome } from "./helpers";

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
  const candidates = fundingCandidates(state, "2026-05");

  it("averages every category and bill per paycheck over a year of periods", () => {
    // Semi-monthly pay → 24 periods. Savings is 320 in the rent period and 20% of (3000 − 40 − 100) = 572
    // in the other; rent and gym each land once a month, so they're spread across two paychecks.
    expect(candidates.map((c) => `${c.kind}:${c.id}=${c.perPaycheck}`)).to.deep.equal([
      "category:savings=446",
      "category:gas=100",
      "bill:rent=650",
      "bill:gym=20",
    ]);
  });

  it("gives no bill a zero amount just because it isn't due in the current period", () => {
    expect(candidates.filter((c) => c.kind === "bill").every((c) => c.perPaycheck > 0)).to.equal(true);
  });

  it("spreads a monthly bill across every paycheck when there are 26 a year", () => {
    const biweekly = makeState([biwIncome("b", "Job", 2000, "2026-05-08")], [monthlyExpense("rent", "Rent", 1300, 5)]);
    const [rent] = fundingCandidates(biweekly, "2026-05");
    expect(rent.perPaycheck).to.be.closeTo((1300 * 12) / 26, 1e-9);
  });

  it("spreads an annual bill across the year's paychecks", () => {
    const annual = makeState([semiIncome("inc", "Salary", 3000)], [annualExpense("ins", "Insurance", 1200, 10, 3)]);
    const [ins] = fundingCandidates(annual, "2026-05");
    expect(ins.perPaycheck).to.be.closeTo(1200 / 24, 1e-9);
    expect(ins.bill).to.deep.equal({ amount: 1200, cadence: "annual" });
  });

  it("labels a bill as billed and a category per paycheck", () => {
    const byId = (id: string) => candidates.find((c) => c.id === id)!;
    expect(fundingAmountLabel(byId("rent"))).to.equal("$1,300.00/mo");
    expect(fundingAmountLabel(byId("savings"))).to.equal("$446.00");
    expect(fundingAmountLabel({ kind: "bill", id: "x", name: "X", perPaycheck: 50, bill: { amount: 1200, cadence: "annual" } })).to.equal("$1,200.00/yr");
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
