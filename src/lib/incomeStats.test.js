import { describe, it, expect } from 'vitest';
import { averageRecentIncome, averageDailyEarnings, monthlyBreakdown, getPendingConfirmations, referenceIncome, effectiveIncomeMode } from './incomeStats';

describe('averageDailyEarnings', () => {
  const ref = new Date(2026, 8, 20);

  it('returns 0 with no confirmed incomes', () => {
    expect(averageDailyEarnings([], 30, ref)).toBe(0);
    expect(averageDailyEarnings([{ date: '2026-09-19', amount: 100, estado: 'proyectado' }], 30, ref)).toBe(0);
  });

  it('counts days off: 4 paid days out of 10 since the first income', () => {
    const incomes = [
      { date: '2026-09-11', amount: 100 },
      { date: '2026-09-13', amount: 100 },
      { date: '2026-09-15', amount: 100 },
      { date: '2026-09-20', amount: 100 },
    ];
    // first income on the 11th -> 10 days through the 20th, 400 total -> 40/day
    expect(averageDailyEarnings(incomes, 30, ref)).toBe(40);
  });

  it('ignores incomes older than the window', () => {
    const incomes = [
      { date: '2026-06-01', amount: 9999 },
      { date: '2026-09-20', amount: 300 },
    ];
    // window is the last 30 days (Aug 22 - Sep 20), the June income falls outside it
    expect(averageDailyEarnings(incomes, 30, ref)).toBe(10);
  });
});

describe('getPendingConfirmations', () => {
  const confirmed = { id: 'c1', date: '2026-08-29', estado: 'confirmado' };

  it('ignores confirmed incomes regardless of date', () => {
    expect(getPendingConfirmations([confirmed], new Date(2026, 7, 30, 20))).toEqual([]);
  });

  it('always flags a projected income from a previous day, any time of day', () => {
    const overdue = { id: 'p1', date: '2026-08-28', estado: 'proyectado' };
    expect(getPendingConfirmations([overdue], new Date(2026, 7, 29, 9))).toEqual([overdue]);
  });

  it('does not flag a projected income dated today before 6pm', () => {
    const today = { id: 'p2', date: '2026-08-29', estado: 'proyectado' };
    expect(getPendingConfirmations([today], new Date(2026, 7, 29, 17, 59))).toEqual([]);
  });

  it('flags a projected income dated today once it is 6pm or later', () => {
    const today = { id: 'p3', date: '2026-08-29', estado: 'proyectado' };
    expect(getPendingConfirmations([today], new Date(2026, 7, 29, 18, 0))).toEqual([today]);
  });

  it('does not flag a projected income dated in the future', () => {
    const future = { id: 'p4', date: '2026-08-30', estado: 'proyectado' };
    expect(getPendingConfirmations([future], new Date(2026, 7, 29, 20))).toEqual([]);
  });
});

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

describe('referenceIncome', () => {
  const incomes = [
    { date: '2026-06-01', amount: 1000000 },
    { date: '2026-07-01', amount: 1200000 },
    { date: '2026-08-01', amount: 1300000, estado: 'proyectado' },
  ];

  it('defaults to the rolling average (variable mode)', () => {
    expect(referenceIncome(incomes)).toBe(averageRecentIncome(incomes));
  });

  it('uses the most recent confirmed entry in fixed mode, skipping proyectado', () => {
    expect(referenceIncome(incomes, 'fijo')).toBe(1200000);
  });

  it('returns 0 in fixed mode with no confirmed incomes', () => {
    expect(referenceIncome([], 'fijo')).toBe(0);
  });

  it('sums sueldos fijos instead of the last entry when a recurring template exists', () => {
    // The most recent income here is a one-off extra (viáticos), not the salary —
    // with a sueldo fijo configured, that shouldn't throw off the reference figure.
    const sueldosFijos = [{ id: 'sf1', amount: 1500000 }, { id: 'sf2', amount: 500000 }];
    expect(referenceIncome(incomes, 'fijo', sueldosFijos)).toBe(2000000);
  });
});

describe('effectiveIncomeMode', () => {
  it('falls back to the manual toggle with no sueldos fijos', () => {
    expect(effectiveIncomeMode({ user: { incomeMode: 'variable' }, sueldosFijos: [] })).toBe('variable');
    expect(effectiveIncomeMode({ user: { incomeMode: 'fijo' }, sueldosFijos: [] })).toBe('fijo');
    expect(effectiveIncomeMode({ user: {}, sueldosFijos: [] })).toBe('variable');
  });

  it('is always fijo once at least one sueldo fijo is configured, regardless of the toggle', () => {
    expect(effectiveIncomeMode({ user: { incomeMode: 'variable' }, sueldosFijos: [{ id: 'sf1', amount: 100 }] })).toBe('fijo');
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
