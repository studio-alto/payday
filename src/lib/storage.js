import { useEffect, useState } from 'react';
import { isoOffset } from './dates';

export const STORAGE_KEY = 'payday-pwa-data-v1';

function seedData() {
  return {
    user: { currency: 'COP', payBaseDay: 60000, payDayOfMonth: 1, theme: 'light', debtMethod: 'bola_nieve' },
    incomes: [
      { id: 'i1', name: 'Turno restaurante', amount: 60000, date: isoOffset(-4), type: 'normal', note: '', distribution: { ahorro: 12000, tarjeta: 9000 } },
      { id: 'i2', name: 'Domingo obra', amount: 95000, date: isoOffset(-3), type: 'finSemana', note: 'Turno extra', distribution: { ahorro: 30000, tarjeta: 15000 } },
      { id: 'i3', name: 'Festivo repartos', amount: 118000, date: isoOffset(-2), type: 'festivo', note: '', distribution: { ahorro: 40000, tarjeta: 20000 } },
      { id: 'i4', name: 'Turno restaurante', amount: 60000, date: isoOffset(-1), type: 'normal', note: '', distribution: { ahorro: 12000, tarjeta: 9000 } },
    ],
    goals: [
      { id: 'g1', name: 'Fondo de emergencia', target: 2000000, current: 480000, description: '', estado: 'activa' },
      { id: 'g2', name: 'Viaje', target: 900000, current: 210000, description: '', estado: 'activa' },
      { id: 'g3', name: 'Laptop', target: 2600000, current: 560000, description: '', estado: 'activa' },
    ],
    cards: [
      { id: 'c1', name: 'Visa Roja', tipo: 'Tarjeta de crédito', balance: 780000, nextPayment: isoOffset(15), minPayment: 95000, interestRate: 28, history: [] },
      { id: 'c2', name: 'Falabella', tipo: 'Tarjeta de crédito', balance: 180000, nextPayment: isoOffset(10), minPayment: 40000, interestRate: 32, history: [] },
      { id: 'c3', name: 'Préstamo libre inversión', tipo: 'Préstamo', balance: 1500000, nextPayment: isoOffset(23), minPayment: 120000, interestRate: 19, history: [] },
    ],
    expenses: [
      { id: 'e1', name: 'Netflix', categoria: 'Suscripción', amount: 29900, dueDay: 5, medioPago: 'efectivo', history: [] },
      { id: 'e2', name: 'Internet hogar', categoria: 'Servicios', amount: 95000, dueDay: 12, medioPago: 'efectivo', history: [] },
      { id: 'e3', name: 'Transporte', categoria: 'Transporte', amount: 120000, dueDay: 1, medioPago: 'efectivo', history: [] },
    ],
  };
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        user: parsed.user || seedData().user,
        incomes: parsed.incomes || [],
        goals: parsed.goals || [],
        cards: parsed.cards || [],
        expenses: parsed.expenses || [],
      };
    }
  } catch {
    // corrupted localStorage — fall back to seed data below
  }
  return seedData();
}

export function useLocalData() {
  const [data, setData] = useState(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage unavailable (e.g. private browsing) — app still works in-memory
    }
  }, [data]);

  return [data, setData];
}
