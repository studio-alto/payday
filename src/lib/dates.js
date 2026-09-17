export const WEEKDAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export const DAY_TYPES = [
  { key: 'normal', label: 'Normal' },
  { key: 'finSemana', label: 'Fin de semana' },
  { key: 'festivo', label: 'Festivo' },
  { key: 'medio', label: 'Medio turno' },
  { key: 'mensual', label: 'Mensual' },
];

export function dayTypeLabel(key) {
  return DAY_TYPES.find((d) => d.key === key)?.label || key;
}

// ISO date (YYYY-MM-DD) offset by a number of days from a base date (defaults to now).
// Built from local year/month/day (not toISOString, which is UTC and would silently
// roll "today" over to tomorrow every evening in any timezone behind UTC — Bogotá's
// UTC-5 hits this from 7pm on).
export function isoOffset(offsetDays, base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return isoOffset(0);
}

// Real moving window of the last 7 days, ending today (not tied to any fixed month).
export function last7Days() {
  return Array.from({ length: 7 }, (_, i) => isoOffset(i - 6));
}

export function weekdayOf(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay();
}

export function isSameMonth(dateStr, ref = new Date()) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

// True when dateStr falls within the last `days` days (today included, future dates excluded).
export function isWithinDays(dateStr, days, today = todayISO()) {
  const diff = (new Date(today + 'T00:00:00') - new Date(dateStr + 'T00:00:00')) / 86400000;
  return diff >= 0 && diff < days;
}

export function formatShortDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export function formatFullDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Whole months elapsed from a start date to now (or a given ref date) — used to show
// "llevas X meses con esta deuda" once the person records when they took it on.
export function monthsSince(startDateStr, ref = new Date()) {
  const start = new Date(startDateStr + 'T00:00:00');
  let months = (ref.getFullYear() - start.getFullYear()) * 12 + (ref.getMonth() - start.getMonth());
  if (ref.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

// Whole days elapsed since a precise ISO timestamp (not just a calendar date) —
// used by the backup reminder, where `lastBackupAt` is a moment in time, not a day.
export function daysSince(isoTimestamp, ref = new Date()) {
  return Math.floor((ref - new Date(isoTimestamp)) / 86400000);
}

// Adds whole months to a base date and returns an ISO date — used to turn a payoff plan's
// "N months from now" into a real calendar date. Clamps the day to the target month's last
// day so e.g. Jan 31 + 1 month lands on Feb 28/29 instead of silently rolling into March.
export function addMonthsISO(months, base = new Date()) {
  const d = new Date(base);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, daysInMonth(d)));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// "Julio 2026" — used to show a payoff plan's end date as a real, concrete month
// instead of just a month count.
export function formatMonthYear(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const label = d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function daysInMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function remainingDaysInMonth(date = new Date()) {
  return daysInMonth(date) - date.getDate();
}

// Days from today until the next occurrence of payDayOfMonth (0 = today).
// A payDayOfMonth beyond the days a given month has (e.g. 31 in February) clamps to that month's last day.
export function daysUntilPayday(payDayOfMonth, date = new Date()) {
  const todayMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let candidate = new Date(date.getFullYear(), date.getMonth(), Math.min(payDayOfMonth, daysInMonth(date)));
  if (candidate < todayMidnight) {
    const nextMonthRef = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    candidate = new Date(nextMonthRef.getFullYear(), nextMonthRef.getMonth(), Math.min(payDayOfMonth, daysInMonth(nextMonthRef)));
  }
  return Math.round((candidate - todayMidnight) / 86400000);
}
