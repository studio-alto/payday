import { describe, it, expect } from 'vitest';
import { computeSavingsProjection } from './goalProjection';

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
