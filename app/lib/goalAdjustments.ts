import type { Goal } from "./budgetStorage";
import { formatShortDate, parseISODate } from "./month";

export type ManualAdjustment = Goal["manualAdjustments"][number];

/** Newest first; undated legacy entries sink below dated ones, keeping their original order. */
export function sortAdjustmentsForDisplay(adjustments: ManualAdjustment[]): ManualAdjustment[] {
  return adjustments
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      if (x.a.date && y.a.date) return y.a.date.localeCompare(x.a.date) || y.i - x.i;
      if (x.a.date || y.a.date) return x.a.date ? -1 : 1;
      return x.i - y.i;
    })
    .map((x) => x.a);
}

export function formatAdjustmentDate(date: string, today: Date = new Date()): string {
  const parsed = parseISODate(date);
  if (!parsed) return "—";
  const short = formatShortDate(parsed);
  return parsed.getFullYear() === today.getFullYear() ? short : `${short}, ${parsed.getFullYear()}`;
}
