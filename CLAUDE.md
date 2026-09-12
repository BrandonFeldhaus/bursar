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
| `/` | `app/page.tsx` | Overview — month header, one-line month summary, paycheck period cards (current first), collapsible cash-flow timeline |
| `/income` | `app/income/page.tsx` | Add/edit income sources |
| `/expenses` | `app/expenses/page.tsx` | "Bills" — add/edit recurring bills; calendar view |
| `/budget` | `app/budget/page.tsx` | "Budget" — percent + fixed categories |
| `/goals` | `app/goals/page.tsx` | Savings / debt goals, funding sources, manual adjustments |
| `/settings` | `app/settings/page.tsx` | Export/import JSON, erase all data |

There is no setup wizard and no route gate. A store with no incomes is "new": the Overview teaches through empty states (step-by-step in the first period card) and a demo mode. `meta.onboardingComplete` is still stored for import compatibility but nothing reads it for routing.

### Layout shell (`app/layout.tsx`)
`SiteHeader` (which renders `DemoBanner` inside the sticky header) → `<main>{children}</main>` → footer → `BottomNav` (mobile only). Every page renders its own loading skeleton behind `useHydrated`, so the server HTML and the first client frame always match.

### Navigation
Desktop top nav (`SiteHeader`): Overview, Expenses, Budget, Goals, Income, Settings. Mobile `BottomNav` (≤900px) has five items — Overview, Expenses, Budget, Goals, **More** — where More is a button that opens a `BottomSheet` listing Income and Settings (`.more-sheet__list`); it closes on route change and reads as active while either of those pages is open. Labels are sentence case at 13px so all five fit at 390px.

### Overview (`app/page.tsx`)
Top to bottom:
1. **Month head** (`.month-head`) — the month as the page `h1` + Prev / Today / Next. Past months add a `Snapshot · Mon D` stamp (from `lockedAt`) and an `OverflowMenu` (⋯) whose only item is **Refresh from current data**. Current and future months show nothing else; there are no lock controls anywhere.
2. **Month summary** (`.month-summary`) — `Income − Bills = Leftover` on one ruled line; the leftover is the ledger total (double rule, red when negative). Stacks to three rows only at ≤420px.
3. **Period cards** (`.period-grid`) — the period containing today comes first with a `Current` stamp and an ink bar (`.period-card--current`); the previous month's last period counts as current while it still overhangs into this month. Default tab is Bills. Tabs are real `role=tab` buttons with an ink underline when active, roving `tabIndex`, arrow-key navigation and a `role=tabpanel` body.
4. **Cash-flow timeline** — a `<details class="timeline-details">` sheet, `open` on desktop and closed on mobile (`useIsMobile()`).

Empty states live inside the cards, never as separate screens:
- **No incomes** → the first card's body is the first-run state (`.period-empty`): one line of copy, an **Add income** button (opens `AddSourceForm` in `FormDialog`), plus two text links: **Import a backup file** (`ImportLedgerButton`) and **Try it with sample data** (`saveState(sampleData())` + reload). The period grid still renders via the two-fixed-halves fallback; kickers read "Period 1 of 2" instead of "1st paycheck of 2".
- **Income, no bills** → every card's Bills tab shows "No bills yet…" with an **Add bill** button (`AddBillForm combinedDue` in `FormDialog`).
- **No budget categories** → the Leftover tab says "Leftover isn't planned yet." with a link to `/budget`.
- **Bills, no goals** → the first card shows the `overview-goals` hint under its tab row.

Quick add (`.period-card__quick-add`): once the store has incomes / bills, the Income and Bills tabs end with a `+ Add income` / `+ Add bill` text link that opens the same `FormDialog` (one `dialog` state: `"source" | "bill" | null`); it closes only on a successful add. Categories and goals are not added from the Overview: the Leftover and Goals tabs link to their pages, because a goal only does something here once it has funding sources. Editing and deleting always happen on the pages.

Bill and goal rows wrap the checkbox and name in a `<label class="recent-item__toggle">`, so on mobile the whole left side of the 44px row is the tap target. The Goals tab's per-goal amount is `goalFundingTotal(goal, allocations, period.bills)` from `lib/goalFunding.ts` — the same number the goal editor shows.

### Hints (`components/Hint.tsx`)
`HINTS` holds one sentence per id (`overview-goals`, `income`, `expenses`, `budget`, `goals`, `settings`). Each page renders `<Hint id hints={state.meta.hints} onDismiss>` directly under `.page-head`; `dismissHint(state, id)` appends the id to `meta.hints`, which persists through `saveState`. Settings has no page state, so it loads/saves just for the hint. Settings' **Show hints again** clears `meta.hints`.

### Demo mode
`lib/sampleData.ts` → `sampleData(now?)` returns a full `BudgetState` (Day job, Rent, Utilities, Internet, Phone, Car insurance, Savings/Spending/Gas/Buffer, Emergency fund) with `meta.demo = true` and the paycheck anchored to today. While `meta.demo` is true, `DemoBanner` (rendered inside `SiteHeader`, re-checked on every route change) shows "You're looking at sample data." with **Clear and start fresh** → `eraseAllData()` (`lib/eraseAllData.ts`: `clearBudget()` + navigate to `/`). Settings' **Erase all data** uses the same function.

### Core lib (`app/lib/`)
| File | What it does |
|---|---|
| `budgetStorage.ts` | **Source of truth** for all types (`PayCycle`, `Income`, `RecurringExpense`, `LockedMonth`, `BudgetState`), localStorage read/write (`loadBudget`, `saveBudget`, `clearBudget`), and `normalizeParsed` which coerces any stored/imported JSON to a valid state |
| `month.ts` | Period generation logic — `incomeDatesForMonth`, `paycheckPeriodsForMonth`, `monthlyIncomeOf`, and all date helpers |
| `monthView.ts` | Snapshots and the merge view: `snapshotForMonth`, `upsertSnapshot`, `backfillSnapshots`, `viewStateForMonth` (see *Facts vs definitions*) |
| `allocations.ts` | `computeAllocations`, `isBudgetOverdrawn` |
| `storage.ts` | Shim over `budgetStorage.ts`; pages import from here. `saveState` also upserts the **current month's** snapshot on every save |
| `sampleData.ts` | `sampleData()` — the demo ledger, `meta.demo = true` |
| `eraseAllData.ts` | `eraseAllData()` — clear every stored key and go to `/` |
| `paychecks.ts` | `upcomingPaychecks` — forecasts future paycheck dates |
| `goalFunding.ts` | How goals are funded (see *Goal funding*): `sourceAmount`, `goalFundingTotal`, `fundingCandidates`, `goalFundingSources`, `paychecksToGo`, `currentPeriod` |
| `useModal.ts` | `useModal(open, onClose, panelRef)` — shared modal behaviour: body scroll lock, Escape closes the topmost modal only, first field focused on open, focus returned to the opener on close |

### Goal funding (`lib/goalFunding.ts`)
A goal is funded by budget categories and bills (`linkedBudgetCategoryIds` / `linkedExpenseIds` — unchanged schema). Ticking the goal on a period card applies the sum of those sources for that period: a category contributes its allocation (`computeAllocations(period.leftover, categories)`), a bill contributes its amount only in the period it is due, and an id that no longer exists contributes 0. `sourceAmount` is the one place that is computed; `goalFundingTotal` sums a goal's links (Overview), `fundingCandidates` lists every category and bill with its amount (the picker), `goalFundingSources` filters that to the goal's links in order (chips, badges), `paychecksToGo(remaining, perPaycheck)` is `ceil` or `null`, and `currentPeriod(state, today)` finds the period containing today (falling back to last month's overhanging last period). The goals page computes candidates once from `currentPeriod(state)` and passes them down.

### Add-form pattern (FormDialog)
Every "add a row" flow uses one shared form component rendered inside `FormDialog` (`components/FormDialog.tsx`): a centered `.dialog.dialog--form` on desktop, `BottomSheet` on mobile (`useIsMobile()` at 600px). Both containers use `useModal`: Escape and overlay click close them, the first field is focused on open, and focus returns to the `+ Add X` button on close. Nothing scrolls the page. The `+ Add X` header buttons (`.btn.btn--add`) are visible at every width. Add handlers return `boolean` so the dialog closes only on a successful add — validation failures keep it open. Each form file also exports a `xFromDraft(draft, errs)` builder so pages and the Overview share one add path. Forms take `inSheet` (adds `.inline-form--sheet`: no sunk chrome, two columns, one at ≤600px).

| Component (`app/components/`) | Used by |
|---|---|
| `AddBillForm` (`combinedDue` merges day+month) | expenses page, Overview (bills empty state + quick add) |
| `AddCategoryForm` | budget page |
| `AddGoalForm` — three fields: name, type (`.segment--field` Savings / Debt), target; exports `goalDraftErrors`, `goalFromDraft` | goals page |
| `AddSourceForm` | income page, Overview (first-run + quick add) |

Other shared pieces: `ImportLedgerButton` (label + hidden file input; unwraps `{ data }` / `{ budgetAppV1 }` / bare state, runs `normalizeParsed`, saves, reloads — used by Settings and the Overview empty state), `OverflowMenu` (⋯ button with a `role=menu` list), `Hint`, `DemoBanner`, `FundingPicker`.

**Empty tables** are the one exception: a table with zero rows renders `.table-empty` ("No bills yet." + **Add your first bill**, which opens the same dialog) instead of the table; the goals page keeps `AddGoalForm` inline when there are no goals. After a successful add on the goals page the new goal's editor opens (`openEditor(id)`) so funding can be set immediately.

### Goal editor (`GoalEditor` in `app/goals/page.tsx`)
Inline expanded `<tr>` on desktop, `BottomSheet` on mobile; two stacked sections split by `.goal-editor__divider`:
- **Funded by** — explainer line, the goal's sources as removable `.funding-chip`s (name + amount for the current period), a `.funding-total` line ("≈ $X per paycheck", plus "about N paychecks to go" while something remains; hidden when the total is 0), and `FundingPicker`. The picker button ("Add funding source") opens the candidates grouped under *Budget categories* and *Bills* as two `<details>`; the goal's type decides which group is open first (debt → Bills, savings → categories). Desktop renders it through a portal as a `position: fixed` `.funding-picker__popover` placed with `--top` / `--left` from the button's rect (re-placed on scroll/resize, closed on outside click / Escape / *Done*); mobile uses `BottomSheet` with 44px rows. Sources already on the goal are checked and disabled. Nothing linkable → a note instead of the button.
- **Adjustments** — unchanged: the dated list (recent three, *Show all*), and the +/− amount + note form (`.inline-form--bare`, button "Add adjustment").

### Pay cycles
`PayCycle = "biweekly" | "semimonthly" | "weekly" | "monthly"`

- **weekly** — 7-day intervals anchored to `lastPaycheckDate`; 52 paychecks/year
- **biweekly** — 14-day intervals anchored to `lastPaycheckDate`; 26 paychecks/year
- **semimonthly** — always 1st and 15th; no anchor needed; 24 paychecks/year
- **monthly** — once a month on the day-of-month of `lastPaycheckDate`, clamped to shorter months (Jan 31 → Feb 28); 12 paychecks/year

Weekly, biweekly and monthly all share the `lastPaycheckDate` field; `needsAnchor(cycle)` in `AddSourceForm.tsx` (true for everything except semimonthly) gates the date input and its validation for both the add form and the income table's edit row. `paychecksPerYear(cycle)` in `month.ts` is the single source for the per-year factor — `monthlyIncomeOf` and `sampleData` both use it. Unknown payCycle values from imported JSON fall back to biweekly via `coercePayCycle` in `normalizeParsed`.

### Facts vs definitions, snapshots, and `viewStateForMonth` (critical)
Two kinds of data live in `BudgetState`:
- **Definitions** — incomes, bill amounts and due days, budget categories, goal targets and links. Shared across months; each past month keeps its own copy in `lockedMonths` (type `LockedMonth`, one per `monthKey`).
- **Facts** — `paidPeriods` on an expense, `appliedPeriods` and `manualAdjustments` on a goal. Keyed by periodId, always live, always editable in every month. Nothing ever locks a fact; there is no read-only mode on the Overview.

When snapshots are written (all in `lib/monthView.ts`, all definitions-only: `paidPeriods`, `appliedPeriods`, `manualAdjustments` are written as `[]`):
- **Every save** — `saveState` in `storage.ts` upserts the *current* month's snapshot from live definitions, so when the month rolls over its snapshot already holds the definitions as they last stood during that month.
- **Overview load** — `backfillSnapshots` snapshots every past month since `meta.createdAt` that lacks one (capped at 120 months).
- **Refresh from current data** — the ⋯ item on a past month opens a `ConfirmDialog` ("Refresh <Month> from current data?", confirm *Refresh*, cancel *Keep snapshot*) and re-snapshots that month via `upsertSnapshot`. Facts are untouched.

`viewStateForMonth(state, monthKey, currentKey?)` is what the Overview renders: for a past month with a snapshot it takes definitions from the snapshot but reads facts from live state matched by id (empty arrays if the id no longer exists live); current and future months, and past months without a snapshot, return live state unchanged. `normalizeLockedMonths` accepts legacy snapshots that still contain facts (written by the old manual Lock/Archive flow) and empties them. Do not rename `LockedMonth` or `lockedMonths`; old exports import unchanged.

### Period logic (critical)
`paycheckPeriodsForMonth(state, monthKey)` in `month.ts`:
1. Collects every paycheck day across all income sources for the month
2. Sorts unique days → each becomes a period boundary
3. First period always starts day 1 (to capture bills before the first paycheck)
4. Last period ends on the last day of the month
5. Falls back to two fixed halves (1–15, 16–end) if no income is configured

### Typography
Three roles, one token each, set in exactly one place (the `TYPOGRAPHY` block near the top of `globals.css`): `--font-display` (Caveat) on `h1`–`h3`, section / page / dialog titles and period labels; `--font-numerals` (JetBrains Mono, `tnum`) on the listed money / date / count classes; everything else inherits `--font-body` (Source Sans 3) from `<body>`. The one deliberate extra is `--font-stamp` (Special Elite) on `.stamp` only — the typewriter face is what makes the rotated bordered box read as a rubber stamp. No other rule sets `font-family`. Kalam is gone.

Type scale tokens: `--text-1` 13px, `--text-2` 15px, `--text-3` 17px (body), `--text-4` 20px, `--text-5` 24px, `--text-6` 30px, plus `--text-title` `clamp(32px, 5vw, 44px)` for page `h1`s only (Caveat sets small). Line heights `--leading-1/2/3/6` = 20/24/28/36px; text that sits on the ruled page background (footer, nav, hint line) uses the 28px rule. Nothing is set below 13px. Uppercase labels (kickers, table heads, field labels, buttons) track at 0.04–0.1em; only `.stamp` keeps 0.16em. `--muted` / `--ink-3` are 72% ink (≥ 4.5:1 on `--paper` and `--paper-2`); `--ink-4` (45%) is for placeholders and the empty-note dash only, never body text.

### Data format (localStorage key: `budgetApp:v1`)
Export wraps the state in `{ app: "Bursar", format: "bursar:v1", exportedAt, data: BudgetState }`. Import (`ImportLedgerButton`) unwraps `data` (or `budgetAppV1` for legacy), runs `normalizeParsed`, then `saveState`; it does not check the `format` string, so older `paperInkLedger:v1` exports still import.

`meta` fields: `onboardingComplete` (legacy, unused for routing), `version`, `createdAt`, `hints: string[]` (dismissed hint ids, default `[]`), `demo?: boolean` (sample data loaded, default `false`).

## Tests

```
tests/
  paycheck-periods.test.ts   # incomeDatesForMonth, monthlyIncomeOf, paycheckPeriodsForMonth
  budget-allocations.test.ts # computeAllocations, isBudgetOverdrawn
  budget-storage.test.ts     # normalizeParsed payCycle coercion
  goal-adjustments.test.ts   # sortAdjustmentsForDisplay, formatAdjustmentDate, goal normalisation
  goal-funding.test.ts       # sourceAmount / goalFundingTotal (category, bill, mix, missing id → 0),
                             # fundingCandidates, goalFundingSources, paychecksToGo, currentPeriod
  month-view.test.ts         # viewStateForMonth, snapshotForMonth, upsertSnapshot, backfillSnapshots,
                             # saveState upserting the current month (window/localStorage stubbed), legacy snapshots
  sample-data.test.ts        # meta.hints / meta.demo defaults, sampleData() round-trips through normalizeParsed
  helpers.ts                 # semiIncome(), biwIncome(), monthlyExpense(), annualExpense(), etc.
  fixtures/                  # scenario JSON files (A–I) for import testing
```

Scenarios in `paycheck-periods.test.ts` all test against May 2026 (31-day month):
- **A** — two semi-monthly incomes
- **B** — semi-monthly + bi-weekly (May 2 anchor)
- **C** — two bi-weekly, same anchor
- **D** — two bi-weekly, offset anchors
- **E** — single weekly income (May 1 anchor → 5 paychecks)
- **F** — weekly + bi-weekly mixed (verifies 2-day merge rule with high paycheck density)
- **G** — single monthly income (May 15 anchor → 1 period, overhang through Jun 14, pre-payday bills roll to April)
- **H** — monthly (May 1) + bi-weekly (May 2) (day-1/day-2 merge → 3 periods, no overhang)

Note: `tests/fixtures/scenario-{e,f,g}*.json` already exist for unrelated full-state import scenarios; paycheck-pattern fixtures use H (weekly), I (weekly + bi-weekly), J (monthly) — new ones should continue from K to avoid collision. When adding a new pay cycle or period behaviour, add an inline scenario in the test file (preferred) and optionally a matching fixture.

## CSS conventions (`app/globals.css`)

The design uses a "ruled ledger paper" aesthetic.

### Rule: layout lives in classes, not inline styles
`style={{ … }}` in TSX is reserved for **genuinely dynamic values**, and even then only as CSS custom properties that a class reads:

| Custom property | Set by | Read by |
|---|---|---|
| `--pct` | progress / bar fills (`${n}%`) | `.period-card__paid-bar__fill`, `.goal-progress-bar__fill`, `.goal-period-item__fill`, `.allocation-bar__fill` (`width: var(--pct)`) |
| `--pos` | timeline tick / label / today marker | `.timeline__tick`, `.timeline__lbl`, `.timeline__today` (`left: var(--pos)`) |
| `--swatch` | allocation ring segment, swatch, bar | `.ring__segment` (`stroke`), `.allocation-swatch`, `.allocation-bar__fill--swatch` (`background`) |
| `--top` / `--left` | `FundingPicker` (button rect) | `.funding-picker__popover` (`top` / `left`) |

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
| Fonts | `--font-display` (Caveat), `--font-body` (Source Sans 3), `--font-numerals` (JetBrains Mono); `--font-stamp` (Special Elite) for `.stamp` only |
| Type | `--text-1 … --text-6` (13 / 15 / 17 / 20 / 24 / 30), `--text-title`, `--leading-1/2/3/6` (20 / 24 / 28 / 36) — see *Typography* |

Never write a raw `rgba()`/hex in a component rule; add a token if one is missing. The only raw colours left are one-off decorative gradients (body, header, brand-mark shadows, selection) and the `<select>` chevron data-URI.

### Class patterns
| Class | Purpose |
|---|---|
| `.sheet` | White paper card with shadow; `.sheet--stat` (stat card padding), `.sheet--bar` (slim toolbar/status padding) |
| `.sheet--ledger` | Adds red margin line + blue horizontal rules (applied to `<body>`) |
| `.table-card` | Sheet hosting a ledger table: `__head` (padded heading row), `__title` (kicker + h2 + saved indicator), `__actions` (jump button + badge) |
| `.ledger-table-wrap` / `-no-line` | Scrollable table container (with / without the red line); add `.ledger-table-wrap--flush` inside a `.table-card` to square the corners |
| `.ledger-table` | Fixed-layout table; `min-width: 480px`. Column widths come from a per-table modifier: `.ledger-table--bills`, `--income`, `--budget`, `--goals` (`th:nth-child(n) { width }`) |
| `.ledger-table--responsive` | Card view at ≤600px; each `<td>` needs `data-label` |
| `.inline-form` | Add-row form grid; `--2col/--3col/--4col/--5col` column variants; 2 columns ≤900px, 1 column ≤600px. Only the goals empty state still renders one inline |
| `.inline-form--sheet` / `--bare` | Strip the sunk background/padding (inside `FormDialog` / goal editor); `--sheet` is also two columns at every width above 600px with the button spanning |
| `.dialog--form`, `.dialog__head` | `FormDialog`'s desktop panel: the bottom sheet's inner panel centered (`min(100%, 600px)`) |
| `.table-empty` (`__text`) | Zero-row state inside a `.table-card`: one line + "Add your first X" |
| `.goal-editor` (`__section`, `__heading`, `__explainer`, `__divider`, `__none`, `__adj*`) | The two stacked sections of `GoalEditor` |
| `.funding-chips` / `.funding-chip` (`__name`, `__amount`, `__remove`), `.funding-total` (`__amount`, `__estimate`) | A goal's funding sources and their per-paycheck total |
| `.funding-picker__popover` (`__groups`, `__group`, `__group-title`, `__count`, `__list`, `__row(--added)`, `__check`, `__name`, `__amount`, `__empty`, `__foot`) | The grouped source picker; the same list renders inside `BottomSheet` on mobile |
| `.more-sheet__list` / `__link(--active)` | Income / Settings links behind the bottom nav's More |
| `.segment--field` | A `.segment` used as a form field (goal type), fills the field width |
| `.recent-item__toggle` | The `<label>` around a period row's checkbox + name |
| `.field__row`, `.input--day` | Side-by-side controls in one field; the 52px due-day input |
| `.page-head` | Page header block with `__title`, `__lead`, `__meta` |
| `.hint-line` | One-sentence dismissible hint (`__text`, `__dismiss`) under `.page-head` or a period card's tab row |
| `.month-head` | Overview month header: `__title` (h1 `__label` + snapshot stamp), `__controls` (Prev / Today / Next + `.overflow-menu`); controls stretch to 44px rows at ≤600px |
| `.month-summary` | One-line `Income − Bills = Leftover` (`__caption`, `__equation`, `__term`, `__label`, `__value(--total/--neg)`, `__op`); three rows at ≤420px |
| `.period-card__tabs` / `__tab(--active/--goals)` / `__goals-count` | Period card tab row; active tab carries an ink underline; `.period-card--current` + `.stamp--current` mark the period containing today |
| `.period-empty` | In-card empty state (`__text`, `__links`); `.text-link` / `.text-link-btn` are underlined text links on `<a>` / `<button>` / file-input `<label>` |
| `.inline-form--narrow` | Two columns at every width — add forms embedded in a period card |
| `.demo-banner` | Sample-data strip inside the sticky header (`__inner`, `__text`, `__btn`) |
| `.overflow-menu` | ⋯ button (`__btn`) + `role=menu` list (`__list`, `__item`) |
| `.timeline-details` | Collapsible cash-flow `<details>` sheet (`__summary`, `__heading`, `__title`, `__chevron`, `__body`) |
| `.stat-row` | Horizontal row of `.stat` cards (`--4` for four) |
| `.month-nav__label` | Month label between ‹ › buttons on Expenses |
| `.timeline__today`, `.timeline__legend-dot--income/--bill/--paid`, `.timeline__balance` | Cash-flow timeline contents |
| `.recent-item__group(--wide)`, `__check(--nolink)`, `--faint`, `--total`, `__name--italic` | Rows inside period-card tabs |
| `.goal-period-item__fill(--debt/--done)`, `__nolink` | Goal rows inside a period card |
| `.goal-card__heading/__actions/__target/__remaining`, `.goal-links(__none)`, `.goals-empty` | Goals page cards and empty state |
| `.goal-row__actions/__edit(--active)/__editor-cell`, `.goal-editor__*`, `.link-check(-list/__box)`, `.segment--sign`, `.segment__btn--sign` | Goals table row + expanded editor |
| `.ring-card`, `.ring(__svg/__segment/__center/__label/__sublabel)`, `.allocation-swatch` | Budget allocation donut |
| `.calendar-card` | Sheet hosting the bills calendar / agenda |
| `.segment` / `.segment__btn` | Pill toggle group |
| `.bottom-sheet` | Mobile slide-up drawer (`components/BottomSheet.tsx`); pairs with `.dialog-overlay--sheet`; `FormDialog`, the goal editor, the funding picker and the nav's More use it via `useIsMobile()` at 600px |
| `.badge--xs/--sm/--faint`, `.stamp--sm` | Padding / opacity variants (all badges are 13px) |
| `.btn--ghost` / `.btn--icon` / `.btn--danger` / `.btn--block` / `.btn--lg` / `.btn--add` | Button variants; `--add` is the compact `+ Add X` header button that opens `FormDialog` |
| `.muted--italic` | Italic muted note |
| `.skeleton-card`, `.skeleton--stat-label/--stat-value`, `.skeleton-gap` | Loading placeholders |
| `.kicker` | Small all-caps label above a title |
| `.fileInputHidden` | Visually hidden but focusable `<input type="file">` behind a `.btn` / `.text-link-btn` label (`:focus-within` draws the outline) |

## Key decisions / gotchas

- **`table-layout: fixed`** on `.ledger-table` — column widths come from the table's modifier class (`.ledger-table--bills th:nth-child(n) { width }` etc.), never from inline `style` on `<th>`. Cells don't auto-size. Adding a column means updating that rule set.
- **`normalizeParsed`** is called on every `loadBudget` — it coerces bad/missing fields to safe defaults. Import goes through the same path. Never bypass it.
- **`storage.ts` vs `budgetStorage.ts`** — pages import from `storage.ts` (the shim); `budgetStorage.ts` is the real implementation. Don't import `budgetStorage.ts` directly from pages.
- **`useHydrated`** — all pages gate rendering behind this hook to avoid SSR/localStorage mismatch. Loading states must render the same markup server-side; that skeleton *is* the server HTML — keep it cheap and static. `DemoBanner` and the Settings hint render nothing on the server and appear after hydration.
- **Touch targets** — at ≤600px every `.btn` (except icons, which become 44×44), form control inside `.inline-form`, segment button, period row, picker row and chip is at least 44px tall.
- **Copy** — plain words, sentence case: "Bills" not "Bill notations", "Name" not "Notation", "Repeats" not "Cadence", "Funded by" not "Linked to", "Add income" for a source. `.kicker` eyebrows stay only where they encode something (a period's ordinal, a goal's type, the timeline section, the calendar's month); page and section headings have none.
- **Modals stack** — `useModal` closes only the topmost `[aria-modal]` on Escape and restores the previous body overflow, so the funding picker's sheet can open over the goal editor's sheet.
- **No inline styles** — see CSS conventions. `grep -rn 'style=' app` should only return `--pct`, `--pos`, `--swatch` custom properties.
- **`out/` directory** is the static export committed to the repo. Run `npm run build` to regenerate it before committing changes.
- **No `font-family` outside the typography block** — components pick a role by being listed in the display or numerals group there; body is inherited. Sizes come from `--text-*` tokens; the only `px` font sizes left are inside `clamp()`s.
- **Snapshots are automatic** — never add a Lock / Unlock / Archive control. Paid marks and goal contributions are facts and stay editable in every month; if a past month looks wrong, *Refresh from current data* rewrites its definitions only.
- **`saveState` is not a plain write** — it upserts the current month's snapshot. Call `saveBudget` directly only from lib code that must not touch snapshots.
