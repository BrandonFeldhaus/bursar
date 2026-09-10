# Changelog

All notable changes to Bursar will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

- The 3-step onboarding wizard and the `/onboarding` route; the app opens straight on the Overview
- Manual Lock / Unlock / Archive controls and the read-only month mode

### Added

- Empty states inside the period cards: add a paycheck, import a saved ledger, or try sample data without leaving the Overview
- Demo mode with a persistent "sample data" banner and a one-click clear
- One-sentence dismissible hints on every page (`meta.hints`), with "Show hints again" in Settings
- Quick add: "+ Add paycheck" and "+ Add bill" at the bottom of a period card's Income and Bills tabs
- Automatic month snapshots: every save refreshes the current month, past months are back-filled, and a past month can be refreshed from current data
- "Erase all data" in Settings

### Changed

- Overview order: month header, one-line month summary, period cards (current first), collapsible cash-flow timeline
- Period card tabs now have a visible active state and proper tab semantics
- Paid marks and goal contributions are always editable in every month; snapshots store definitions only

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
