# Changelog

All notable changes to Bursar will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-09-12

A UX pass over every page: no setup wizard, goals you can actually fund, one way to add things on desktop and mobile, and legible type. Stored data is unchanged and every earlier export still imports.

### Added

- **Goal funding.** A goal's editor has a "Funded by" section: pick budget categories and bills from a grouped picker that shows what each one contributes per paycheck, see them as removable chips, and read "≈ $X per paycheck" with "about N paychecks to go". Debt goals list bills first, savings goals list categories first. The Overview's Goals tab uses the same numbers (`lib/goalFunding.ts`).
- **Add dialog.** Every "+ Add" button opens the form in a centered dialog on desktop and the bottom sheet on mobile. Escape and clicking outside close it, the first field is focused, and focus returns to the button. The dialog stays open until the add succeeds.
- **Empty states.** A fresh install opens on the Overview and the first period card offers three ways in: add income, import a backup file, or try sample data. Tables with no rows show "Add your first bill / category / income".
- **Sample data** with a persistent banner and "Clear and start fresh".
- **Hints.** One dismissible sentence per page, remembered in `meta.hints`, with "Show hints again" in Settings.
- **Quick add** at the bottom of a period card's Income and Bills tabs.
- **Automatic month snapshots.** Every save refreshes the current month, past months are back-filled from `createdAt`, and a past month can be refreshed from current data via its ⋯ menu.
- **"More" in the mobile nav** with Income and Settings, so the bar holds five items with readable labels at 390px.
- **"Erase all data"** in Settings.
- Tests for goal funding, month snapshots and the merge view, and sample data / `meta` defaults.

### Changed

- **Creating a goal is three fields** — name, Savings/Debt, target — and the new goal's editor opens right away so funding can be set.
- **Typography.** Three roles: Caveat for titles, Source Sans 3 for body and UI, JetBrains Mono for numbers. Sizes sit on a 13 / 15 / 17 / 20 / 24 / 30 scale and nothing is under 13px. Muted text is darker and now passes 4.5:1 on both paper tones.
- **Plain copy.** "Bills" (was "Bill notations"), "Name" (was "Notation"), "Repeats" (was "Cadence"), "Budget" (was "Allocation plan"), "Income" (was "Income ledger"), "Funded by" (was "Linked to"), "Add income" (was "Add source"). Decorative kickers that repeated a heading are gone.
- **Mobile touch targets** are at least 44px: buttons, form controls, segment buttons, nav items, period rows, picker rows and chips. Tapping a bill or goal name toggles its checkbox.
- **Overview order:** month header, one-line `Income − Bills = Leftover` summary, period cards with the current one first, then a collapsible cash-flow timeline.
- **Period card tabs** are real tabs with a visible active state and arrow-key navigation.
- **Paid marks and goal contributions are always editable** in every month; snapshots store definitions only.
- Adjustments in the goal editor sit in their own section, separated from funding.
- Special Elite is used only for stamps.

### Removed

- The 3-step onboarding wizard and the `/onboarding` route.
- Manual Lock / Unlock / Archive controls and the read-only month mode.
- The inline add forms under each table and the scroll-to-form behaviour of the mobile "+ Add" buttons.
- The "Link to" checkbox list from goal creation (funding is set in the editor instead).
- The Kalam typeface.

## [1.0.0] - 2026-07-22

Initial release.

### Added

- Paycheck-period budgeting: the month is split into periods at each paycheck date across all income sources
- Income sources with weekly, bi-weekly, and semi-monthly pay cycles
- Recurring bills with monthly/annual due dates and a calendar view
- Budget allocation plan with percent-based and fixed-amount categories
- Savings goals with optional links to budget categories
- 3-step onboarding flow (Income → Bills → Plan)
- Mobile layout with bottom-sheet add/edit forms
- JSON export/import of all data from Settings
- Local-only storage (`localStorage`) — no backend, no accounts
- "Ruled ledger paper" visual design

[Unreleased]: https://github.com/BrandonFeldhaus/bursar/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/BrandonFeldhaus/bursar/releases/tag/v1.0.0
