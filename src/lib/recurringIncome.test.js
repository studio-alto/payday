import { describe, it, expect, vi, afterEach } from 'vitest';
import { ensureRecurringIncomes } from './recurringIncome';

describe('ensureRecurringIncomes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the same data reference when there are no sueldos fijos', () => {
    const data = { incomes: [], sueldosFijos: [] };
    expect(ensureRecurringIncomes(data)).toBe(data);
  });

  it('creates a proyectado income for the next payday when none exists yet', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 10)); // Sep 10, 2026

    const sueldoFijo = { id: 'sf1', name: 'Sueldo X', amount: 2000000, payDayOfMonth: 15, ahorroPct: 20, tarjetaPct: 10, goalId: 'g1' };
    const data = { incomes: [], sueldosFijos: [sueldoFijo] };
    const result = ensureRecurringIncomes(data);

    expect(result).not.toBe(data);
    expect(result.incomes).toHaveLength(1);
    const generated = result.incomes[0];
    expect(generated).toMatchObject({
      name: 'Sueldo X',
      amount: 2000000,
      date: '2026-09-15',
      estado: 'proyectado',
      recurringId: 'sf1',
      distribution: { ahorro: 400000, tarjeta: 200000, goalId: 'g1', debtAllocations: [] },
    });
  });

  it('does not duplicate an income already generated for the current cycle', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 10));

    const sueldoFijo = { id: 'sf1', name: 'Sueldo X', amount: 2000000, payDayOfMonth: 15, ahorroPct: 0, tarjetaPct: 0 };
    const existing = { id: 'i1', recurringId: 'sf1', date: '2026-09-15', estado: 'proyectado', amount: 2000000, distribution: {} };
    const data = { incomes: [existing], sueldosFijos: [sueldoFijo] };

    const result = ensureRecurringIncomes(data);
    expect(result).toBe(data);
    expect(result.incomes).toHaveLength(1);
  });

  it('generates the next cycle once this month\'s was already confirmed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 20)); // after the 15th

    const sueldoFijo = { id: 'sf1', name: 'Sueldo X', amount: 2000000, payDayOfMonth: 15 };
    const confirmed = { id: 'i1', recurringId: 'sf1', date: '2026-09-15', estado: 'confirmado', amount: 2000000, distribution: {} };
    const data = { incomes: [confirmed], sueldosFijos: [sueldoFijo] };

    // September's payday already passed and was confirmed — the next occurrence
    // to ensure is October's, since that cycle doesn't have one yet.
    const result = ensureRecurringIncomes(data);
    expect(result.incomes).toHaveLength(2);
    expect(result.incomes[1]).toMatchObject({ date: '2026-10-15', estado: 'proyectado', recurringId: 'sf1' });
  });

  it('generates one income per sueldo fijo, independently', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1));

    const data = {
      incomes: [],
      sueldosFijos: [
        { id: 'sf1', name: 'Sueldo X', amount: 1000000, payDayOfMonth: 5 },
        { id: 'sf2', name: 'Sueldo Y', amount: 500000, payDayOfMonth: 20 },
      ],
    };
    const result = ensureRecurringIncomes(data);
    expect(result.incomes).toHaveLength(2);
    expect(result.incomes.map((i) => i.recurringId).sort()).toEqual(['sf1', 'sf2']);
  });
});
