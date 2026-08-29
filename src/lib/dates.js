export const WEEKDAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export const DAY_TYPES = [
  { key: 'normal', label: 'Normal' },
  { key: 'finSemana', label: 'Fin de semana' },
  { key: 'festivo', label: 'Festivo' },
  { key: 'medio', label: 'Medio turno' },
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
