# Changelog

All notable changes to Bursar will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-09-09

### Added

- Monthly pay cycle for income sources: paid once a month on the same day as your most recent paycheck, clamped to shorter months (an anchor on the 31st pays on the 28th/30th where needed). Available on the Income page and in onboarding.
- "Monthly sources" count on the Income page stats row

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
