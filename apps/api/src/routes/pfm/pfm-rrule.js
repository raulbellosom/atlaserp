// apps/api/src/routes/pfm/pfm-rrule.js
//
// Minimal recurrence-date math for atlas.pfm. All dates are treated as UTC
// calendar days (time component ignored / normalized to 00:00:00Z).
//
// rrule shape: { freq: 'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY', interval?: number,
//                byMonthDay?: 1..31 }
//
// (projects/tasks-service.js has a `computeRruleNextAt`, but it is a 4-string
// preset lookup with no anchor date and always computes from `now` — not
// reusable here.)

const FREQS = new Set(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);

function dayUTC(d) {
  const s = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  return new Date(`${s}T00:00:00.000Z`);
}

function lastDayOfMonth(year, monthIdx) {
  return new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
}

function addMonthsClamped(from, months, byMonthDay) {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const desired = byMonthDay ?? from.getUTCDate();
  const day = Math.min(desired, lastDayOfMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, day));
}

// Next occurrence strictly after `from` (from is a prior occurrence).
export function computeNextRun(rrule, from) {
  if (!rrule || !FREQS.has(rrule.freq)) return null;
  const interval = Math.max(1, Number(rrule.interval) || 1);
  const base = dayUTC(from);
  switch (rrule.freq) {
    case "DAILY":
      return new Date(base.getTime() + interval * 86400000);
    case "WEEKLY":
      return new Date(base.getTime() + interval * 7 * 86400000);
    case "MONTHLY":
      return addMonthsClamped(base, interval, rrule.byMonthDay);
    case "YEARLY": {
      const d = new Date(base);
      d.setUTCFullYear(d.getUTCFullYear() + interval);
      return d;
    }
    default:
      return null;
  }
}

// First occurrence on or after `anchor` (used when a rule is created).
export function firstRunOnOrAfter(rrule, anchor) {
  if (!rrule || !FREQS.has(rrule.freq)) return null;
  const a = dayUTC(anchor);
  if (rrule.freq === "MONTHLY" && rrule.byMonthDay) {
    const thisMonth = new Date(
      Date.UTC(
        a.getUTCFullYear(),
        a.getUTCMonth(),
        Math.min(rrule.byMonthDay, lastDayOfMonth(a.getUTCFullYear(), a.getUTCMonth())),
      ),
    );
    if (thisMonth.getTime() >= a.getTime()) return thisMonth;
    return addMonthsClamped(thisMonth, Math.max(1, Number(rrule.interval) || 1), rrule.byMonthDay);
  }
  // For the other frequencies the anchor itself is the first run.
  return a;
}
