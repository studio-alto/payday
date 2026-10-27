import { describe, it, expect } from 'vitest';
import { upcomingEvents, eventsForDay } from './upcoming';

const now = new Date(2026, 9, 20); // 20 Oct 2026

const base = {
  incomes: [
    { id: 'a', name: 'Sueldo', amount: 1000, date: '2026-10-28', estado: 'proyectado' },
    { id: 'b', name: 'Ya recibido', amount: 500, date: '2026-10-25', estado: 'confirmado' },
    { id: 'c', name: 'Muy lejos', amount: 700, date: '2026-12-30', estado: 'proyectado' },
    { id: 'd', name: 'Pasado', amount: 50, date: '2026-10-10', estado: 'proyectado' },
  ],
  expenses: [
    { id: 'e1', name: 'Arriendo', amount: 900, dueDay: 25, history: [], archived: false },
    { id: 'e2', name: 'Netflix', amount: 40, dueDay: 22, history: [{ date: '2026-10-05', amount: 40 }], archived: false },
    { id: 'e3', name: 'Viejo', amount: 10, dueDay: 23, history: [], archived: true },
  ],
  cards: [
    { id: 'k1', name: 'Nu', balance: 400, minPayment: 100, nextPayment: '2026-10-27', archived: false, history: [{ date: '2026-10-18', amount: 100, metodo: 'Nequi' }] },
    { id: 'k2', name: 'Pagada', balance: 0, minPayment: 100, nextPayment: '2026-10-26', archived: false, history: [] },
  ],
  gastosVariables: [{ id: 'v1', name: 'Almuerzo', categoria: 'Comida', amount: 15, date: '2026-10-20', metodo: 'Efectivo' }],
};

describe('upcomingEvents', () => {
  it('lists only what is still ahead, soonest first, within the horizon', () => {
    const events = upcomingEvents(base, now, 30);
    expect(events.map((e) => `${e.date} ${e.kind} ${e.title}`)).toEqual([
      '2026-10-25 gasto Arriendo',
      '2026-10-27 deuda Nu',
      '2026-10-28 ingreso Sueldo',
    ]);
  });

  it('skips fixed expenses already paid this month, archived ones, paid-off debts, and past/confirmed incomes', () => {
    const titles = upcomingEvents(base, now).map((e) => e.title);
    expect(titles).not.toContain('Netflix');
    expect(titles).not.toContain('Viejo');
    expect(titles).not.toContain('Pagada');
    expect(titles).not.toContain('Ya recibido');
    expect(titles).not.toContain('Pasado');
  });

  it('counts calendar days from today', () => {
    const events = upcomingEvents(base, now);
    expect(events.find((e) => e.title === 'Arriendo').days).toBe(5);
  });

  it('respects a shorter horizon', () => {
    expect(upcomingEvents(base, now, 6).map((e) => e.title)).toEqual(['Arriendo']);
  });

  it('copes with empty data', () => {
    expect(upcomingEvents({}, now)).toEqual([]);
  });
});

describe('eventsForDay', () => {
  it('returns incomes, payments and variable expenses that happened on that day', () => {
    expect(eventsForDay(base, '2026-10-20', now).map((e) => e.title)).toEqual(['Almuerzo']);
    expect(eventsForDay(base, '2026-10-18', now).map((e) => `${e.kind}:${e.title}:${e.detail}`)).toEqual(['deuda:Nu:Abono']);
  });

  it('returns what falls due on a future day', () => {
    expect(eventsForDay(base, '2026-10-25', now).map((e) => `${e.kind}:${e.title}`)).toEqual(['ingreso:Ya recibido', 'gasto:Arriendo']);
    expect(eventsForDay(base, '2026-10-28', now).map((e) => e.detail)).toEqual(['Por recibir']);
  });

  it('does not invent due dates for days in the past', () => {
    expect(eventsForDay(base, '2026-10-05', now).map((e) => e.detail)).toEqual(['Pagado']);
  });
});
