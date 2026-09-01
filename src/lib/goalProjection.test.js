import { describe, it, expect } from 'vitest';
import { computeSavingsProjection, estimateMonthsToGoal } from './goalProjection';

describe('computeSavingsProjection', () => {
  it('returns null when the goal is already reached', () => {
    expect(computeSavingsProjection(0, '2026-12-31', '2026-08-27')).toBeNull();
    expect(computeSavingsProjection(-5000, '2026-12-31', '2026-08-27')).toBeNull();
  });

  it('returns null when there is no target date', () => {
    expect(computeSavingsProjection(500000, null, '2026-08-27')).toBeNull();
  });

  it('computes daily/weekly/monthly rates for a future date', () => {
    const result = computeSavingsProjection(500000, '2026-09-26', '2026-08-27'); // 30 days away
    expect(result.overdue).toBe(false);
    expect(result.days).toBe(30);
    expect(result.daily).toBeCloseTo(16666.67, 1);
    expect(result.weekly).toBeCloseTo(116666.67, 1);
    expect(result.monthly).toBeCloseTo(500000, 1);
  });

  it('flags a target date that has already passed', () => {
    const result = computeSavingsProjection(500000, '2026-08-01', '2026-08-27');
    expect(result.overdue).toBe(true);
    expect(result.daily).toBeUndefined();
  });
});

describe('estimateMonthsToGoal', () => {
  it('returns null when the goal is already reached', () => {
    expect(estimateMonthsToGoal(0, [{ date: '2026-06-01', amount: 10000 }], '2026-08-27')).toBeNull();
  });

  it('returns null with no contribution history yet', () => {
    expect(estimateMonthsToGoal(500000, [], '2026-08-27')).toBeNull();
    expect(estimateMonthsToGoal(500000, null, '2026-08-27')).toBeNull();
  });

  it('estimates months remaining from the historical monthly pace', () => {
    // Jun, Jul, Aug (3 months incl.) totalling 300000 -> 100000/month; 500000 left -> 5 months
    const history = [
      { date: '2026-06-10', amount: 100000 },
      { date: '2026-07-15', amount: 100000 },
      { date: '2026-08-01', amount: 100000 },
    ];
    expect(estimateMonthsToGoal(500000, history, '2026-08-27')).toBe(5);
  });

  it('treats a single contribution this month as one month of pace', () => {
    const history = [{ date: '2026-08-05', amount: 50000 }];
    // Same month as `today` -> 1 month elapsed -> rate is 50000/month; 100000 left -> ceil(2) = 2
    expect(estimateMonthsToGoal(100000, history, '2026-08-27')).toBe(2);
  });
});
