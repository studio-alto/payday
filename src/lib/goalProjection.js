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
