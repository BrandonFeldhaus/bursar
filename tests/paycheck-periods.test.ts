import { expect } from "chai";
import { incomeDatesForMonth, paycheckPeriodsForMonth, monthlyIncomeOf } from "../app/lib/month";
import { makeState, semiIncome, biwIncome, weeklyIncome, monthlyIncome, monthlyExpense, annualExpense } from "./helpers";

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

  describe("weekly — May 1 anchor (5-paycheck month)", () => {
    const inc = weeklyIncome("a", "Job", 1000, "2026-05-01");

    it("returns 5 dates", () => {
      expect(incomeDatesForMonth(inc, MAY)).to.have.lengthOf(5);
    });

    it("dates fall on the 1st, 8th, 15th, 22nd, and 29th", () => {
      const days = incomeDatesForMonth(inc, MAY).map((d) => d.getDate());
      expect(days).to.deep.equal([1, 8, 15, 22, 29]);
    });
  });

  describe("weekly — May 5 anchor (4-paycheck month)", () => {
    const inc = weeklyIncome("a", "Job", 1000, "2026-05-05");

    it("returns 4 dates", () => {
      expect(incomeDatesForMonth(inc, MAY)).to.have.lengthOf(4);
    });

    it("dates fall on the 5th, 12th, 19th, and 26th", () => {
      const days = incomeDatesForMonth(inc, MAY).map((d) => d.getDate());
      expect(days).to.deep.equal([5, 12, 19, 26]);
    });
  });

  describe("weekly — anchor before the month (walks forward from past)", () => {
    const inc = weeklyIncome("a", "Job", 1000, "2026-04-24");

    it("still returns dates in May", () => {
      const days = incomeDatesForMonth(inc, MAY).map((d) => d.getDate());
      expect(days).to.deep.equal([1, 8, 15, 22, 29]);
    });
  });

  describe("weekly — missing anchor", () => {
    it("returns an empty array", () => {
      const inc = weeklyIncome("a", "Job", 1000, "");
      expect(incomeDatesForMonth(inc, MAY)).to.have.lengthOf(0);
    });
  });

  describe("monthly — May 15 anchor", () => {
    const inc = monthlyIncome("a", "Job", 4000, "2026-05-15");

    it("returns exactly 1 date", () => {
      expect(incomeDatesForMonth(inc, MAY)).to.have.lengthOf(1);
    });

    it("date falls on the 15th", () => {
      const days = incomeDatesForMonth(inc, MAY).map((d) => d.getDate());
      expect(days).to.deep.equal([15]);
    });

    it("uses the same day-of-month in months before and after the anchor", () => {
      expect(incomeDatesForMonth(inc, "2026-02").map((d) => d.getDate())).to.deep.equal([15]);
      expect(incomeDatesForMonth(inc, "2026-11").map((d) => d.getDate())).to.deep.equal([15]);
    });
  });

  describe("monthly — day-31 anchor clamps to shorter months", () => {
    const inc = monthlyIncome("a", "Job", 4000, "2026-01-31");

    it("pays on Feb 28 (2026 is not a leap year)", () => {
      expect(incomeDatesForMonth(inc, "2026-02").map((d) => d.getDate())).to.deep.equal([28]);
    });

    it("pays on Apr 30", () => {
      expect(incomeDatesForMonth(inc, "2026-04").map((d) => d.getDate())).to.deep.equal([30]);
    });

    it("pays on May 31", () => {
      expect(incomeDatesForMonth(inc, MAY).map((d) => d.getDate())).to.deep.equal([31]);
    });
  });

  describe("monthly — missing anchor", () => {
    it("returns an empty array", () => {
      const inc = monthlyIncome("a", "Job", 4000, "");
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

  it("weekly $1000/paycheck → $4,333.33/month (52 × 1000 / 12)", () => {
    const state = makeState([weeklyIncome("a", "Job", 1000, "2026-05-01")]);
    expect(monthlyIncomeOf(state)).to.be.closeTo(4333.33, 0.01);
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

  it("mixed sources → sums weekly + bi-weekly + semi correctly", () => {
    const state = makeState([
      semiIncome("a", "Semi", 2000),                    // 4000
      biwIncome("b", "Biw", 1200, "2026-05-02"),        // 2600
      weeklyIncome("c", "Wk", 600, "2026-05-01"),       // 600 × 52/12 = 2600
    ]);
    expect(monthlyIncomeOf(state)).to.be.closeTo(9200, 0.01);
  });

  it("monthly $4000/paycheck → $4,000/month (12 × 4000 / 12)", () => {
    const state = makeState([monthlyIncome("a", "Job", 4000, "2026-05-15")]);
    expect(monthlyIncomeOf(state)).to.equal(4000);
  });

  it("mixed sources → sums monthly + bi-weekly correctly", () => {
    const state = makeState([
      monthlyIncome("a", "Salary", 3000, "2026-05-01"),  // 3000
      biwIncome("b", "Biw", 1200, "2026-05-02"),          // 1200 × 26/12 = 2600
    ]);
    expect(monthlyIncomeOf(state)).to.be.closeTo(5600, 0.01);
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
  // Raw paycheck days: semi=[1,15], biweekly=[2,16,30] → sorted unique: [1,2,15,16,30]
  // After merging days within 2 of each other: [1,15,30] → 3 periods

  it("produces 3 periods (day-1 and day-2 merged; day-15 and day-16 merged)", () => {
    expect(paycheckPeriodsForMonth(state, MAY)).to.have.lengthOf(3);
  });

  it("merged period start days are [1, 15, 30]", () => {
    const days = paycheckPeriodsForMonth(state, MAY).map((p) => p.paycheckDay);
    expect(days).to.deep.equal([1, 15, 30]);
  });

  it("semi-monthly income lands in the first 2 periods (days 1 and 15 within their ranges)", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const withSemi = periods.filter((p) => p.incomes.some((i) => i.name === "Semi Job"));
    expect(withSemi).to.have.lengthOf(2);
  });

  it("bi-weekly income lands in all 3 periods (days 2, 16, 30 each within their period range)", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const withBiw = periods.filter((p) => p.incomes.some((i) => i.name === "Biweekly Job"));
    expect(withBiw).to.have.lengthOf(3);
  });

  it("first merged period income = $3,400 (semi $2,000 + biweekly $1,400)", () => {
    const [p1] = paycheckPeriodsForMonth(state, MAY);
    expect(p1.totalIncome).to.equal(3400);
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
  // 3 paycheck periods; last extends into June (anchor May 2 → next paycheck Jun 13, overhang 12 days)

  it("produces exactly 3 periods", () => {
    expect(paycheckPeriodsForMonth(state, MAY)).to.have.lengthOf(3);
  });

  it("paycheck days are [2, 16, 30]", () => {
    const days = paycheckPeriodsForMonth(state, MAY).map((p) => p.paycheckDay);
    expect(days).to.deep.equal([2, 16, 30]);
  });

  it("period 1 starts on the first paycheck day (day 2), not day 1", () => {
    const [p] = paycheckPeriodsForMonth(state, MAY);
    expect(p.startDay).to.equal(2);
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

  it("last period (3rd paycheck, May 30) extends label into June", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const last = periods[periods.length - 1];
    expect(last.paycheckDay).to.equal(30);
    expect(last.label).to.include("Jun");
  });

  it("bills due May 1 go to April's last period, not May's first", () => {
    const stateWithRent = makeState(
      [biwIncome("a", "Job", 3500, "2026-05-02")],
      [monthlyExpense("rent", "Rent", 1200, 1)],
    );
    const mayPeriods = paycheckPeriodsForMonth(stateWithRent, MAY);
    const aprPeriods = paycheckPeriodsForMonth(stateWithRent, "2026-04");
    expect(mayPeriods[0].bills.some((b) => b.name === "Rent")).to.be.false;
    expect(aprPeriods[aprPeriods.length - 1].bills.some((b) => b.name === "Rent")).to.be.true;
  });
});

// ─── Scenario D: two bi-weekly, offset anchors ──────────────────────────────

describe("Scenario D — two bi-weekly incomes, offset anchors (May 2 and May 9)", () => {
  const state = makeState([
    biwIncome("a", "Job A", 2000, "2026-05-02"), // pays: 2, 16, 30
    biwIncome("b", "Job B", 1500, "2026-05-09"), // pays: 9, 23
  ]);
  // Union sorted: [2, 9, 16, 23, 30]
  // Last period (May 30) extends to Jun 5 — next paychecks Jun 6 (Job B) and Jun 13 (Job A), first = Jun 6

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

  it("last period (May 30) label extends into June", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const last = periods[periods.length - 1];
    expect(last.paycheckDay).to.equal(30);
    expect(last.label).to.include("Jun");
  });
});

// ─── Scenario E: weekly income, 5-paycheck month ─────────────────────────────

describe("Scenario E — single weekly income (anchor May 1, 5 paychecks)", () => {
  const state = makeState([weeklyIncome("a", "Weekly Job", 1000, "2026-05-01")]);
  // Pays on May 1, 8, 15, 22, 29 → 5 periods

  it("produces 5 periods", () => {
    expect(paycheckPeriodsForMonth(state, MAY)).to.have.lengthOf(5);
  });

  it("paycheck days are [1, 8, 15, 22, 29]", () => {
    const days = paycheckPeriodsForMonth(state, MAY).map((p) => p.paycheckDay);
    expect(days).to.deep.equal([1, 8, 15, 22, 29]);
  });

  it("each period covers 7 days except the last (which extends into June)", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    expect(periods[0].endDay - periods[0].startDay + 1).to.equal(7); // 1–7
    expect(periods[1].endDay - periods[1].startDay + 1).to.equal(7); // 8–14
    expect(periods[2].endDay - periods[2].startDay + 1).to.equal(7); // 15–21
    expect(periods[3].endDay - periods[3].startDay + 1).to.equal(7); // 22–28
    expect(periods[4].startDay).to.equal(29);                         // 29–31 in May
    expect(periods[4].endDay).to.equal(31);
  });

  it("each period receives exactly one paycheck of $1,000", () => {
    paycheckPeriodsForMonth(state, MAY).forEach((p) => {
      expect(p.incomes).to.have.lengthOf(1);
      expect(p.totalIncome).to.equal(1000);
    });
  });

  it("monthly total income is $5,000 (5 paychecks × $1,000)", () => {
    const total = paycheckPeriodsForMonth(state, MAY).reduce((s, p) => s + p.totalIncome, 0);
    expect(total).to.equal(5000);
  });

  it("last period label extends into June (overhang)", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const last = periods[periods.length - 1];
    expect(last.label).to.include("Jun");
  });
});

// ─── Scenario F: weekly + bi-weekly mixed ─────────────────────────────────────

describe("Scenario F — weekly (May 1) + bi-weekly (May 2)", () => {
  const state = makeState([
    weeklyIncome("w", "Weekly Job", 800, "2026-05-01"),   // pays: 1, 8, 15, 22, 29
    biwIncome("b", "Biweekly Job", 1500, "2026-05-02"),   // pays: 2, 16, 30
  ]);
  // Raw paycheck days: [1, 2, 8, 15, 16, 22, 29, 30]
  // After 2-day merge: [1, 8, 15, 22, 29] → 5 periods
  // The biweekly's day-2 lands inside [1,7], day-16 inside [15,21], day-30 inside [29,31]

  it("merges into 5 periods", () => {
    expect(paycheckPeriodsForMonth(state, MAY)).to.have.lengthOf(5);
  });

  it("paycheck days are [1, 8, 15, 22, 29]", () => {
    const days = paycheckPeriodsForMonth(state, MAY).map((p) => p.paycheckDay);
    expect(days).to.deep.equal([1, 8, 15, 22, 29]);
  });

  it("weekly income pays in all 5 periods", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const withWeekly = periods.filter((p) => p.incomes.some((i) => i.name === "Weekly Job"));
    expect(withWeekly).to.have.lengthOf(5);
  });

  it("bi-weekly income pays in 3 periods (days 2, 16, 30 land in periods 1, 3, 5)", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const withBiw = periods.filter((p) => p.incomes.some((i) => i.name === "Biweekly Job"));
    expect(withBiw.map((p) => p.paycheckDay)).to.deep.equal([1, 15, 29]);
  });

  it("monthly total income: $4,000 weekly + $4,500 biweekly = $8,500", () => {
    const total = paycheckPeriodsForMonth(state, MAY).reduce((s, p) => s + p.totalIncome, 0);
    expect(total).to.equal(8500);
  });
});

// ─── Scenario G: single monthly income ───────────────────────────────────────

describe("Scenario G — single monthly income (anchor May 15)", () => {
  const state = makeState(
    [monthlyIncome("m", "Salary", 4000, "2026-05-15")],
    [
      monthlyExpense("rent", "Rent", 1200, 1),      // due 1st → before payday → previous month's period
      monthlyExpense("internet", "Internet", 60, 10), // due 10th → before payday → previous month's period
      monthlyExpense("phone", "Phone", 80, 20),      // due 20th → this period
    ],
  );
  // Pays on May 15 only → 1 period: May 15–31, overhanging into June through the 14th

  it("produces exactly 1 period", () => {
    expect(paycheckPeriodsForMonth(state, MAY)).to.have.lengthOf(1);
  });

  it("period starts on payday (15) and runs to month end (31)", () => {
    const [p] = paycheckPeriodsForMonth(state, MAY);
    expect(p.paycheckDay).to.equal(15);
    expect(p.startDay).to.equal(15);
    expect(p.endDay).to.equal(31);
  });

  it("receives a single $4,000 paycheck", () => {
    const [p] = paycheckPeriodsForMonth(state, MAY);
    expect(p.incomes).to.have.lengthOf(1);
    expect(p.totalIncome).to.equal(4000);
  });

  it("label extends into June (next payday is Jun 15, so overhang runs through Jun 14)", () => {
    const [p] = paycheckPeriodsForMonth(state, MAY);
    expect(p.label).to.include("Jun 14");
  });

  it("Phone (due 20th) belongs to May's period", () => {
    const [p] = paycheckPeriodsForMonth(state, MAY);
    expect(p.bills.some((b) => b.name === "Phone")).to.be.true;
  });

  it("Rent (due 1st) is not in May's period but in April's last period", () => {
    const [may] = paycheckPeriodsForMonth(state, MAY);
    const apr = paycheckPeriodsForMonth(state, "2026-04");
    expect(may.bills.some((b) => b.name === "Rent" && b.date.getMonth() === 4)).to.be.false;
    expect(apr[apr.length - 1].bills.some((b) => b.name === "Rent" && b.date.getMonth() === 4)).to.be.true;
  });

  it("June's Internet bill (due 10th) appears once in May's period as overhang", () => {
    const [p] = paycheckPeriodsForMonth(state, MAY);
    const internet = p.bills.filter((b) => b.name === "Internet");
    expect(internet).to.have.lengthOf(1);
    expect(internet[0].id).to.include("overhang");
    expect(internet[0].date.getMonth()).to.equal(5); // June
  });

  it("totalBills = Phone $80 + overhang Rent $1,200 + overhang Internet $60 = $1,340", () => {
    const [p] = paycheckPeriodsForMonth(state, MAY);
    expect(p.totalBills).to.be.closeTo(1340, 0.01);
    expect(p.leftover).to.be.closeTo(4000 - 1340, 0.01);
  });
});

// ─── Scenario H: monthly + bi-weekly ─────────────────────────────────────────

describe("Scenario H — monthly (May 1) + bi-weekly (May 2)", () => {
  const state = makeState([
    monthlyIncome("m", "Salary", 3000, "2026-05-01"),     // pays: 1
    biwIncome("b", "Biweekly Job", 1500, "2026-05-02"),   // pays: 2, 16, 30
  ]);
  // Raw paycheck days: [1, 2, 16, 30] → after 2-day merge: [1, 16, 30] → 3 periods

  it("merges into 3 periods", () => {
    expect(paycheckPeriodsForMonth(state, MAY)).to.have.lengthOf(3);
  });

  it("paycheck days are [1, 16, 30]", () => {
    const days = paycheckPeriodsForMonth(state, MAY).map((p) => p.paycheckDay);
    expect(days).to.deep.equal([1, 16, 30]);
  });

  it("monthly income lands only in the first period", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const withSalary = periods.filter((p) => p.incomes.some((i) => i.name === "Salary"));
    expect(withSalary.map((p) => p.paycheckDay)).to.deep.equal([1]);
  });

  it("bi-weekly income lands in all 3 periods", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const withBiw = periods.filter((p) => p.incomes.some((i) => i.name === "Biweekly Job"));
    expect(withBiw).to.have.lengthOf(3);
  });

  it("first period income = $4,500 (monthly $3,000 + biweekly $1,500)", () => {
    const [p1] = paycheckPeriodsForMonth(state, MAY);
    expect(p1.totalIncome).to.equal(4500);
  });

  it("monthly total income: $3,000 + $4,500 = $7,500", () => {
    const total = paycheckPeriodsForMonth(state, MAY).reduce((s, p) => s + p.totalIncome, 0);
    expect(total).to.equal(7500);
  });

  it("no overhang: next month's first payday is Jun 1, so the last period ends May 31", () => {
    const periods = paycheckPeriodsForMonth(state, MAY);
    const last = periods[periods.length - 1];
    expect(last.label).to.not.include("Jun");
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
