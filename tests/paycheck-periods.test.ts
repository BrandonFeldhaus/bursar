import { expect } from "chai";
import { incomeDatesForMonth, paycheckPeriodsForMonth, monthlyIncomeOf } from "../app/lib/month";
import { makeState, semiIncome, biwIncome, monthlyExpense, annualExpense } from "./helpers";

// All scenarios tested against May 2026 (31 days)
const MAY = "2026-05";

// ─── incomeDatesForMonth ────────────────────────────────────────────────────

describe("incomeDatesForMonth", () => {
  describe("semi-monthly", () => {
    const inc = semiIncome("a", "Job", 2000);

    it("always returns exactly 2 dates", () => {
      expect(incomeDatesForMonth(inc, MAY)).to.have.lengthOf(2);
    });

    it("dates fall on the 1st and 15th", () => {
      const days = incomeDatesForMonth(inc, MAY).map((d) => d.getDate());
      expect(days).to.deep.equal([1, 15]);
    });

    it("works the same in any month", () => {
      const days = incomeDatesForMonth(inc, "2026-02").map((d) => d.getDate());
      expect(days).to.deep.equal([1, 15]);
    });
  });

  describe("bi-weekly — May 2 anchor (3-paycheck month)", () => {
    const inc = biwIncome("a", "Job", 2400, "2026-05-02");

    it("returns 3 dates", () => {
      expect(incomeDatesForMonth(inc, MAY)).to.have.lengthOf(3);
    });

    it("dates fall on the 2nd, 16th, and 30th", () => {
      const days = incomeDatesForMonth(inc, MAY).map((d) => d.getDate());
      expect(days).to.deep.equal([2, 16, 30]);
    });
  });

  describe("bi-weekly — May 9 anchor (2-paycheck month)", () => {
    const inc = biwIncome("a", "Job", 2400, "2026-05-09");

    it("returns 2 dates", () => {
      expect(incomeDatesForMonth(inc, MAY)).to.have.lengthOf(2);
    });

    it("dates fall on the 9th and 23rd", () => {
      const days = incomeDatesForMonth(inc, MAY).map((d) => d.getDate());
      expect(days).to.deep.equal([9, 23]);
    });
  });

  describe("bi-weekly — missing anchor", () => {
    it("returns an empty array", () => {
      const inc = biwIncome("a", "Job", 2400, "");
      expect(incomeDatesForMonth(inc, MAY)).to.have.lengthOf(0);
    });
  });
});

// ─── monthlyIncomeOf ────────────────────────────────────────────────────────

describe("monthlyIncomeOf", () => {
  it("semi-monthly $2000/paycheck → $4,000/month", () => {
    const state = makeState([semiIncome("a", "Job", 2000)]);
    expect(monthlyIncomeOf(state)).to.equal(4000);
  });

  it("bi-weekly $2400/paycheck → $5,200/month (26 × 2400 / 12)", () => {
    const state = makeState([biwIncome("a", "Job", 2400, "2026-05-02")]);
    expect(monthlyIncomeOf(state)).to.be.closeTo(5200, 0.01);
  });

  it("two semi-monthly sources → sums both", () => {
    const state = makeState([semiIncome("a", "Job A", 2000), semiIncome("b", "Job B", 1500)]);
    expect(monthlyIncomeOf(state)).to.equal(7000);
  });

  it("mixed sources → sums semi + bi-weekly correctly", () => {
    const state = makeState([
      semiIncome("a", "Semi", 2000),                    // 2000 × 2   = 4000
      biwIncome("b", "Biw", 1200, "2026-05-02"),        // 1200 × 26/12 = 2600
    ]);
    expect(monthlyIncomeOf(state)).to.be.closeTo(6600, 0.01);
  });
});

// ─── paycheckPeriodsForMonth — scenario A: two semi-monthly ─────────────────

describe("Scenario A — two semi-monthly incomes", () => {
  const state = makeState([
    semiIncome("a", "Income A", 2000),
    semiIncome("b", "Income B", 1500),
  ]);

  it("produces exactly 2 periods", () => {
    expect(paycheckPeriodsForMonth(state, MAY)).to.have.lengthOf(2);
  });

  it("period 1 covers May 1–14", () => {
    const [p] = paycheckPeriodsForMonth(state, MAY);
    expect(p.startDay).to.equal(1);
    expect(p.endDay).to.equal(14);
  });

  it("period 2 covers May 15–31", () => {
    const [, p] = paycheckPeriodsForMonth(state, MAY);
    expect(p.startDay).to.equal(15);
    expect(p.endDay).to.equal(31);
  });

  it("each period receives both paychecks ($3,500 each)", () => {
    paycheckPeriodsForMonth(state, MAY).forEach((p) => {
      expect(p.incomes).to.have.lengthOf(2);
      expect(p.totalIncome).to.equal(3500);
    });
  });

  it("monthly total income is $7,000", () => {
    const total = paycheckPeriodsForMonth(state, MAY).reduce((s, p) => s + p.totalIncome, 0);
    expect(total).to.equal(7000);
  });
});

// ─── Scenario B: one semi-monthly + one bi-weekly (May 2 anchor) ───────────

describe("Scenario B — semi-monthly + bi-weekly (anchor May 2)", () => {
  const state = makeState([
    semiIncome("semi", "Semi Job", 2000),
    biwIncome("biw", "Biweekly Job", 1400, "2026-05-02"),
  ]);
  // Paycheck days: semi=[1,15], biweekly=[2,16,30] → sorted unique: [1,2,15,16,30]

  it("produces 5 periods", () => {
    expect(paycheckPeriodsForMonth(state, MAY)).to.have.lengthOf(5);
  });

  it("paycheck days are [1, 2, 15, 16, 30]", () => {
    const days = paycheckPeriodsForMonth(state, MAY).map((p) => p.paycheckDay);
    expect(days).to.deep.equal([1, 2, 15, 16, 30]);
  });

  it("semi-monthly income lands in exactly 2 periods (days 1 and 15)", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const withSemi = periods.filter((p) => p.incomes.some((i) => i.name === "Semi Job"));
    expect(withSemi.map((p) => p.paycheckDay)).to.deep.equal([1, 15]);
  });

  it("bi-weekly income lands in exactly 3 periods (days 2, 16, 30)", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const withBiw = periods.filter((p) => p.incomes.some((i) => i.name === "Biweekly Job"));
    expect(withBiw.map((p) => p.paycheckDay)).to.deep.equal([2, 16, 30]);
  });

  it("monthly total income: $4,000 semi + $4,200 biweekly = $8,200", () => {
    const total = paycheckPeriodsForMonth(state, MAY).reduce((s, p) => s + p.totalIncome, 0);
    expect(total).to.equal(8200);
  });
});

// ─── Scenario C: two bi-weekly, same anchor ─────────────────────────────────

describe("Scenario C — two bi-weekly incomes, same anchor (May 2)", () => {
  const state = makeState([
    biwIncome("a", "Job A", 2000, "2026-05-02"),
    biwIncome("b", "Job B", 1500, "2026-05-02"),
  ]);
  // Both produce days [2, 16, 30] → union = [2, 16, 30]

  it("produces exactly 3 periods", () => {
    expect(paycheckPeriodsForMonth(state, MAY)).to.have.lengthOf(3);
  });

  it("paycheck days are [2, 16, 30]", () => {
    const days = paycheckPeriodsForMonth(state, MAY).map((p) => p.paycheckDay);
    expect(days).to.deep.equal([2, 16, 30]);
  });

  it("period 1 starts at day 1 (captures any bills before first paycheck)", () => {
    const [p] = paycheckPeriodsForMonth(state, MAY);
    expect(p.startDay).to.equal(1);
  });

  it("each period receives both paychecks ($3,500 each)", () => {
    paycheckPeriodsForMonth(state, MAY).forEach((p) => {
      expect(p.incomes).to.have.lengthOf(2);
      expect(p.totalIncome).to.equal(3500);
    });
  });

  it("monthly total income is $10,500 (3 paydays × $3,500)", () => {
    const total = paycheckPeriodsForMonth(state, MAY).reduce((s, p) => s + p.totalIncome, 0);
    expect(total).to.equal(10500);
  });
});

// ─── Scenario D: two bi-weekly, offset anchors ──────────────────────────────

describe("Scenario D — two bi-weekly incomes, offset anchors (May 2 and May 9)", () => {
  const state = makeState([
    biwIncome("a", "Job A", 2000, "2026-05-02"), // pays: 2, 16, 30
    biwIncome("b", "Job B", 1500, "2026-05-09"), // pays: 9, 23
  ]);
  // Union sorted: [2, 9, 16, 23, 30]

  it("produces 5 periods", () => {
    expect(paycheckPeriodsForMonth(state, MAY)).to.have.lengthOf(5);
  });

  it("paycheck days are [2, 9, 16, 23, 30]", () => {
    const days = paycheckPeriodsForMonth(state, MAY).map((p) => p.paycheckDay);
    expect(days).to.deep.equal([2, 9, 16, 23, 30]);
  });

  it("Job A pays in 3 periods (days 2, 16, 30)", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const withA = periods.filter((p) => p.incomes.some((i) => i.name === "Job A"));
    expect(withA.map((p) => p.paycheckDay)).to.deep.equal([2, 16, 30]);
  });

  it("Job B pays in 2 periods (days 9, 23)", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const withB = periods.filter((p) => p.incomes.some((i) => i.name === "Job B"));
    expect(withB.map((p) => p.paycheckDay)).to.deep.equal([9, 23]);
  });

  it("each period has exactly one income source", () => {
    paycheckPeriodsForMonth(state, MAY).forEach((p) => {
      expect(p.incomes).to.have.lengthOf(1);
    });
  });

  it("monthly total income: $6,000 (Job A) + $3,000 (Job B) = $9,000", () => {
    const total = paycheckPeriodsForMonth(state, MAY).reduce((s, p) => s + p.totalIncome, 0);
    expect(total).to.equal(9000);
  });
});

// ─── Bill distribution across periods ───────────────────────────────────────

describe("Bill distribution across paycheck periods", () => {
  const state = makeState(
    [semiIncome("a", "Job", 2000)],
    [
      monthlyExpense("rent", "Rent", 1200, 1),         // due 1st → period 1
      monthlyExpense("phone", "Phone", 80, 20),         // due 20th → period 2
      annualExpense("ins", "Car Insurance", 1200, 10, 5), // set-aside $100/mo
    ],
  );

  it("Rent (due 1st) falls in period 1", () => {
    const [p1] = paycheckPeriodsForMonth(state, MAY);
    expect(p1.bills.some((b) => b.name === "Rent")).to.be.true;
  });

  it("Phone (due 20th) falls in period 2", () => {
    const [, p2] = paycheckPeriodsForMonth(state, MAY);
    expect(p2.bills.some((b) => b.name === "Phone")).to.be.true;
  });

  it("annual Car Insurance appears in both May and April (set-aside every month)", () => {
    const mayHas = paycheckPeriodsForMonth(state, MAY).some((p) =>
      p.bills.some((b) => b.name === "Car Insurance"),
    );
    const aprHas = paycheckPeriodsForMonth(state, "2026-04").some((p) =>
      p.bills.some((b) => b.name === "Car Insurance"),
    );
    expect(mayHas).to.be.true;
    expect(aprHas).to.be.true;
  });

  it("annual set-aside amount is $100/mo (1/12 of $1,200)", () => {
    const allBills = paycheckPeriodsForMonth(state, MAY).flatMap((p) => p.bills);
    const ins = allBills.find((b) => b.name === "Car Insurance");
    expect(ins).to.exist;
    expect(ins!.amount).to.be.closeTo(100, 0.01);
  });

  it("leftover = income − bills in each period", () => {
    paycheckPeriodsForMonth(state, MAY).forEach((p) => {
      expect(p.leftover).to.be.closeTo(p.totalIncome - p.totalBills, 0.01);
    });
  });
});
