import { expect } from "chai";
import { computeAllocations, isBudgetOverdrawn } from "../app/lib/allocations";
import { monthlyIncomeOf } from "../app/lib/month";
import { makeState, semiIncome, biwIncome, percentCat, fixedCat } from "./helpers";

// ─── computeAllocations ─────────────────────────────────────────────────────

describe("computeAllocations — percent only", () => {
  const cats = [
    percentCat("a", "Savings", 25),
    percentCat("b", "Spending", 50),
    percentCat("c", "Buffer", 25),
  ];

  it("splits $1,000 leftover into $250 / $500 / $250", () => {
    const result = computeAllocations(1000, cats);
    expect(result[0].amount).to.equal(250);
    expect(result[1].amount).to.equal(500);
    expect(result[2].amount).to.equal(250);
  });

  it("amounts sum to the full leftover when percentages total 100%", () => {
    const result = computeAllocations(1000, cats);
    const sum = result.reduce((s, r) => s + r.amount, 0);
    expect(sum).to.equal(1000);
  });

  it("scales proportionally with different leftover amounts", () => {
    const result = computeAllocations(2400, cats);
    expect(result[0].amount).to.equal(600);
    expect(result[1].amount).to.equal(1200);
    expect(result[2].amount).to.equal(600);
  });

  it("handles $0 leftover — all amounts are $0", () => {
    const result = computeAllocations(0, cats);
    result.forEach((r) => expect(r.amount).to.equal(0));
  });

  it("returns empty array when no categories are defined", () => {
    expect(computeAllocations(1000, [])).to.have.lengthOf(0);
  });
});

describe("computeAllocations — fixed only", () => {
  const cats = [
    fixedCat("a", "Rent", 1200),
    fixedCat("b", "Savings", 300),
  ];

  it("fixed amounts are always their exact value regardless of leftover", () => {
    const result = computeAllocations(5000, cats);
    expect(result[0].amount).to.equal(1200);
    expect(result[1].amount).to.equal(300);
  });

  it("fixed amounts still show when leftover is less than the fixed total", () => {
    // leftover $500, but fixed $1500 — amount still reflects the fixed value
    const result = computeAllocations(500, cats);
    expect(result[0].amount).to.equal(1200);
    expect(result[1].amount).to.equal(300);
  });
});

describe("computeAllocations — mixed fixed + percent", () => {
  it("percent categories apply to leftover minus fixed total", () => {
    const cats = [
      fixedCat("a", "Fixed Savings", 300),
      percentCat("b", "Spending", 50),
      percentCat("c", "Buffer", 50),
    ];
    // leftover=$1000, fixedTotal=$300, base=$700
    // Spending: 50% × $700 = $350; Buffer: 50% × $700 = $350
    const result = computeAllocations(1000, cats);
    expect(result[0].amount).to.equal(300);
    expect(result[1].amount).to.equal(350);
    expect(result[2].amount).to.equal(350);
  });

  it("percent portion is $0 when fixed items consume the full leftover", () => {
    const cats = [
      fixedCat("a", "Fixed", 1200),
      percentCat("b", "Spending", 50),
    ];
    // leftover=$1000, fixedTotal=$1200, base=max(0,-200)=0
    const result = computeAllocations(1000, cats);
    expect(result[0].amount).to.equal(1200);
    expect(result[1].amount).to.equal(0);
  });

  it("100% percent + fixed items does not cause amounts to exceed leftover incorrectly", () => {
    const cats = [
      fixedCat("a", "Fixed", 500),
      percentCat("b", "Savings", 25),
      percentCat("c", "Spending", 50),
      percentCat("d", "Buffer", 25),
    ];
    // leftover=$2000, base=$1500
    // Savings=$375, Spending=$750, Buffer=$375
    const result = computeAllocations(2000, cats);
    expect(result[0].amount).to.equal(500);
    expect(result[1].amount).to.be.closeTo(375, 0.01);
    expect(result[2].amount).to.be.closeTo(750, 0.01);
    expect(result[3].amount).to.be.closeTo(375, 0.01);
  });
});

// ─── isBudgetOverdrawn ───────────────────────────────────────────────────────

describe("isBudgetOverdrawn", () => {
  it("100% percent + no fixed → not overdrawn", () => {
    expect(isBudgetOverdrawn(100, 0, 5000)).to.be.false;
  });

  it("100% percent + fixed items within income → not overdrawn", () => {
    expect(isBudgetOverdrawn(100, 500, 5000)).to.be.false;
  });

  it("percent > 100% → overdrawn", () => {
    expect(isBudgetOverdrawn(110, 0, 5000)).to.be.true;
  });

  it("fixed total exceeds monthly income → overdrawn", () => {
    expect(isBudgetOverdrawn(80, 6000, 5000)).to.be.true;
  });

  it("both percent and fixed within bounds → not overdrawn", () => {
    expect(isBudgetOverdrawn(75, 1000, 5000)).to.be.false;
  });

  it("no income and no fixed → not overdrawn", () => {
    expect(isBudgetOverdrawn(0, 0, 0)).to.be.false;
  });

  it("no income but has fixed → not flagged (income=0 skips the fixed check)", () => {
    // monthlyIncome=0 means we can't evaluate fixed overflow
    expect(isBudgetOverdrawn(0, 500, 0)).to.be.false;
  });
});

// ─── monthlyIncome × allocation end-to-end ───────────────────────────────────

describe("Monthly income feeds allocation correctly", () => {
  it("two semi-monthly $2k → $4k/month → 25% savings = $1,000", () => {
    const state = makeState([semiIncome("a", "Job", 2000)]);
    const monthly = monthlyIncomeOf(state);           // $4,000
    const [savings] = computeAllocations(monthly, [percentCat("a", "Savings", 25)]);
    expect(savings.amount).to.equal(1000);
  });

  it("bi-weekly $2,400 → ~$5,200/month → 50% spending ≈ $2,600", () => {
    const state = makeState([biwIncome("a", "Job", 2400, "2026-05-02")]);
    const monthly = monthlyIncomeOf(state);           // ~$5,200
    const [spending] = computeAllocations(monthly, [percentCat("a", "Spending", 50)]);
    expect(spending.amount).to.be.closeTo(2600, 0.01);
  });

  it("mixed semi + biweekly income → correct combined monthly → correct allocation", () => {
    const state = makeState([
      semiIncome("a", "Semi", 2000),      // $4,000/mo
      biwIncome("b", "Biw", 1200, "2026-05-02"), // $2,600/mo
    ]);
    const monthly = monthlyIncomeOf(state);           // $6,600
    const cats = [
      fixedCat("x", "Rent", 1200),
      percentCat("y", "Savings", 20),
    ];
    const result = computeAllocations(monthly, cats);
    // base = $6,600 − $1,200 = $5,400; savings = 20% × $5,400 = $1,080
    expect(result[0].amount).to.equal(1200);
    expect(result[1].amount).to.be.closeTo(1080, 0.01);
  });
});
