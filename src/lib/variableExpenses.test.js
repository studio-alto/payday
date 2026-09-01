import { describe, it, expect } from 'vitest';
import { monthlyCategoryTotals, monthlyVariableTotals } from './variableExpenses';

describe('monthlyCategoryTotals', () => {
  const categories = ['Mercado', 'Transporte'];
  const gastos = [
    { categoria: 'Mercado', amount: 8000, date: '2026-08-05' },
    { categoria: 'Mercado', amount: 15000, date: '2026-08-20' },
    { categoria: 'Mercado', amount: 999, date: '2026-07-31' }, // different month
    { categoria: 'Transporte', amount: 20000, date: '2026-08-01' },
  ];

  it('sums per category within the given month', () => {
    expect(monthlyCategoryTotals(gastos, categories, 2026, 7)).toEqual([
      { categoria: 'Mercado', total: 23000 },
      { categoria: 'Transporte', total: 20000 },
    ]);
  });

  it('returns 0 for a category with no matching entries', () => {
    expect(monthlyCategoryTotals(gastos, ['Salud'], 2026, 7)).toEqual([{ categoria: 'Salud', total: 0 }]);
  });

  it('excludes entries from a different year', () => {
    const gastosOtroAno = [{ categoria: 'Mercado', amount: 5000, date: '2025-08-05' }];
    expect(monthlyCategoryTotals(gastosOtroAno, ['Mercado'], 2026, 7)).toEqual([{ categoria: 'Mercado', total: 0 }]);
  });
});

describe('monthlyVariableTotals', () => {
  it('sums every category combined, per month, for the requested window', () => {
    const gastos = [
      { categoria: 'Mercado', amount: 10000, date: '2026-07-05' },
      { categoria: 'Restaurante', amount: 5000, date: '2026-07-20' },
      { categoria: 'Mercado', amount: 8000, date: '2026-08-01' },
    ];
    const months = monthlyVariableTotals(gastos, 3, new Date(2026, 7, 27)); // ref = Aug 27, 2026
    expect(months).toEqual([
      { year: 2026, month: 5, label: 'Jun', total: 0 },
      { year: 2026, month: 6, label: 'Jul', total: 15000 },
      { year: 2026, month: 7, label: 'Ago', total: 8000 },
    ]);
  });

  it('ignores spending outside the window', () => {
    const gastos = [{ categoria: 'Mercado', amount: 999, date: '2025-01-01' }];
    const months = monthlyVariableTotals(gastos, 2, new Date(2026, 7, 27));
    expect(months.reduce((a, m) => a + m.total, 0)).toBe(0);
  });
});
