import { describe, it, expect } from 'vitest';
import { averageRecentIncome, monthlyBreakdown } from './incomeStats';

describe('averageRecentIncome', () => {
  it('returns 0 with no incomes', () => {
    expect(averageRecentIncome([])).toBe(0);
  });

  it('excludes proyectado incomes and averages the rest', () => {
    const incomes = [
      { date: '2026-08-01', amount: 100 },
      { date: '2026-08-02', amount: 200 },
      { date: '2026-08-03', amount: 300, estado: 'proyectado' },
    ];
    expect(averageRecentIncome(incomes)).toBe(150);
  });

  it('only averages the most recent `count` entries', () => {
    const incomes = [
      { date: '2026-08-01', amount: 10 },
      { date: '2026-08-02', amount: 20 },
      { date: '2026-08-03', amount: 90 },
    ];
    // Most recent 2 by date: 08-03 (90) and 08-02 (20) -> average 55
    expect(averageRecentIncome(incomes, 2)).toBe(55);
  });

  it('rounds to the nearest whole unit', () => {
    const incomes = [
      { date: '2026-08-01', amount: 10 },
      { date: '2026-08-02', amount: 11 },
      { date: '2026-08-03', amount: 11 },
    ];
    // (10 + 11 + 11) / 3 = 10.666... -> 11
    expect(averageRecentIncome(incomes)).toBe(11);
  });
});

describe('monthlyBreakdown', () => {
  it('sums ganado/ahorro/deudas per month, filtered to the given year, excluding proyectado', () => {
    const incomes = [
      { date: '2026-01-15', amount: 100, distribution: { ahorro: 10, tarjeta: 20 } },
      { date: '2026-01-20', amount: 200, distribution: { ahorro: 30, tarjeta: 40 } },
      { date: '2025-01-15', amount: 999, distribution: { ahorro: 999, tarjeta: 999 } }, // wrong year
      { date: '2026-02-01', amount: 50, distribution: { ahorro: 5, tarjeta: 5 }, estado: 'proyectado' }, // excluded
    ];
    const months = monthlyBreakdown(incomes, 2026);
    expect(months[0]).toEqual({ month: 0, ganado: 300, ahorro: 40, deudas: 60 });
    expect(months[1]).toEqual({ month: 1, ganado: 0, ahorro: 0, deudas: 0 });
    expect(months.every((m, i) => i === 0 || i === 1 || m.ganado === 0)).toBe(true);
  });
});
