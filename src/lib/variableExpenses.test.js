import { describe, it, expect } from 'vitest';
import { monthlyCategoryTotals } from './variableExpenses';

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
