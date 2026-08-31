import { describe, it, expect } from 'vitest';
import { averageRecentIncome, monthlyBreakdown, getPendingConfirmations, referenceIncome } from './incomeStats';

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
