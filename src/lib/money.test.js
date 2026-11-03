import { describe, it, expect } from 'vitest';
import { round2, hasCents } from './money';

describe('round2', () => {
  it('cleans float noise down to 2 decimals', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1850000.5 - 200000.25)).toBe(1650000.25);
  });
  it('leaves whole amounts alone', () => {
    expect(round2(180000)).toBe(180000);
  });
});

describe('hasCents', () => {
  it('is true for 1-2 decimal amounts', () => {
    expect(hasCents(10.5)).toBe(true);
    expect(hasCents(1850000.25)).toBe(true);
  });
  it('is false for whole amounts, float noise, and long fractions', () => {
    expect(hasCents(1000)).toBe(false);
    expect(hasCents(1000.0000000001)).toBe(false);
    expect(hasCents(14583.3333)).toBe(false);
  });
});
