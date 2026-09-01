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
    gastosVariables: [],
  };
}

function loadInitial() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return seedData(); // storage unavailable entirely (e.g. private browsing)
  }
  if (!raw) return seedData();

  try {
    const parsed = JSON.parse(raw);
    const user = parsed.user || seedData().user;
    return {
      user: { ...user, onboarded: user.onboarded ?? true },
      incomes: parsed.incomes || [],
      goals: parsed.goals || [],
      cards: parsed.cards || [],
      expenses: parsed.expenses || [],
      gastosVariables: parsed.gastosVariables || [],
    };
  } catch {
    // Corrupted JSON — preserve the raw string under a separate key before falling
    // back to an empty app, so it isn't silently overwritten and gone for good the
    // moment this session saves again. Still recoverable by hand even though the
    // app itself can't parse it.
    try {
      localStorage.setItem(`${STORAGE_KEY}-corrupted-${Date.now()}`, raw);
    } catch {
      // best-effort only
    }
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(
        'No se pudieron leer tus datos guardados — puede que se hayan dañado. Se guardó una copia del archivo original por si se puede recuperar más adelante. La app va a iniciar vacía.',
      );
    }
    return seedData();
  }
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
