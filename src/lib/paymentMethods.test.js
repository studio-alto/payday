import { describe, it, expect } from 'vitest';
import { PAYMENT_METHODS, normalizeMethod, totalsByMethod } from './paymentMethods';

describe('normalizeMethod', () => {
  it('keeps a known method and blanks everything else', () => {
    expect(normalizeMethod('Nequi')).toBe('Nequi');
    expect(normalizeMethod('Bre-b')).toBe('Bre-b');
    expect(normalizeMethod('Bitcoin')).toBe('');
    expect(normalizeMethod(undefined)).toBe('');
    expect(normalizeMethod(null)).toBe('');
  });

  it('exposes the five supported methods in order', () => {
    expect(PAYMENT_METHODS).toEqual(['Efectivo', 'Nequi', 'Daviplata', 'Transferencia', 'Bre-b']);
  });
});

describe('totalsByMethod', () => {
  it('sums per method in the fixed order, skipping empty ones', () => {
    const records = [
      { amount: 100, metodo: 'Nequi' },
      { amount: 50, metodo: 'Efectivo' },
      { amount: 25, metodo: 'Nequi' },
    ];
    expect(totalsByMethod(records)).toEqual([
      { method: 'Efectivo', total: 50 },
      { method: 'Nequi', total: 125 },
    ]);
  });

  it('groups records without a method (or with an unknown one) as "Sin método" at the end', () => {
    const records = [
      { amount: 10 },
      { amount: 20, metodo: 'Desconocido' },
      { amount: 5, metodo: 'Bre-b' },
    ];
    expect(totalsByMethod(records)).toEqual([
      { method: 'Bre-b', total: 5 },
      { method: 'Sin método', total: 30 },
    ]);
  });

  it('returns nothing for no records', () => {
    expect(totalsByMethod([])).toEqual([]);
  });
});
