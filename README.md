# Paper & Ink Ledger

Paper & Ink Ledger is a local-first paycheck budgeting app. It focuses on the practical question many monthly budget tools blur: **what does this paycheck need to cover before the next one arrives?**

The app stores data in browser `localStorage` under `budgetApp:v1`. It does not require an account, a bank login, or a server-side database.

## What It Does

- Forecasts biweekly and semi-monthly paycheck periods.
- Assigns recurring monthly and annual bills into the paycheck period where they are due.
- Tracks paid/unpaid bill status by paycheck period.
- Shows income, bills, leftover cash, and budget allocations per period.
- Supports percentage and fixed-dollar allocation categories for leftover money.
- Exports and imports local data from the Settings page.


## Development

```bash
npm install
npm run dev
```

Validate before deploying:

```bash
npm run build
```

## Deploying To GitHub Pages

This project uses Next.js static export and can be deployed to GitHub Pages through GitHub Actions. On GitHub, set **Settings > Pages > Source** to **GitHub Actions**, then push to `main`.
