# Changelog

All notable changes to Bursar will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-09-13

Sheets and dialogs are rebuilt on [Base UI](https://base-ui.com) (`@base-ui/react`), which now handles focus, scroll locking, Escape and the backdrop. Stored data is unchanged.

### Added

- **Swipe a sheet down to close it.** On mobile, every bottom sheet (the add forms, the goal editor, the funding picker and More) follows your finger as you drag it down and closes when you let go. A quick flick closes it faster, and the dimmed page behind fades as you drag.
- **Return moves to the next field.** In every add form, and in the editable rows of the Income, Bills, Budget and Goals tables, the return key goes to the next field. On a phone the key reads Next, and Done on the last field, where it closes the keyboard.

### Changed

- **Return no longer adds a goal or an adjustment.** Pressing Return in a goal's name or target, or in an adjustment's amount or note, used to add it right away. Now only the Add goal and Add adjustment buttons do, the same as every other form.
- **Sheets and dialogs animate closed as well as open.** A sheet slides back down instead of disappearing, and the desktop add dialog fades and scales in and out (it used to appear with no animation). Reduce motion turns both off.
- **Tab stays inside an open dialog or sheet** instead of moving on to the page behind it.

### Fixed

- **The dimmed backdrop reaches the bottom of the screen on iOS 26.** Safari now draws the page under its toolbar, and the backdrop used to stop short there, leaving a strip of the page undimmed.
- On a phone, the Overview's cash-flow timeline starts collapsed instead of showing open for a moment first.

### Removed

- **The custom on-screen keyboard handling from 1.2.1–1.2.3.** Sheets no longer pin themselves above the keyboard or move their fields while you type. The browser keeps the tapped field in view.

## [1.2.4] - 2026-09-13

### Fixed

- **Bills no longer show $0.00 when funding a goal.** A bill used to read $0.00 in the funding picker and on its chip unless it was due in the current paycheck. Bills now show their amount as it appears on the Bills page (for example $1,300.00/mo or $1,200.00/yr).
- **"≈ per paycheck" and "paychecks to go" allow for bills that don't come every paycheck.** The estimate used only the current paycheck, so a monthly bill counted in full or not at all. Each funding source is now averaged over a year of paychecks: $1,300 rent with 26 paychecks a year adds $600 per paycheck. Ticking a goal on the Overview still counts a bill only in the period it's due.
- **Funding sources can be removed from the picker.** Choosing a checked source again removes it, the same way it was added.

## [1.2.3] - 2026-09-12

### Fixed

- **"More" in the mobile nav works again.** Its sheet was being drawn inside the nav bar, so on some phones it was cut down to the bar's height and its links were out of reach. Every sheet and dialog now sits directly on the page.
- **Tapping a field no longer pushes the form off the top of the screen.** The sheet now grows to full height the instant a field is tapped, before the keyboard appears, so the phone has no reason to shove the page up. The first tap on a form used to leave a blank gap and the fields above the screen.
- **The form no longer gets cut off while editing.** After the first field, moving between fields, selects and the number pad keeps the visible part of the form above the keyboard, and the Add button is reachable by scrolling the form.
- Closing a sheet by tapping one of its links (More → Settings) no longer carries the old page's scroll position onto the new page.

## [1.2.2] - 2026-09-12

### Fixed

- **Only the tapped field showed above the keyboard on iPhone.** Tapping a field in an add form (for example Name in "Add bill") pushed the rest of the form behind the keyboard. The form now stays near the top of the screen, and every field scrolls above the keyboard.
- **Lower fields no longer vanish when you tap a select or date field.** After typing, choosing a select or date field left a blank gap where the keyboard had been, hiding the fields and button below. They now stay visible and don't move.
- **The page behind a form keeps its place.** Closing a form returns the page to where you left it, even if the phone scrolled it while you were typing.

## [1.2.1] - 2026-09-12

### Fixed

- **Add forms on mobile no longer disappear behind the keyboard.** Opening a form shows the whole thing without focusing a field, so the keyboard stays down until you tap the field you want. Desktop still focuses the first field.
- **The page behind a sheet no longer scrolls.** Once the keyboard is up, the sheet sits above it and scrolls on its own. The field you tapped is scrolled into view.
- **Forms no longer jump when you move between fields.** Once the keyboard has opened, the sheet keeps its place until it closes. Tapping a select or date field, the Savings/Debt toggle, or a field with a number keypad no longer shifts the form. This applies to every bottom sheet: the add forms, the goal editor and the funding picker.

## [1.2.0] - 2026-09-12

### Added

- Monthly pay cycle for income sources: paid once a month on the same day as your most recent paycheck, clamped to shorter months (an anchor on the 31st pays on the 28th/30th where needed). Pick it in the Pay cycle field on the Income page or in any "Add income" dialog.
- "Monthly sources" count on the Income page stats row.

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
