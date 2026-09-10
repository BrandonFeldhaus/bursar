import { expect } from "chai";
import { backfillSnapshots, snapshotForMonth, upsertSnapshot, viewStateForMonth } from "../app/lib/monthView";
import { normalizeParsed, type BudgetState, type Goal } from "../app/lib/budgetStorage";
import { saveState } from "../app/lib/storage";
import { currentMonthKey } from "../app/lib/month";
import { makeState, monthlyExpense, percentCat, semiIncome } from "./helpers";

const CUR = "2026-09";
const PAST = "2026-07";

function goal(id: string, name: string, targetAmount: number, facts: Partial<Pick<Goal, "appliedPeriods" | "manualAdjustments">> = {}): Goal {
  return {
    id,
    name,
    type: "savings",
    targetAmount,
    linkedBudgetCategoryIds: [],
    linkedExpenseIds: [],
    manualAdjustments: facts.manualAdjustments ?? [],
    appliedPeriods: facts.appliedPeriods ?? [],
  };
}

/** Live state plus a July snapshot whose definitions differ from live. */
function fixture(): BudgetState {
  const live = makeState(
    [semiIncome("inc-live", "Salary", 3000)],
    [
      { ...monthlyExpense("rent", "Rent", 1300, 1), paidPeriods: ["2026-07-first", "2026-09-first"] },
      monthlyExpense("gym", "Gym", 40, 5), // added after July
    ],
    [percentCat("c1", "Savings", 20)],
  );
  live.goals = [
    goal("g1", "Fund", 5000, {
      appliedPeriods: [{ periodId: "2026-07-first", amount: 100 }],
      manualAdjustments: [{ id: "a1", amount: 50, date: "2026-07-20" }],
    }),
  ];

  const julyDefinitions = makeState(
    [semiIncome("inc-old", "Old salary", 2500)],
    [
      { ...monthlyExpense("rent", "Rent", 1200, 1), paidPeriods: ["stale"] },
      monthlyExpense("cable", "Cable", 80, 10), // deleted live after July
    ],
    [percentCat("c1", "Savings", 10)],
  );
  julyDefinitions.goals = [
    goal("g1", "Fund", 4000, { appliedPeriods: [{ periodId: "stale", amount: 1 }] }),
    goal("g2", "Trip", 1000), // deleted live after July
  ];

  live.lockedMonths = [snapshotForMonth(julyDefinitions, PAST, "2026-08-01T00:00:00.000Z")];
  return live;
}

// ─── viewStateForMonth ──────────────────────────────────────────────────────

describe("viewStateForMonth", () => {
  it("returns live state for the current month", () => {
    const live = fixture();
    expect(viewStateForMonth(live, CUR, CUR)).to.equal(live);
  });

  it("returns live state for a future month", () => {
    const live = fixture();
    expect(viewStateForMonth(live, "2026-12", CUR)).to.equal(live);
  });

  it("returns live state for a past month that has no snapshot", () => {
    const live = fixture();
    expect(viewStateForMonth(live, "2026-06", CUR)).to.equal(live);
  });

  it("takes incomes, bills, categories and goal targets from the snapshot", () => {
    const view = viewStateForMonth(fixture(), PAST, CUR);
    expect(view.incomes.map((i) => i.name)).to.deep.equal(["Old salary"]);
    expect(view.recurringExpenses.find((e) => e.id === "rent")?.amount).to.equal(1200);
    expect(view.budgetCategories[0].value).to.equal(10);
    expect(view.goals.find((g) => g.id === "g1")?.targetAmount).to.equal(4000);
  });

  it("reads paidPeriods from live state, matched by id", () => {
    const view = viewStateForMonth(fixture(), PAST, CUR);
    expect(view.recurringExpenses.find((e) => e.id === "rent")?.paidPeriods).to.deep.equal(["2026-07-first", "2026-09-first"]);
  });

  it("reads appliedPeriods and manualAdjustments from live state, matched by id", () => {
    const view = viewStateForMonth(fixture(), PAST, CUR);
    const g1 = view.goals.find((g) => g.id === "g1")!;
    expect(g1.appliedPeriods).to.deep.equal([{ periodId: "2026-07-first", amount: 100 }]);
    expect(g1.manualAdjustments).to.deep.equal([{ id: "a1", amount: 50, date: "2026-07-20" }]);
  });

  it("does not show an expense that exists live but not in the snapshot", () => {
    const view = viewStateForMonth(fixture(), PAST, CUR);
    expect(view.recurringExpenses.map((e) => e.id)).to.not.include("gym");
  });

  it("still shows an expense that was deleted live, with paidPeriods []", () => {
    const view = viewStateForMonth(fixture(), PAST, CUR);
    const cable = view.recurringExpenses.find((e) => e.id === "cable");
    expect(cable?.amount).to.equal(80);
    expect(cable?.paidPeriods).to.deep.equal([]);
  });

  it("gives a goal that was deleted live empty facts", () => {
    const view = viewStateForMonth(fixture(), PAST, CUR);
    const g2 = view.goals.find((g) => g.id === "g2")!;
    expect(g2.targetAmount).to.equal(1000);
    expect(g2.appliedPeriods).to.deep.equal([]);
    expect(g2.manualAdjustments).to.deep.equal([]);
  });

  it("keeps live lockedMonths and does not mutate the live state", () => {
    const live = fixture();
    const before = JSON.stringify(live);
    const view = viewStateForMonth(live, PAST, CUR);
    expect(view.lockedMonths).to.equal(live.lockedMonths);
    expect(JSON.stringify(live)).to.equal(before);
  });
});

// ─── snapshotForMonth / upsertSnapshot ──────────────────────────────────────

describe("snapshotForMonth", () => {
  it("stores definitions only — facts are written as empty arrays", () => {
    const snap = snapshotForMonth(fixture(), CUR, "2026-09-09T00:00:00.000Z");
    expect(snap.monthKey).to.equal(CUR);
    expect(snap.lockedAt).to.equal("2026-09-09T00:00:00.000Z");
    expect(snap.incomes.map((i) => i.id)).to.deep.equal(["inc-live"]);
    expect(snap.recurringExpenses.map((e) => e.id)).to.deep.equal(["rent", "gym"]);
    expect(snap.recurringExpenses.every((e) => e.paidPeriods?.length === 0)).to.equal(true);
    expect(snap.goals[0].appliedPeriods).to.deep.equal([]);
    expect(snap.goals[0].manualAdjustments).to.deep.equal([]);
    expect(snap.goals[0].targetAmount).to.equal(5000);
  });

  it("copies rather than shares the live objects", () => {
    const live = fixture();
    const snap = snapshotForMonth(live, CUR);
    expect(snap.recurringExpenses[0]).to.not.equal(live.recurringExpenses[0]);
    expect(snap.goals[0]).to.not.equal(live.goals[0]);
    expect(snap.incomes[0]).to.not.equal(live.incomes[0]);
  });
});

describe("upsertSnapshot", () => {
  it("adds a snapshot for a month that has none and leaves other months untouched", () => {
    const live = fixture();
    const july = live.lockedMonths[0];
    const next = upsertSnapshot(live, CUR, "2026-09-09T00:00:00.000Z");
    expect(next.lockedMonths.map((lm) => lm.monthKey)).to.deep.equal([PAST, CUR]);
    expect(next.lockedMonths[0]).to.equal(july);
    expect(live.lockedMonths).to.have.lengthOf(1);
  });

  it("replaces an existing snapshot for that month only", () => {
    const live = fixture();
    const july = live.lockedMonths[0];
    const once = upsertSnapshot(live, CUR, "2026-09-01T00:00:00.000Z");
    once.recurringExpenses = once.recurringExpenses.map((e) => (e.id === "rent" ? { ...e, amount: 1400 } : e));
    const twice = upsertSnapshot(once, CUR, "2026-09-09T00:00:00.000Z");
    expect(twice.lockedMonths).to.have.lengthOf(2);
    expect(twice.lockedMonths.find((lm) => lm.monthKey === PAST)).to.equal(july);
    const cur = twice.lockedMonths.find((lm) => lm.monthKey === CUR)!;
    expect(cur.lockedAt).to.equal("2026-09-09T00:00:00.000Z");
    expect(cur.recurringExpenses.find((e) => e.id === "rent")?.amount).to.equal(1400);
  });

  it("tolerates a state whose lockedMonths is missing", () => {
    const live = fixture();
    const broken = { ...live, lockedMonths: undefined as unknown as BudgetState["lockedMonths"] };
    expect(upsertSnapshot(broken, CUR).lockedMonths.map((lm) => lm.monthKey)).to.deep.equal([CUR]);
  });
});

// ─── backfillSnapshots ──────────────────────────────────────────────────────

describe("backfillSnapshots", () => {
  it("snapshots every past month since createdAt that lacks one", () => {
    const live = fixture();
    live.meta.createdAt = "2026-05-20T00:00:00.000Z";
    const july = live.lockedMonths[0];
    const next = backfillSnapshots(live, CUR);
    expect(next.lockedMonths.map((lm) => lm.monthKey).sort()).to.deep.equal(["2026-05", "2026-06", PAST, "2026-08"]);
    expect(next.lockedMonths.find((lm) => lm.monthKey === PAST)).to.equal(july);
    expect(next.lockedMonths.find((lm) => lm.monthKey === "2026-08")?.recurringExpenses.map((e) => e.id)).to.deep.equal(["rent", "gym"]);
  });

  it("never snapshots the current month", () => {
    const live = fixture();
    live.meta.createdAt = "2026-08-01T00:00:00.000Z";
    expect(backfillSnapshots(live, CUR).lockedMonths.map((lm) => lm.monthKey)).to.deep.equal([PAST, "2026-08"]);
  });
});

// ─── saveState (storage shim) ───────────────────────────────────────────────

describe("saveState", () => {
  const store = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
  let hadWindow: PropertyDescriptor | undefined;
  let hadStorage: PropertyDescriptor | undefined;

  before(() => {
    hadWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    hadStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true, writable: true });
    Object.defineProperty(globalThis, "localStorage", { value: fakeLocalStorage, configurable: true, writable: true });
  });

  after(() => {
    if (hadWindow) Object.defineProperty(globalThis, "window", hadWindow);
    else delete (globalThis as { window?: unknown }).window;
    if (hadStorage) Object.defineProperty(globalThis, "localStorage", hadStorage);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it("upserts the current month's snapshot and leaves other months' snapshots untouched", () => {
    const live = fixture();
    saveState(live);
    const saved = JSON.parse(store.get("budgetApp:v1")!) as BudgetState;
    const cur = currentMonthKey();
    expect(saved.lockedMonths.map((lm) => lm.monthKey)).to.deep.equal([PAST, cur]);
    expect(saved.lockedMonths[0]).to.deep.equal(JSON.parse(JSON.stringify(live.lockedMonths[0])));
    const snap = saved.lockedMonths[1];
    expect(snap.recurringExpenses.map((e) => e.id)).to.deep.equal(["rent", "gym"]);
    expect(snap.recurringExpenses.every((e) => e.paidPeriods?.length === 0)).to.equal(true);
    // live facts are saved untouched
    expect(saved.recurringExpenses[0].paidPeriods).to.deep.equal(["2026-07-first", "2026-09-first"]);
  });
});

// ─── normalizeLockedMonths (through normalizeParsed) ────────────────────────

describe("normalizeLockedMonths", () => {
  it("accepts legacy snapshots that still contain paidPeriods and goal facts, and empties them", () => {
    const legacy = {
      meta: { onboardingComplete: true, version: 1, createdAt: "2026-01-01T00:00:00.000Z" },
      incomes: [],
      recurringExpenses: [],
      lockedMonths: [
        {
          monthKey: "2026-03",
          lockedAt: "2026-04-01T00:00:00.000Z",
          incomes: [{ id: "i", name: "Job", amount: 2000, cadence: "monthly", payCycle: "bogus", lastPaycheckDate: "" }],
          recurringExpenses: [{ id: "rent", name: "Rent", amount: 1000, cadence: "monthly", dueDay: 1, paidPeriods: ["2026-03-first"] }],
          budgetCategories: [{ id: "c", name: "Savings", mode: "percent", value: 20 }],
          goals: [
            {
              id: "g",
              name: "Fund",
              type: "savings",
              targetAmount: 100,
              linkedBudgetCategoryIds: [],
              linkedExpenseIds: [],
              appliedPeriods: [{ periodId: "2026-03-first", amount: 20 }],
              manualAdjustments: [{ id: "a", amount: 5 }],
            },
          ],
        },
      ],
    };
    const state = normalizeParsed(legacy);
    expect(state.lockedMonths).to.have.lengthOf(1);
    const snap = state.lockedMonths[0];
    expect(snap.monthKey).to.equal("2026-03");
    expect(snap.lockedAt).to.equal("2026-04-01T00:00:00.000Z");
    expect(snap.incomes[0].payCycle).to.equal("biweekly");
    expect(snap.recurringExpenses[0].amount).to.equal(1000);
    expect(snap.recurringExpenses[0].paidPeriods).to.deep.equal([]);
    expect(snap.budgetCategories[0].name).to.equal("Savings");
    expect(snap.goals[0].targetAmount).to.equal(100);
    expect(snap.goals[0].appliedPeriods).to.deep.equal([]);
    expect(snap.goals[0].manualAdjustments).to.deep.equal([]);
  });

  it("drops snapshots without a monthKey", () => {
    const state = normalizeParsed({ lockedMonths: [{ lockedAt: "x" }, { monthKey: "2026-02" }] });
    expect(state.lockedMonths.map((lm) => lm.monthKey)).to.deep.equal(["2026-02"]);
  });
});
