import type { PayCycle } from "./storage";

function parseISO(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  // Validate round-trip (avoid invalid dates like 2026-02-31)
  if (dt.getFullYear() !== y || dt.getMonth() !== (m - 1) || dt.getDate() !== d) return null;
  return dt;
}

function toISO(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfDay(dt: Date): Date {
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function addDays(dt: Date, days: number): Date {
  const d = new Date(dt);
  d.setDate(d.getDate() + days);
  return d;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function nextSemiMonthlyDates(from: Date, count: number): string[] {
  // Semi-monthly: 1st and 15th
  const out: string[] = [];
  const base = startOfDay(from);

  // Walk month-by-month until we have enough dates
  for (let offset = 0; out.length < count && offset < 48; offset++) {
    const y = base.getFullYear();
    const m = base.getMonth() + offset;

    const first = startOfDay(new Date(y, m, 1));
    const fifteenth = startOfDay(new Date(y, m, 15));

    const candidates = [first, fifteenth].filter((d) => d.getTime() > base.getTime());

    for (const c of candidates) {
      if (out.length < count) out.push(toISO(c));
    }
  }

  return out;
}



export function upcomingPaychecks(
  payCycle: PayCycle,
  lastPaycheckISO: string,
  count = 4
): { dates: string[]; error?: string } {
  if (payCycle === "semimonthly") {
    const base = lastPaycheckISO ? parseISO(lastPaycheckISO) : startOfDay(new Date());
    if (!base) return { dates: [], error: "Enter a valid last paycheck date (YYYY-MM-DD)." };
    return { dates: nextSemiMonthlyDates(startOfDay(base), count) };
  }

  const last = parseISO(lastPaycheckISO);
  if (!last) return { dates: [], error: "Enter your last paycheck date to forecast paydays." };

  if (payCycle === "monthly") {
    // Same day-of-month each month, clamped to shorter months.
    const dates: string[] = [];
    for (let i = 1; i <= count; i++) {
      const y = last.getFullYear();
      const m = last.getMonth() + i;
      dates.push(toISO(new Date(y, m, Math.min(last.getDate(), lastDayOfMonth(y, m)))));
    }
    return { dates };
  }

  const lastDay = startOfDay(last);
  const intervalDays = payCycle === "weekly" ? 7 : 14;

  const dates: string[] = [];
  for (let i = 1; i <= count; i++) {
    dates.push(toISO(addDays(lastDay, intervalDays * i)));
  }
  return { dates };
}
