import { useEffect, useState } from 'react';

export const STORAGE_KEY = 'payday-pwa-data-v1';

// A brand-new install starts completely empty — `onboarded: false` is what
// triggers the welcome screen. Any *existing* saved session (even one from
// before this flag existed) is treated as already onboarded below, so it
// never resurfaces for people already using the app.
function seedData() {
  return {
    user: { currency: 'COP', payBaseDay: 60000, payDayOfMonth: 1, theme: 'light', debtMethod: 'bola_nieve', onboarded: false },
    incomes: [],
    goals: [],
    cards: [],
    expenses: [],
  };
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const user = parsed.user || seedData().user;
      return {
        user: { ...user, onboarded: user.onboarded ?? true },
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
