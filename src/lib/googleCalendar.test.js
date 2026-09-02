import { describe, expect, it } from 'vitest';
import { buildEvents } from './googleCalendar';

const baseData = {
  user: { currency: 'COP' },
  cards: [],
  expenses: [],
  incomes: [],
};

describe('buildEvents', () => {
  it('builds one all-day event per debt with a positive balance', () => {
    const data = {
      ...baseData,
      cards: [
        { id: 'c1', name: 'Visa', balance: 100000, minPayment: 20000, nextPayment: '2026-09-10' },
        { id: 'c2', name: 'Pagada', balance: 0, minPayment: 0, nextPayment: '2026-09-10' },
      ],
    };
    const events = buildEvents(data);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Pago: Visa');
    expect(events[0].start).toEqual({ date: '2026-09-10' });
    expect(events[0].end).toEqual({ date: '2026-09-11' });
  });

  it('builds one event per gasto fijo and one per proyectado income', () => {
    const data = {
      ...baseData,
      expenses: [{ id: 'e1', name: 'Netflix', categoria: 'Suscripción', amount: 30000, dueDay: 15 }],
      incomes: [
        { id: 'i1', name: 'Turno futuro', amount: 90000, date: '2026-09-20', estado: 'proyectado' },
        { id: 'i2', name: 'Ya confirmado', amount: 50000, date: '2026-09-01', estado: 'confirmado' },
      ],
    };
    const events = buildEvents(data);
    expect(events.map((e) => e.summary)).toEqual(['Vence: Netflix', 'Ingreso esperado: Turno futuro']);
  });

  it('generates deterministic, Calendar-valid ids (lowercase 0-9a-v, 5+ chars)', () => {
    const data = { ...baseData, cards: [{ id: 'card-abc', name: 'Visa', balance: 1, minPayment: 0, nextPayment: '2026-09-10' }] };
    const [a] = buildEvents(data);
    const [b] = buildEvents(data);
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^[0-9a-v]{5,1024}$/);
  });
});
