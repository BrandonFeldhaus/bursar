import { expect } from "chai";
import { normalizeParsed } from "../app/lib/budgetStorage";

// normalizeParsed runs on every load and import — these guard the payCycle coercion path.
describe("normalizeParsed — payCycle coercion", () => {
  it("keeps 'monthly' on income sources and preserves the anchor date", () => {
    const state = normalizeParsed({
      incomes: [{ id: "a", name: "Salary", amount: 4000, cadence: "monthly", payCycle: "monthly", lastPaycheckDate: "2026-05-15" }],
    });
    expect(state.incomes[0].payCycle).to.equal("monthly");
    expect(state.incomes[0].lastPaycheckDate).to.equal("2026-05-15");
  });

  it("keeps 'monthly' as the top-level payCycle and settings.payCycleType", () => {
    const state = normalizeParsed({ payCycle: "monthly", settings: { payCycleType: "monthly" } });
    expect(state.payCycle).to.equal("monthly");
    expect(state.settings.payCycleType).to.equal("monthly");
  });

  it("falls back to biweekly for unknown cycles", () => {
    const state = normalizeParsed({
      payCycle: "fortnightly",
      incomes: [{ id: "a", name: "X", amount: 1, cadence: "monthly", payCycle: "quarterly", lastPaycheckDate: "" }],
    });
    expect(state.payCycle).to.equal("biweekly");
    expect(state.incomes[0].payCycle).to.equal("biweekly");
  });
});
