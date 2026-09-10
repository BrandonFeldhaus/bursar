import { expect } from "chai";
import { readFileSync } from "node:fs";
import path from "node:path";
import { defaultBudget, normalizeParsed } from "../app/lib/budgetStorage";
import { sampleData } from "../app/lib/sampleData";
import { currentMonthKey, paycheckPeriodsForMonth } from "../app/lib/month";

const legacyExport = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures", "scenario-a-two-semimonthly.json"), "utf8"),
);

// ─── meta.hints / meta.demo ─────────────────────────────────────────────────

describe("normalizeParsed meta defaults", () => {
  it("defaults meta.hints to [] for a legacy export without the field", () => {
    expect(legacyExport.data.meta).to.not.have.property("hints");
    expect(normalizeParsed(legacyExport.data).meta.hints).to.deep.equal([]);
  });

  it("defaults meta.demo to false for a legacy export without the field", () => {
    expect(legacyExport.data.meta).to.not.have.property("demo");
    expect(normalizeParsed(legacyExport.data).meta.demo).to.equal(false);
  });

  it("defaults both on a fresh store", () => {
    const fresh = defaultBudget();
    expect(fresh.meta.hints).to.deep.equal([]);
    expect(fresh.meta.demo).to.equal(false);
  });

  it("keeps dismissed hint ids and the demo flag", () => {
    const state = normalizeParsed({ meta: { hints: ["income", "overview-goals"], demo: true } });
    expect(state.meta.hints).to.deep.equal(["income", "overview-goals"]);
    expect(state.meta.demo).to.equal(true);
  });

  it("drops hint ids that are not strings and treats a non-boolean demo as false", () => {
    const state = normalizeParsed({ meta: { hints: ["a", 3, null, "b"], demo: "yes" } });
    expect(state.meta.hints).to.deep.equal(["a", "b"]);
    expect(state.meta.demo).to.equal(false);
  });
});

// ─── sampleData ─────────────────────────────────────────────────────────────

describe("sampleData", () => {
  const now = new Date(2026, 8, 9, 12, 0, 0); // Sep 9, 2026, local

  it("passes through normalizeParsed unchanged", () => {
    const sample = sampleData(now);
    const roundTripped = normalizeParsed(JSON.parse(JSON.stringify(sample)));
    expect(roundTripped).to.deep.equal(sample);
  });

  it("is marked as demo data with no dismissed hints", () => {
    const sample = sampleData(now);
    expect(sample.meta.demo).to.equal(true);
    expect(sample.meta.hints).to.deep.equal([]);
  });

  it("contains the bundled household", () => {
    const sample = sampleData(now);
    expect(sample.incomes.map((i) => i.name)).to.deep.equal(["Day job"]);
    expect(sample.recurringExpenses.map((e) => e.name)).to.deep.equal(["Rent", "Utilities", "Internet", "Phone", "Car insurance"]);
    expect(sample.budgetCategories.map((c) => c.name)).to.deep.equal(["Savings", "Spending", "Gas", "Buffer"]);
    expect(sample.goals.map((g) => g.name)).to.deep.equal(["Emergency fund"]);
    expect(sample.lockedMonths).to.deep.equal([]);
  });

  it("anchors the paycheck to the given day so the current month has paycheck periods", () => {
    const sample = sampleData(now);
    expect(sample.incomes[0].lastPaycheckDate).to.equal("2026-09-09");
    const periods = paycheckPeriodsForMonth(sample, "2026-09");
    expect(periods.map((p) => p.paycheckDay)).to.deep.equal([9, 23]);
  });

  it("defaults to today", () => {
    expect(sampleData().meta.createdAt.slice(0, 7)).to.equal(currentMonthKey().slice(0, 7));
  });
});
