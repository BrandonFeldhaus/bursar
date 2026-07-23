# Bursar

Bursar is a local-first paycheck budgeting app. It focuses on the practical question many monthly budget tools blur: **what does this paycheck need to cover before the next one arrives?**

The app stores data in your browser's `localStorage`. There is no account, no bank login, and no server-side database — your budget never leaves your device.

## What It Does

- **Paycheck periods, not calendar months.** Splits each month into the periods between your actual paydays so you can see what each paycheck needs to cover before the next one lands.
- **Multiple pay cycles.** Supports weekly (52/yr), biweekly (26/yr), and semi-monthly (1st & 15th, 24/yr) income sources, including mixed combinations across multiple jobs.
- **Recurring bills.** Track monthly and annual bills and the day of the month they hit. Bills are auto-assigned to the paycheck period they fall in.
- **Paid/unpaid status per period.** Mark bills paid one period at a time without losing the recurring schedule.
- **Calendar view.** See bills laid out on a monthly calendar from the Expenses page.
- **Leftover allocation plan.** Build a budget for leftover cash using percentage categories, fixed-dollar categories, or a mix. The app flags when your plan is overdrawn.
- **3-step onboarding.** New users are walked through Income → Bills → Plan before landing on the home view.
- **Export / import JSON.** Back up or move your data from the Settings page. Older `paperInkLedger:v1` exports still import.

## Pages

| Route | Purpose |
|---|---|
| `/` | Home — paycheck period cards for the selected month |
| `/income` | Add and edit income sources |
| `/expenses` | Recurring bills + calendar view |
| `/budget` | Allocation plan (percent + fixed categories) |
| `/settings` | Export / import JSON, reset onboarding |
| `/onboarding` | First-run setup flow |

## Development

```bash
npm install
npm run dev      # dev server (Turbopack)
npm run build    # static export → out/
npm test         # Mocha test suite
npx tsc --noEmit # type-check only
```

## Analytics

Bursar uses [Umami](https://umami.is/) for privacy-friendly, cookieless analytics on the hosted version. Umami collects aggregate page-view and referrer data only — no personal information, no cross-site tracking, and no cookies. **Your budget data is never sent anywhere**; it always stays in your browser's `localStorage`.

The tracker is loaded in [app/layout.tsx](app/layout.tsx) and points at `https://cloud.umami.is/script.js`. If you fork this project for your own use, replace the `data-website-id` with your own Umami site ID or remove the `<Script>` tag in the layout to disable analytics entirely.
