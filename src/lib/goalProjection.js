import { todayISO } from './dates';

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
