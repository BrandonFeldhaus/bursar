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

### Layout shell (`app/layout.tsx`)
`SiteHeader` → `<main>` wrapping `<OnboardingGate>{children}</OnboardingGate>` → footer → `BottomNav` (mobile only).

`OnboardingGate` (`components/OnboardingGate.tsx`) is **redirect-only**: in an effect it reads `meta.onboardingComplete` and calls `router.replace` to `/onboarding` (not complete, any other route) or `/` (complete, on `/onboarding`). It always renders its children, so the server HTML and the first client frame contain each page's own loading skeleton — there is no blank frame. When a redirect fires the skeleton is replaced by the destination route; that skeleton → redirect transition is expected. The gate must never return `null`.

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

Empty states (goals page / onboarding Goals step with zero rows) keep the form inline even on mobile. The goals page's per-row "Edit" panel (`GoalEditor`) follows the same pattern: inline expanded `<tr>` on desktop, bottom sheet on mobile. Its adjustment form uses `.inline-form--bare` (same rule as `--sheet`: no sunk background/padding). `AddGoalForm` is three stacked blocks — `.inline-form--goal` (fields), `.add-goal__links`, `.add-goal__submit` — each with a `--sheet` variant.

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

The design uses a "ruled ledger paper" aesthetic.

### Rule: layout lives in classes, not inline styles
`style={{ … }}` in TSX is reserved for **genuinely dynamic values**, and even then only as CSS custom properties that a class reads:

| Custom property | Set by | Read by |
|---|---|---|
| `--pct` | progress / bar fills (`${n}%`) | `.period-card__paid-bar__fill`, `.goal-progress-bar__fill`, `.goal-period-item__fill`, `.allocation-bar__fill` (`width: var(--pct)`) |
| `--pos` | timeline tick / label / today marker | `.timeline__tick`, `.timeline__lbl`, `.timeline__today` (`left: var(--pos)`) |
| `--swatch` | allocation ring segment, swatch, bar | `.ring__segment` (`stroke`), `.allocation-swatch`, `.allocation-bar__fill--swatch` (`background`) |

Write them as `style={{ "--pct": `${pct}%` } as CSSProperties}` (the cast is needed because `React.CSSProperties` has no index signature). Computed *colours* pick a modifier class (`--done`, `--debt`, `--neg`) rather than an inline value; the allocation ring is the one place a colour is passed through, via `--chart-1…7` tokens. Everything else — paddings, flex rows, font sizes, column widths — is a class. New classes follow the existing BEM-ish `.block__element--modifier` naming and go under the `/* ===== SECTION ===== */` comment of the component they belong to.

### Breakpoints — exactly three
| Query | Meaning |
|---|---|
| `@media (width <= 900px)` / `(width > 900px)` | period grid, stat rows and other multi-column layouts collapse; top nav ↔ bottom nav swap; inline forms drop to 2 columns; sheet width goes fluid; undo toast lifts above the bottom nav |
| `@media (width <= 600px)` | matches `useIsMobile()`; inline forms go single column; tables switch to card view (`.ledger-table--responsive`); calendar → agenda; goal cards hide; card paddings tighten |
| `@media (width <= 420px)` | small-phone adjustments: `.period-card` padding, `.recent-item` wrapping, `.cycle-info__list` single column, `.stat-row--4` single column |

Range syntax is deliberate and every breakpoint is inclusive on the small side (`<= 900px` pairs with `> 900px`), matching `matchMedia("(max-width: 600px)")` in `useIsMobile`. Do not add other widths. `prefers-reduced-motion: reduce` queries are the only other media rules.

### Design tokens (`:root`)
| Group | Tokens |
|---|---|
| Paper | `--paper-0`, `--paper`/`--paper-1`/`--surface`, `--paper-2`/`--surface-sunk`, `--paper-edge`, `--paper-a96`, `--paper-a35`, `--paper-a10` |
| Ink | `--text`/`--ink-1`, `--ink-2`, `--ink-3`/`--muted` (62%), `--ink-4` (32%), alpha scale `--ink-a04 a06 a07 a08 a10 a14 a18 a40 a45 a55`, `--border` (18%), `--border-soft` (10%) |
| Signals | `--signal-red`/`--accent`, `--signal-red-soft` (12%), `--signal-red-a10/a18/a20`, `--signal-green` (paid / complete), `--signal-green-a10/a14/a60`, `--brand-green` (header dot) |
| Rules | `--line-blue`/`--rule-blue`, `--line-red`/`--rule-margin`, `--line-height`/`--rule` (28px) |
| Chart | `--chart-1 … --chart-7` (allocation ring series; 1/4/5 alias ink, red, green) |
| Spacing | `--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-5` 24px, `--space-6` 32px |
| Shape / shadow | `--radius-sm/md/lg`, `--sheet-radius`, `--shadow-paper-sm/md/lg`, `--shadow-inset`, `--ink-shadow`, `--paper-shadow(-lg)` |
| Fonts | `--font-display` (Caveat), `--font-hand` (Kalam), `--font-stamp` (Special Elite), `--font-numerals` (JetBrains Mono) |

Never write a raw `rgba()`/hex in a component rule; add a token if one is missing. The only raw colours left are one-off decorative gradients (body, header, brand-mark shadows, selection) and the `<select>` chevron data-URI.

### Class patterns
| Class | Purpose |
|---|---|
| `.sheet` | White paper card with shadow; `.sheet--stat` (stat card padding), `.sheet--bar` (slim toolbar/status padding) |
| `.sheet--ledger` | Adds red margin line + blue horizontal rules (applied to `<body>`) |
| `.table-card` | Sheet hosting a ledger table: `__head` (padded heading row), `__title` (kicker + h2 + saved indicator), `__actions` (jump button + badge) |
| `.ledger-table-wrap` / `-no-line` | Scrollable table container (with / without the red line); add `.ledger-table-wrap--flush` inside a `.table-card` to square the corners |
| `.ledger-table` | Fixed-layout table; `min-width: 480px` (`.onboarding-table` → 360px). Column widths come from a per-table modifier: `.ledger-table--bills`, `--income`, `--budget`, `--goals`, `--onb-bills`, `--onb-categories`, `--onb-goals` (`th:nth-child(n) { width }`) |
| `.ledger-table--responsive` | Card view at ≤600px; each `<td>` needs `data-label` |
| `.inline-form` | Add-row form below a ledger table; `--2col/--3col/--4col/--5col` column variants; 2 columns <900px, 1 column ≤600px |
| `.inline-form--sheet` / `--bare` | Strip the sunk background/padding (inside `BottomSheet` / goal editor row) |
| `.inline-form--goal`, `.add-goal__links(--sheet)`, `.add-goal__submit(--sheet)` | The three stacked blocks of `AddGoalForm` |
| `.field__row`, `.input--day` | Side-by-side controls in one field; the 52px due-day input |
| `.page-head` | Page header block with `__title`, `__lead`, `__meta`; onboarding adds `.onboarding-title/-lead/-hint/-form/-nav` spacing |
| `.stat-row` | Horizontal row of `.stat` cards (`--4` for four) |
| `.month-title` / `.month-nav__label` / `.month-note` / `.month-controls` | Month heading + controls on Overview and Expenses |
| `.timeline-card`, `.timeline__today`, `.timeline__legend-dot--income/--bill/--paid`, `.timeline__balance` | Cash-flow timeline sheet |
| `.recent-item__group(--wide)`, `__check(--locked/--nolink)`, `--faint`, `--total`, `__name--italic` | Rows inside period-card tabs |
| `.goal-period-item__fill(--debt/--done)`, `__nolink` | Goal rows inside a period card |
| `.goal-card__heading/__actions/__target/__remaining`, `.goal-links(__none)`, `.goals-empty` | Goals page cards and empty state |
| `.goal-row__actions/__edit(--active)/__editor-cell`, `.goal-editor__*`, `.link-check(-list/__box)`, `.segment--sign`, `.segment__btn--sign` | Goals table row + expanded editor |
| `.ring-card`, `.ring(__svg/__segment/__center/__label/__sublabel)`, `.allocation-swatch` | Budget allocation donut |
| `.calendar-card` | Sheet hosting the bills calendar / agenda |
| `.segment` / `.segment__btn` | Pill toggle group |
| `.bottom-sheet` | Mobile slide-up drawer (`components/BottomSheet.tsx`); pairs with `.dialog-overlay--sheet`; all add flows + goals edit use it via `useIsMobile()` at 600px |
| `.badge--xs/--sm/--faint`, `.stamp--sm` | Size / opacity variants |
| `.btn--ghost` / `.btn--icon` / `.btn--danger` / `.btn--block` / `.btn--jump` | Button variants |
| `.muted--italic` | Italic muted note |
| `.skeleton-card`, `.skeleton--stat-label/--stat-value`, `.skeleton-gap` | Loading placeholders |
| `.kicker` | Small all-caps label above a title |
| `.fileInputHidden` | Hidden `<input type="file">` behind a `.btn` label |

## Key decisions / gotchas

- **`table-layout: fixed`** on `.ledger-table` — column widths come from the table's modifier class (`.ledger-table--bills th:nth-child(n) { width }` etc.), never from inline `style` on `<th>`. Cells don't auto-size. Adding a column means updating that rule set. Inside the onboarding card (max 720px), keep columns to 5 or fewer and add `onboarding-table` class to lower the min-width.
- **`normalizeParsed`** is called on every `loadBudget` — it coerces bad/missing fields to safe defaults. Import goes through the same path. Never bypass it.
- **`storage.ts` vs `budgetStorage.ts`** — pages import from `storage.ts` (the shim); `budgetStorage.ts` is the real implementation. Don't import `budgetStorage.ts` directly from pages.
- **`useHydrated`** — all pages gate rendering behind this hook to avoid SSR/localStorage mismatch. Loading states must render the same markup server-side. Because `OnboardingGate` no longer hides children, that skeleton *is* the server HTML — keep it cheap and static.
- **No inline styles** — see CSS conventions. `grep -rn 'style=' app` should only return `--pct`, `--pos`, `--swatch` custom properties.
- **`out/` directory** is the static export committed to the repo. Run `npm run build` to regenerate it before committing changes.
- **Onboarding redirect** — `onboarding/page.tsx` redirects to `/` if `meta.onboardingComplete` is true. An imported file that has `onboardingComplete: true` will trigger this redirect automatically.
