import { describe, it, expect } from 'vitest';
import { computeMonthlyRecap, monthKey, previousMonth } from './monthlyRecap';

const emptyData = { incomes: [], goals: [], cards: [], expenses: [], gastosVariables: [] };

describe('monthKey', () => {
  it('formats year and zero-indexed month as YYYY-MM', () => {
    expect(monthKey(2026, 0)).toBe('2026-01');
    expect(monthKey(2026, 11)).toBe('2026-12');
  });
});

describe('previousMonth', () => {
  it('steps back within the same year', () => {
    expect(previousMonth(2026, 8)).toEqual({ year: 2026, month: 7 });
  });

  it('wraps to December of the prior year from January', () => {
    expect(previousMonth(2026, 0)).toEqual({ year: 2025, month: 11 });
  });
});

describe('computeMonthlyRecap', () => {
  it('has no activity when nothing happened that month', () => {
    const recap = computeMonthlyRecap(emptyData, 2026, 7);
    expect(recap.hasActivity).toBe(false);
    expect(recap.netBalance).toBe(0);
  });

  it('sums income, fixed/variable expenses, goal savings and debt payments for the given month only', () => {
    const data = {
      incomes: [
        { date: '2026-08-05', amount: 100000, estado: 'confirmado', distribution: {} },
        { date: '2026-07-05', amount: 999999, estado: 'confirmado', distribution: {} }, // different month, excluded
        { date: '2026-08-06', amount: 50000, estado: 'proyectado', distribution: {} }, // projected, excluded
      ],
      goals: [{ id: 'g1', name: 'Viaje', current: 20000, target: 100000, history: [{ date: '2026-08-10', amount: 20000 }] }],
      cards: [{ id: 'c1', name: 'Nu', balance: 500000, history: [{ date: '2026-08-12', amount: 30000 }] }],
      expenses: [{ id: 'e1', name: 'Arriendo', amount: 10000, history: [{ date: '2026-08-01', amount: 10000 }] }],
      gastosVariables: [
        { id: 'v1', categoria: 'Mercado', amount: 15000, date: '2026-08-15' },
        { id: 'v2', categoria: 'Transporte', amount: 5000, date: '2026-08-16' },
      ],
    };
    const recap = computeMonthlyRecap(data, 2026, 7);
    expect(recap.totalIncome).toBe(100000);
    expect(recap.incomeCount).toBe(1);
    expect(recap.totalAhorro).toBe(20000);
    expect(recap.totalDebtPaid).toBe(30000);
    expect(recap.totalFixed).toBe(10000);
    expect(recap.totalVariables).toBe(20000);
    expect(recap.topCategory).toEqual({ name: 'Mercado', total: 15000 });
    expect(recap.netBalance).toBe(100000 - 10000 - 20000 - 20000 - 30000);
    expect(recap.hasActivity).toBe(true);
  });

  it('counts ahorro not linked to any goal, same as the dashboard does', () => {
    const data = {
      ...emptyData,
      incomes: [{ date: '2026-08-05', amount: 100000, estado: 'confirmado', distribution: { ahorro: 15000 } }],
    };
    const recap = computeMonthlyRecap(data, 2026, 7);
    expect(recap.totalAhorro).toBe(15000);
  });

  it('flags a goal completed and a debt cleared this month', () => {
    const data = {
      ...emptyData,
      goals: [{ id: 'g1', name: 'Viaje', current: 100000, target: 100000, history: [{ date: '2026-08-10', amount: 100000 }] }],
      cards: [{ id: 'c1', name: 'Nu', balance: 0, history: [{ date: '2026-08-12', amount: 500000 }] }],
    };
    const recap = computeMonthlyRecap(data, 2026, 7);
    expect(recap.goalsCompleted).toEqual(['Viaje']);
    expect(recap.debtsCleared).toEqual(['Nu']);
  });
});
