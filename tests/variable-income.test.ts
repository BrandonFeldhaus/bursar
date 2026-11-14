import { expect } from "chai";
import { readFileSync } from "node:fs";
import path from "node:path";
import { computeAllocations } from "../app/lib/allocations";
import { normalizeParsed, type BudgetState, type Goal, type Income } from "../app/lib/budgetStorage";
import { fundingCandidates } from "../app/lib/goalFunding";
import { paycheckAmount, paycheckPeriodsForMonth, periodSummariesForMonth, withoutActuals } from "../app/lib/month";
import { snapshotForMonth, viewStateForMonth } from "../app/lib/monthView";
import { recentActualsAverage, setPaycheckActual } from "../app/lib/paycheckActuals";
import { biwIncome, fixedCat, makeState, monthlyExpense, percentCat, semiIncome } from "./helpers";

const MAY = "2026-05";

function withActuals(inc: Income, actuals: { date: string; amount: number }[]): Income {
  return { ...inc, actuals };
}

function goal(id: string, links: Partial<Pick<Goal, "linkedBudgetCategoryIds" | "linkedExpenseIds" | "appliedPeriods">>): Goal {
  return {
    id,
    name: id,
    type: "savings",
    targetAmount: 10000,
    linkedBudgetCategoryIds: links.linkedBudgetCategoryIds ?? [],
    linkedExpenseIds: links.linkedExpenseIds ?? [],
    manualAdjustments: [],
    appliedPeriods: links.appliedPeriods ?? [],
  };
}

function loadFixture(name: string): any {
  return JSON.parse(readFileSync(path.join(__dirname, "fixtures", name), "utf8")).data;
}

// Semi-monthly $3,000 (May 1 and May 15); rent $1,300 due the 5th; Savings 20% after $100 fixed Gas.
function baseState(actuals: { date: string; amount: number }[] = []): BudgetState {
  return makeState(
    [withActuals(semiIncome("inc", "Gig work", 3000), actuals)],
    [monthlyExpense("rent", "Rent", 1300, 5)],
    [percentCat("savings", "Savings", 20), fixedCat("gas", "Gas", 100)],
  );
}

// ─── paycheckAmount ─────────────────────────────────────────────────────────

describe("paycheckAmount", () => {
  const inc = withActuals(semiIncome("inc", "Gig", 1000), [{ date: "2026-05-01", amount: 1250 }]);

  it("returns the actual for a date that has one", () => {
    expect(paycheckAmount(inc, "2026-05-01")).to.deep.equal({ amount: 1250, estimated: false });
  });

  it("falls back to the estimate otherwise", () => {
    expect(paycheckAmount(inc, "2026-05-15")).to.deep.equal({ amount: 1000, estimated: true });
  });

  it("treats a $0 actual as a real paycheck, not a missing one", () => {
    const zero = withActuals(inc, [{ date: "2026-05-15", amount: 0 }]);
    expect(paycheckAmount(zero, "2026-05-15")).to.deep.equal({ amount: 0, estimated: false });
  });

  it("works on incomes stored before actuals existed (no field)", () => {
    expect(paycheckAmount(semiIncome("old", "Old", 800), "2026-05-01")).to.deep.equal({ amount: 800, estimated: true });
  });
});

// ─── Periods ────────────────────────────────────────────────────────────────

describe("paycheckPeriodsForMonth — actuals", () => {
  it("uses the actual when present and the estimate otherwise", () => {
    const [first, second] = paycheckPeriodsForMonth(baseState([{ date: "2026-05-01", amount: 2500 }]), MAY);
    expect(first.totalIncome).to.equal(2500);
    expect(second.totalIncome).to.equal(3000);
  });

  it("marks each income item with estimated / estimate / its date", () => {
    const [first, second] = paycheckPeriodsForMonth(baseState([{ date: "2026-05-01", amount: 2500 }]), MAY);
    expect(first.incomes[0]).to.include({ incomeId: "inc", dateISO: "2026-05-01", amount: 2500, estimate: 3000, estimated: false, hasActuals: true });
    // Its source has an actual elsewhere, so this unentered paycheck reads as an estimate ("est.").
    expect(second.incomes[0]).to.include({ dateISO: "2026-05-15", amount: 3000, estimate: 3000, estimated: true, hasActuals: true });
  });

  it("a source with no actuals at all has hasActuals false", () => {
    const [first] = paycheckPeriodsForMonth(baseState(), MAY);
    expect(first.incomes[0]).to.include({ estimated: true, hasActuals: false });
  });

  it("leftover and allocations follow the actual", () => {
    const [first] = paycheckPeriodsForMonth(baseState([{ date: "2026-05-01", amount: 2500 }]), MAY);
    expect(first.leftover).to.equal(1200); // 2500 − 1300
    const allocs = computeAllocations(first.leftover, baseState().budgetCategories);
    expect(allocs.find((a) => a.id === "savings")?.amount).to.be.closeTo(220, 1e-9); // (1200 − 100) × 20%
    expect(allocs.find((a) => a.id === "gas")?.amount).to.equal(100);
  });

  it("periodSummariesForMonth reads actuals too", () => {
    // Fixed halves: May 1 (actual 2,500) and May 15 (estimate 3,000) both fall in 1–15.
    const [first] = periodSummariesForMonth(baseState([{ date: "2026-05-01", amount: 2500 }]), MAY);
    expect(first.totalIncome).to.equal(5500);
    expect(first.incomes.map((i) => i.estimated)).to.deep.equal([false, true]);
  });

  it("an actual on a date that is no longer a payday changes nothing", () => {
    const periods = paycheckPeriodsForMonth(baseState([{ date: "2026-05-02", amount: 1 }]), MAY);
    expect(periods.map((p) => p.totalIncome)).to.deep.equal([3000, 3000]);
  });

  it("actuals survive adding a second income source that shifts period ordinals", () => {
    // Bi-weekly alone (May 9, May 23): May 23 is in the "second" period.
    const gig = withActuals(biwIncome("gig", "Gig", 700, "2026-05-09"), [{ date: "2026-05-23", amount: 910 }]);
    const alone = makeState([gig]);
    const before = paycheckPeriodsForMonth(alone, MAY).find((p) => p.incomes.some((i) => i.dateISO === "2026-05-23"))!;
    expect(before.key).to.equal("second");
    expect(before.totalIncome).to.equal(910);

    // Add a semi-monthly salary (1st, 15th): paydays 1, 9, 15, 23 → May 23 moves to the "fourth" period.
    const both = makeState([semiIncome("sal", "Salary", 2000), gig]);
    const after = paycheckPeriodsForMonth(both, MAY).find((p) => p.incomes.some((i) => i.dateISO === "2026-05-23"))!;
    expect(after.key).to.equal("fourth");
    expect(after.incomes.find((i) => i.incomeId === "gig")).to.include({ amount: 910, estimated: false });
  });
});

// ─── Snapshots ──────────────────────────────────────────────────────────────

describe("snapshots — actuals are facts", () => {
  const JULY = "2026-07";
  const CUR = "2026-09";

  function fixture(): BudgetState {
    const live = makeState([withActuals(semiIncome("inc", "Gig", 3000), [{ date: "2026-07-01", amount: 2800 }])]);
    // July's snapshot had a lower estimate (and, illegally, a stale actual that must be ignored).
    const july = makeState([withActuals(semiIncome("inc", "Gig", 2500), [{ date: "2026-07-15", amount: 1 }])]);
    live.lockedMonths = [snapshotForMonth(july, JULY, "2026-08-01T00:00:00.000Z")];
    return live;
  }

  it("snapshotForMonth strips actuals", () => {
    expect(fixture().lockedMonths[0].incomes[0].actuals).to.deep.equal([]);
  });

  it("a past month keeps its snapshot estimate but shows live actuals", () => {
    const view = viewStateForMonth(fixture(), JULY, CUR);
    expect(view.incomes[0].amount).to.equal(2500);
    const [first, second] = paycheckPeriodsForMonth(view, JULY);
    expect(first.incomes[0]).to.include({ amount: 2800, estimate: 2500, estimated: false });
    expect(second.incomes[0]).to.include({ amount: 2500, estimated: true });
  });

  it("an income deleted live has no actuals in the past month", () => {
    const s = fixture();
    s.incomes = [];
    expect(viewStateForMonth(s, JULY, CUR).incomes[0].actuals).to.deep.equal([]);
  });

  it("normalizeParsed empties actuals found in a stored snapshot", () => {
    const parsed = normalizeParsed({
      lockedMonths: [{ monthKey: JULY, incomes: [{ id: "inc", name: "Gig", amount: 1, payCycle: "semimonthly", actuals: [{ date: "2026-07-01", amount: 5 }] }] }],
    });
    expect(parsed.lockedMonths[0].incomes[0].actuals).to.deep.equal([]);
  });
});

// ─── setPaycheckActual ──────────────────────────────────────────────────────

describe("setPaycheckActual", () => {
  // Savings is ticked in May's first period at its estimate-based amount: (1700 − 100) × 20% = 320.
  function ticked(): BudgetState {
    const s = baseState();
    s.goals = [
      goal("pct", { linkedBudgetCategoryIds: ["savings"], appliedPeriods: [{ periodId: "2026-05-first", amount: 320 }, { periodId: "2026-05-second", amount: 580 }] }),
      goal("fixed", { linkedBudgetCategoryIds: ["gas"], appliedPeriods: [{ periodId: "2026-05-first", amount: 100 }] }),
      goal("unticked", { linkedBudgetCategoryIds: ["savings"] }),
    ];
    return s;
  }

  it("writes the actual and keeps actuals sorted by date", () => {
    let s = setPaycheckActual(baseState(), "inc", "2026-05-15", 2900, MAY);
    s = setPaycheckActual(s, "inc", "2026-05-01", 2500, MAY);
    expect(s.incomes[0].actuals).to.deep.equal([{ date: "2026-05-01", amount: 2500 }, { date: "2026-05-15", amount: 2900 }]);
  });

  it("replaces the actual for the same date", () => {
    let s = setPaycheckActual(baseState(), "inc", "2026-05-01", 2500, MAY);
    s = setPaycheckActual(s, "inc", "2026-05-01", 2600, MAY);
    expect(s.incomes[0].actuals).to.deep.equal([{ date: "2026-05-01", amount: 2600 }]);
  });

  it("clearing reverts the paycheck to the estimate", () => {
    let s = setPaycheckActual(baseState(), "inc", "2026-05-01", 2500, MAY);
    s = setPaycheckActual(s, "inc", "2026-05-01", null, MAY);
    expect(s.incomes[0].actuals).to.deep.equal([]);
    expect(paycheckPeriodsForMonth(s, MAY)[0].totalIncome).to.equal(3000);
  });

  it("returns the same state when nothing changes", () => {
    const s = baseState();
    expect(setPaycheckActual(s, "nope", "2026-05-01", 10, MAY)).to.equal(s);
    expect(setPaycheckActual(s, "inc", "2026-05-01", null, MAY)).to.equal(s);
  });

  it("updates the stored amount of a goal ticked in that period", () => {
    const s = setPaycheckActual(ticked(), "inc", "2026-05-01", 2500, MAY);
    const pct = s.goals.find((g) => g.id === "pct")!;
    expect(pct.appliedPeriods.find((p) => p.periodId === "2026-05-first")?.amount).to.be.closeTo(220, 1e-9);
    // Other periods and unticked goals are left alone; a fixed source doesn't move.
    expect(pct.appliedPeriods.find((p) => p.periodId === "2026-05-second")?.amount).to.equal(580);
    expect(s.goals.find((g) => g.id === "fixed")!.appliedPeriods[0].amount).to.equal(100);
    expect(s.goals.find((g) => g.id === "unticked")!.appliedPeriods).to.deep.equal([]);
  });

  it("clearing the actual puts the ticked amount back", () => {
    let s = setPaycheckActual(ticked(), "inc", "2026-05-01", 2500, MAY);
    s = setPaycheckActual(s, "inc", "2026-05-01", null, MAY);
    expect(s.goals.find((g) => g.id === "pct")!.appliedPeriods[0].amount).to.be.closeTo(320, 1e-9);
  });

  it("keeps the tick (at $0) when the leftover no longer funds the goal", () => {
    const s = setPaycheckActual(ticked(), "inc", "2026-05-01", 1000, MAY); // leftover −300
    expect(s.goals.find((g) => g.id === "pct")!.appliedPeriods[0]).to.deep.equal({ periodId: "2026-05-first", amount: 0 });
  });

  it("recomputes a past month against its snapshot's definitions", () => {
    const s = ticked();
    // May's snapshot had Savings at 10%: (1700 − 100) × 10% = 160 was ticked then.
    const may = baseState();
    may.budgetCategories = [percentCat("savings", "Savings", 10), fixedCat("gas", "Gas", 100)];
    may.goals = [goal("pct", { linkedBudgetCategoryIds: ["savings"] })];
    s.lockedMonths = [snapshotForMonth(may, MAY)];
    const next = setPaycheckActual(s, "inc", "2026-05-01", 2500, "2026-09");
    expect(next.goals.find((g) => g.id === "pct")!.appliedPeriods[0].amount).to.be.closeTo(110, 1e-9); // (1200 − 100) × 10%
  });
});

// ─── fundingCandidates ──────────────────────────────────────────────────────

describe("fundingCandidates — estimates only", () => {
  it("ignores actuals when averaging per paycheck", () => {
    const withActual = setPaycheckActual(baseState(), "inc", "2026-05-01", 500, MAY);
    const a = fundingCandidates(withActual, MAY).find((c) => c.id === "savings")!.perPaycheck;
    const b = fundingCandidates(baseState(), MAY).find((c) => c.id === "savings")!.perPaycheck;
    expect(a).to.equal(b);
  });

  it("withoutActuals drops every income's actuals and nothing else", () => {
    const s = withoutActuals(baseState([{ date: "2026-05-01", amount: 1 }]));
    expect(s.incomes[0]).to.include({ amount: 3000, name: "Gig work" });
    expect(s.incomes[0].actuals).to.deep.equal([]);
  });
});

// ─── recentActualsAverage ───────────────────────────────────────────────────

describe("recentActualsAverage", () => {
  const dates = ["2026-03-06", "2026-03-20", "2026-04-03", "2026-04-17", "2026-05-01", "2026-05-15", "2026-05-29"];
  const inc = withActuals(semiIncome("inc", "Gig", 1000), dates.map((date, i) => ({ date, amount: 100 * (i + 1) })));

  it("is null with fewer than three actuals", () => {
    expect(recentActualsAverage(withActuals(inc, inc.actuals!.slice(0, 2)), "2026-12-31")).to.equal(null);
  });

  it("averages at most the six most recent", () => {
    // 200 … 700 → 450
    expect(recentActualsAverage(inc, "2026-12-31")).to.deep.equal({ count: 6, average: 450 });
  });

  it("ignores actuals dated after today", () => {
    // Up to May 1: 100 … 500 → 300
    expect(recentActualsAverage(inc, "2026-05-01")).to.deep.equal({ count: 5, average: 300 });
  });
});

// ─── normalizeParsed ────────────────────────────────────────────────────────

describe("normalizeParsed — paycheck actuals", () => {
  it("an old fixture loads unchanged: every field kept, defaults added, periods at estimates", () => {
    const raw = loadFixture("scenario-e-full-household.json");
    const state = normalizeParsed(raw);
    state.incomes.forEach((inc, i) => {
      expect(inc).to.deep.equal({ ...raw.incomes[i], actuals: [] });
    });
    const periods = paycheckPeriodsForMonth(state, MAY);
    periods.flatMap((p) => p.incomes).forEach((item) => {
      expect(item.estimated).to.equal(true);
      expect(item.amount).to.equal(item.estimate);
    });
    expect(periods.map((p) => p.totalIncome)).to.deep.equal(paycheckPeriodsForMonth(withoutActuals(state), MAY).map((p) => p.totalIncome));
  });

  it("drops malformed actuals, dedupes by date (last wins) and sorts", () => {
    const state = normalizeParsed({
      incomes: [{
        id: "a", name: "Gig", amount: 500, cadence: "monthly", payCycle: "weekly", lastPaycheckDate: "2026-05-01",
        actuals: [
          { date: "2026-05-15", amount: 610 },
          { date: "2026-05-01", amount: 480 },
          { date: "2026-05-15", amount: 620 },
          { date: "May 8", amount: 500 },
          { date: "2026-05-08", amount: -5 },
          { date: "2026-05-22", amount: "abc" },
          { date: "2026-05-29", amount: "" },
          { date: "2026-05-30" },
          { amount: 100 },
          null,
          "2026-05-08",
          { date: "2026-06-05", amount: "455.5" },
          { date: "2026-06-12", amount: 0 },
        ],
      }],
    });
    expect(state.incomes[0].actuals).to.deep.equal([
      { date: "2026-05-01", amount: 480 },
      { date: "2026-05-15", amount: 620 },
      { date: "2026-06-05", amount: 455.5 },
      { date: "2026-06-12", amount: 0 },
    ]);
  });

  it("a non-array actuals field becomes []", () => {
    const state = normalizeParsed({ incomes: [{ id: "a", name: "X", amount: 1, payCycle: "semimonthly", actuals: { "2026-05-01": 5 } }] });
    expect(state.incomes[0].actuals).to.deep.equal([]);
  });
});

// ─── Scenario F — gig economy, with a varying freelance income ─────────────

describe("scenario F — gig economy with a varying freelance income", () => {
  const state = normalizeParsed(loadFixture("scenario-f-gig-economy.json"));
  const freelanceA = state.incomes.find((i) => i.id === "income-f2")!;

  it("loads Freelance A's actuals; the other sources have none", () => {
    expect(freelanceA.actuals).to.have.lengthOf(4);
    expect(state.incomes.filter((i) => (i.actuals ?? []).length > 0)).to.have.lengthOf(1);
  });

  it("May income uses Freelance A's actuals (May 2, 16, 30) and every other paycheck's estimate", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const total = periods.reduce((s, p) => s + p.totalIncome, 0);
    // W2 2 × 2,200 + Freelance A 1,040 + 760 + 1,125 + Freelance B 2 × 600
    expect(total).to.equal(8525);
    const estimateTotal = paycheckPeriodsForMonth(withoutActuals(state), MAY).reduce((s, p) => s + p.totalIncome, 0);
    expect(estimateTotal).to.equal(8300);
    const items = periods.flatMap((p) => p.incomes).filter((i) => i.incomeId === "income-f2");
    expect(items.map((i) => [i.dateISO, i.amount, i.estimated])).to.deep.equal([
      ["2026-05-02", 1040, false],
      ["2026-05-16", 760, false],
      ["2026-05-30", 1125, false],
    ]);
  });

  it("suggests the average of the recent actuals", () => {
    expect(recentActualsAverage(freelanceA, "2026-05-31")).to.deep.equal({ count: 4, average: 936.25 });
  });
});
