import { todayISO, isoOffset } from './dates';

export const CONTRIBUTION_FREQUENCIES = [
  { key: 'diario', label: 'Diario', days: 1, noun: 'día', nounPlural: 'días' },
  { key: 'semanal', label: 'Semanal', days: 7, noun: 'semana', nounPlural: 'semanas' },
  { key: 'quincenal', label: 'Quincenal', days: 15, noun: 'quincena', nounPlural: 'quincenas' },
  { key: 'mensual', label: 'Mensual', days: 30, noun: 'mes', nounPlural: 'meses' },
];

// How much to save per day/week/month to reach a goal by a target date, given
// how much is left. Returns null when there's nothing to project (goal
// already reached, or no target date set) — the caller just skips the card's
// projection block in that case. When the date has already passed, `overdue`
// is true and the day/week/month figures are omitted (there's no valid rate).
export function computeSavingsProjection(remaining, targetDateISO, today = todayISO()) {
  if (remaining <= 0 || !targetDateISO) return null;
  const days = Math.ceil((new Date(targetDateISO + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
  if (days <= 0) return { days, overdue: true };
  const daily = remaining / days;
  return { days, overdue: false, daily, weekly: daily * 7, monthly: daily * 30 };
}

// Calendar months between two ISO dates, inclusive of the starting month —
// same month counts as 1, so a single contribution still yields a usable rate.
function monthsBetween(fromISO, toISO) {
  const a = new Date(fromISO + 'T00:00:00');
  const b = new Date(toISO + 'T00:00:00');
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
}

// For a goal with no target date: how many months are left at the person's own
// historical pace (total contributed so far ÷ months since the first one) —
// no date to type in, same "we calculate it, you don't" spirit as the average
// income figure. Returns null with no history yet, or once the goal is met.
export function estimateMonthsToGoal(remaining, history, today = todayISO()) {
  if (remaining <= 0 || !history || history.length === 0) return null;
  const firstDate = history.reduce((min, h) => (h.date < min ? h.date : min), history[0].date);
  const totalContributed = history.reduce((a, h) => a + h.amount, 0);
  const monthlyRate = totalContributed / monthsBetween(firstDate, today);
  if (monthlyRate <= 0) return null;
  return Math.ceil(remaining / monthlyRate);
}

// User-driven "what if I save $X every [day/week/month]" projection — lets someone
// without a target date (or who wants to try a different pace than their own
// history) pick a frequency and amount and see how many periods and what calendar
// date that works out to. Returns null when there's nothing to project.
export function projectGoalByContribution(remaining, amountPerPeriod, frequencyKey, today = todayISO()) {
  if (remaining <= 0 || amountPerPeriod <= 0) return null;
  const frequency = CONTRIBUTION_FREQUENCIES.find((f) => f.key === frequencyKey) || CONTRIBUTION_FREQUENCIES[3];
  const periods = Math.ceil(remaining / amountPerPeriod);
  const totalDays = periods * frequency.days;
  return { periods, frequency, totalDays, completionDate: isoOffset(totalDays, new Date(today + 'T00:00:00')) };
}
