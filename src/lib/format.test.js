import { describe, it, expect } from 'vitest';
import { fmt, setExchangeRates } from './format';

describe('fmt', () => {
  it('formats COP with a period as the thousands separator', () => {
    expect(fmt(60000, 'COP')).toBe('$60.000');
  });

  it('treats a missing/zero amount as $0', () => {
    expect(fmt(0, 'COP')).toBe('$0');
    expect(fmt(null, 'COP')).toBe('$0');
    expect(fmt(undefined, 'COP')).toBe('$0');
  });

  it('rounds COP to a whole number', () => {
    expect(fmt(1234.6, 'COP')).toBe('$1.235');
  });

  it('converts to USD using the current exchange rate', () => {
    setExchangeRates({ USD: 5000 });
    expect(fmt(100000, 'USD')).toBe('$20.00');
  });

  it('converts to EUR using the current exchange rate', () => {
    setExchangeRates({ EUR: 4000 });
    expect(fmt(80000, 'EUR')).toBe('€20.00');
  });

  it('picking up a new rate does not disturb the other currency', () => {
    setExchangeRates({ USD: 4000, EUR: 4500 });
    setExchangeRates({ USD: 5000 });
    expect(fmt(4500, 'EUR')).toBe('€1.00');
  });
});
