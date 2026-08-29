import { describe, it, expect } from 'vitest';
import { daysInMonth, remainingDaysInMonth, isSameMonth, daysUntilPayday, isWithinDays, isoOffset, monthsSince } from './dates';

describe('monthsSince', () => {
  it('is 0 for a start date less than a month ago', () => {
    expect(monthsSince('2026-08-10', new Date(2026, 7, 29))).toBe(0);
  });

  it('counts whole months, not rounding up until the day-of-month is reached', () => {
    expect(monthsSince('2026-06-15', new Date(2026, 7, 10))).toBe(1); // not yet the 15th
    expect(monthsSince('2026-06-15', new Date(2026, 7, 15))).toBe(2);
  });

  it('counts across a year boundary', () => {
    expect(monthsSince('2025-01-01', new Date(2026, 7, 1))).toBe(19);
  });

  it('never goes negative for a future start date', () => {
    expect(monthsSince('2026-12-01', new Date(2026, 7, 1))).toBe(0);
  });
});

describe('isoOffset', () => {
  it('uses the local calendar day, not the UTC one — stays "today" late in the evening in a UTC-behind timezone', () => {
    // 11pm local time: toISOString() on this instant would already report tomorrow
    // in any timezone behind UTC (e.g. Bogotá, UTC-5) — isoOffset must not do that.
    expect(isoOffset(0, new Date(2026, 7, 29, 23, 0))).toBe('2026-08-29');
  });

  it('adds the offset in local days, crossing a month boundary correctly', () => {
    expect(isoOffset(1, new Date(2026, 7, 31, 23, 0))).toBe('2026-09-01');
  });
});

describe('daysInMonth', () => {
  it('handles a leap February', () => {
    expect(daysInMonth(new Date(2024, 1, 10))).toBe(29);
  });

  it('handles a non-leap February', () => {
    expect(daysInMonth(new Date(2026, 1, 10))).toBe(28);
  });

  it('handles a 31-day month', () => {
    expect(daysInMonth(new Date(2026, 0, 10))).toBe(31);
  });
});

describe('remainingDaysInMonth', () => {
  it('counts the days left after today in the same month', () => {
    expect(remainingDaysInMonth(new Date(2026, 7, 20))).toBe(11); // August has 31 days
  });
});

describe('isSameMonth', () => {
  it('true for the same year and month, different day', () => {
    expect(isSameMonth('2026-08-05', new Date(2026, 7, 27))).toBe(true);
  });

  it('false for a different month', () => {
    expect(isSameMonth('2026-07-31', new Date(2026, 7, 1))).toBe(false);
  });

  it('false for the same month in a different year', () => {
    expect(isSameMonth('2025-08-05', new Date(2026, 7, 27))).toBe(false);
  });
});

describe('daysUntilPayday', () => {
  it('is 0 when today is the payday', () => {
    expect(daysUntilPayday(10, new Date(2026, 7, 10))).toBe(0);
  });

  it('counts forward within the same month when the payday has not passed', () => {
    expect(daysUntilPayday(15, new Date(2026, 7, 10))).toBe(5);
  });

  it('rolls over to next month once the payday has already passed', () => {
    // Aug 10 -> Aug 31 is 21 days, + 5 more to Sep 5 = 26
    expect(daysUntilPayday(5, new Date(2026, 7, 10))).toBe(26);
  });

  it('clamps a payday beyond the month length to the last day of the month', () => {
    // April has 30 days, so payDayOfMonth=31 clamps to April 30
    expect(daysUntilPayday(31, new Date(2026, 3, 15))).toBe(15);
  });
});

describe('isWithinDays', () => {
  it('includes today', () => {
    expect(isWithinDays('2026-08-27', 30, '2026-08-27')).toBe(true);
  });

  it('includes a date right at the edge of the window', () => {
    expect(isWithinDays('2026-07-29', 30, '2026-08-27')).toBe(true); // exactly 29 days ago
  });

  it('excludes a date just outside the window', () => {
    expect(isWithinDays('2026-07-28', 30, '2026-08-27')).toBe(false); // 30 days ago
  });

  it('excludes a future date', () => {
    expect(isWithinDays('2026-09-01', 30, '2026-08-27')).toBe(false);
  });
});
