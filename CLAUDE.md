# Bursar — CLAUDE.md

A paycheck-period budgeting app built with Next.js 15 (static export). All data lives in `localStorage`; there is no backend.

## Commands

```bash
npm run dev      # dev server (Turbopack)
npm run build    # static export → out/
npm test         # Mocha test suite (tsx/cjs loader)
npx tsc --noEmit # type-check only
```

Tests use Mocha + Chai. The test runner is configured in `.mocharc.js` to pick up `tests/**/*.test.ts` via tsx.

## Architecture

### Pages (`app/`)
| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Home — paycheck period cards for the selected month |
| `/income` | `app/income/page.tsx` | Add/edit income sources |
| `/expenses` | `app/expenses/page.tsx` | Add/edit recurring bills; calendar view |
| `/budget` | `app/budget/page.tsx` | Allocation plan (percent + fixed categories) |
| `/settings` | `app/settings/page.tsx` | Export/import JSON, reset onboarding |
| `/onboarding` | `app/onboarding/page.tsx` | 3-step setup: Income → Bills → Plan |

### Core lib (`app/lib/`)
| File | What it does |
|---|---|
| `budgetStorage.ts` | **Source of truth** for all types (`PayCycle`, `Income`, `RecurringExpense`, `BudgetState`), localStorage read/write (`loadBudget`, `saveBudget`), and `normalizeParsed` which coerces any stored/imported JSON to a valid state |
| `month.ts` | Period generation logic — `incomeDatesForMonth`, `paycheckPeriodsForMonth`, `monthlyIncomeOf`, and all date helpers |
| `allocations.ts` | `computeAllocations`, `isBudgetOverdrawn` |
| `storage.ts` | Thin re-export shim over `budgetStorage.ts`; pages import from here |
| `paychecks.ts` | `upcomingPaychecks` — forecasts future paycheck dates |

### Add-form pattern (mobile bottom sheet)
Every "add a row" flow uses one shared form component rendered in two containers: inline below the table on desktop (`formId="add-form"`, target of `jumpToAddForm`), and inside `<BottomSheet>` on mobile (`useIsMobile()` at 600px; the `+ Add X` header buttons open it). Add handlers return `boolean` so the sheet closes only on a successful add — validation failures keep it open.

| Component (`app/components/`) | Used by |
|---|---|
| `AddBillForm` (`combinedDue` prop merges day+month for narrow cards) | expenses page, onboarding Bills step |
| `AddCategoryForm` | budget page, onboarding Plan step |
| `AddGoalForm` (links section auto-hides when nothing is linkable) | goals page, onboarding Goals step |
| `AddSourceForm` (local to `income/page.tsx`) | income page only — onboarding's income step is a one-off full form |

Empty states (goals page / onboarding Goals step with zero rows) keep the form inline even on mobile. The goals page's per-row "Edit" panel (`GoalEditor`) follows the same pattern: inline expanded `<tr>` on desktop, bottom sheet on mobile.

### Pay cycles
`PayCycle = "biweekly" | "semimonthly" | "weekly"`

- **weekly** — 7-day intervals anchored to `lastPaycheckDate`; 52 paychecks/year (factor `52/12`)
- **biweekly** — 14-day intervals anchored to `lastPaycheckDate`; 26 paychecks/year (factor `26/12`)
- **semimonthly** — always 1st and 15th; no anchor needed; 24 paychecks/year (factor `24/12`)

Weekly + biweekly share the `lastPaycheckDate` field; the income page uses a `needsAnchor(cycle)` helper to gate the date input and validation. Unknown payCycle values from imported JSON fall back to biweekly via `coercePayCycle` in `normalizeParsed`.

### Period logic (critical)
`paycheckPeriodsForMonth(state, monthKey)` in `month.ts`:
1. Collects every paycheck day across all income sources for the month
2. Sorts unique days → each becomes a period boundary
3. First period always starts day 1 (to capture bills before the first paycheck)
4. Last period ends on the last day of the month
5. Falls back to two fixed halves (1–15, 16–end) if no income is configured

### Data format (localStorage key: `budgetApp:v1`)
Export wraps the state in `{ app: "Bursar", format: "bursar:v1", exportedAt, data: BudgetState }`. Import unwraps `data` (or `budgetAppV1` for legacy) before calling `saveBudget`; it does not check the `format` string, so older `paperInkLedger:v1` exports still import.

## Tests

```
tests/
  paycheck-periods.test.ts   # incomeDatesForMonth, monthlyIncomeOf, paycheckPeriodsForMonth
  budget-allocations.test.ts # computeAllocations, isBudgetOverdrawn
  helpers.ts                 # semiIncome(), biwIncome(), monthlyExpense(), annualExpense(), etc.
  fixtures/                  # 4 scenario JSON files (A–D) for import testing
```

Scenarios in `paycheck-periods.test.ts` all test against May 2026 (31-day month):
- **A** — two semi-monthly incomes
- **B** — semi-monthly + bi-weekly (May 2 anchor)
- **C** — two bi-weekly, same anchor
- **D** — two bi-weekly, offset anchors
- **E** — single weekly income (May 1 anchor → 5 paychecks)
- **F** — weekly + bi-weekly mixed (verifies 2-day merge rule with high paycheck density)

Note: `tests/fixtures/scenario-{e,f,g}*.json` already exist for unrelated full-state import scenarios; new paycheck-pattern fixtures should pick letters from H onward to avoid collision. When adding a new pay cycle or period behaviour, add an inline scenario in the test file (preferred) and optionally a matching fixture.

## CSS conventions (`app/globals.css`)

The design uses a "ruled ledger paper" aesthetic. Key class patterns:

| Class | Purpose |
|---|---|
| `.sheet` | White paper card with shadow |
| `.sheet--ledger` | Adds red margin line + blue horizontal rules (applied to `<body>`) |
| `.ledger-table-wrap` | Scrollable table container with margin-rule background |
| `.ledger-table-wrap-no-line` | Same but without the vertical red line |
| `.ledger-table` | Fixed-layout table; `min-width: 480px`; use `.onboarding-table` override inside the onboarding card to get `min-width: 360px` |
| `.inline-form` | Add-row form below a ledger table; responsive breakpoints at 720px and 480px (viewport-based) |
| `.inline-form--4col` | 5-column variant (`2fr 1fr 1fr 1fr auto`) |
| `.inline-form--5col` | 6-column variant (`2fr 1fr 1fr 1fr 1fr auto`) |
| `.page-head` | Page header block with `.page-head__title`, `.page-head__lead`, `.page-head__meta` |
| `.stat-row` | Horizontal row of `.stat` cards |
| `.segment` / `.segment__btn` | Pill toggle group |
| `.bottom-sheet` | Mobile slide-up drawer (`components/BottomSheet.tsx`); pairs with `.dialog-overlay--sheet`; all add flows + goals edit use it via `useIsMobile()` at 600px |
| `.inline-form--sheet` | Modifier that strips the sunk background/padding when an add form renders inside the bottom sheet |
| `.btn--ghost` / `.btn--icon` / `.btn--danger` | Button variants |
| `.kicker` | Small all-caps label above a title |

Breakpoints: `900px` (period grid collapses), `720px` (inline-form collapses to 2 col, onboarding card padding reduces), `480px` (inline-form goes single column).

## Key decisions / gotchas

- **`table-layout: fixed`** on `.ledger-table` — column widths are set by `<th style={{ width: "X%" }}>`. Cells don't auto-size. Inside the onboarding card (max 720px), keep columns to 5 or fewer and add `onboarding-table` class to lower the min-width.
- **`normalizeParsed`** is called on every `loadBudget` — it coerces bad/missing fields to safe defaults. Import goes through the same path. Never bypass it.
- **`storage.ts` vs `budgetStorage.ts`** — pages import from `storage.ts` (the shim); `budgetStorage.ts` is the real implementation. Don't import `budgetStorage.ts` directly from pages.
- **`useHydrated`** — all pages gate rendering behind this hook to avoid SSR/localStorage mismatch. Loading states must render the same markup server-side.
- **`out/` directory** is the static export committed to the repo. Run `npm run build` to regenerate it before committing changes.
- **Onboarding redirect** — `onboarding/page.tsx` redirects to `/` if `meta.onboardingComplete` is true. An imported file that has `onboardingComplete: true` will trigger this redirect automatically.
