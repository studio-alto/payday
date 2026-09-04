import { todayISO } from './dates';

// The one shape every export/restore path agrees on — used by the JSON download,
// the share-sheet backup, and (via isValidBackup in Ajustes) what gets read back in.
export function buildBackupPayload(data) {
  return {
    user: data.user,
    incomes: data.incomes,
    goals: data.goals,
    cards: data.cards,
    expenses: data.expenses,
    gastosVariables: data.gastosVariables,
    exportedAt: todayISO(),
  };
}

// Plain download — the fallback when Web Share isn't available (or is cancelled),
// and the only path for a plain "descargar" action that isn't trying to share.
export function downloadBackupJson(data) {
  const payload = buildBackupPayload(data);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Full timestamp, not just the date, so two downloads on the same day (or the
  // Drive JSON backup, which names itself the same way) never collide by name.
  a.download = `payday-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Guards against restoring a file that parses as JSON but doesn't have the shape
// the rest of the app assumes (e.g. hand-edited, or exported by a future version
// with a different schema) — those would otherwise crash later on a missing field.
// Shared by every restore entry point: file import, pasted text, and a Drive backup.
export function isValidBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  for (const key of ['incomes', 'goals', 'cards', 'expenses', 'gastosVariables']) {
    if (parsed[key] !== undefined && !Array.isArray(parsed[key])) return false;
  }
  if (Array.isArray(parsed.incomes)) {
    for (const i of parsed.incomes) {
      if (typeof i.amount !== 'number' || typeof i.date !== 'string' || typeof i.distribution !== 'object' || i.distribution === null) return false;
    }
  }
  if (Array.isArray(parsed.goals)) {
    for (const g of parsed.goals) {
      if (typeof g.target !== 'number' || typeof g.current !== 'number') return false;
    }
  }
  if (Array.isArray(parsed.cards)) {
    for (const c of parsed.cards) {
      if (typeof c.balance !== 'number' || !Array.isArray(c.history)) return false;
    }
  }
  if (Array.isArray(parsed.expenses)) {
    for (const e of parsed.expenses) {
      if (typeof e.amount !== 'number' || !Array.isArray(e.history)) return false;
    }
  }
  return true;
}

// The counts shown before committing to a restore (file, pasted text, or a Drive
// backup) — so "reemplazar mis datos" is never a leap of faith.
export function summarizeBackup(parsed) {
  return {
    incomes: parsed.incomes?.length || 0,
    goals: parsed.goals?.length || 0,
    cards: parsed.cards?.length || 0,
    expenses: parsed.expenses?.length || 0,
    gastosVariables: parsed.gastosVariables?.length || 0,
  };
}

// What actually replaces the app's state on a successful restore — the same shape
// loadInitial() falls back to per-field, so a backup missing a field (older export,
// hand-edited) restores everything else instead of crashing. `user` is merged, not
// replaced outright: an older backup missing a field that didn't exist yet when it
// was made (e.g. onboarded, appLockPin) shouldn't silently reset it on this device —
// every field the backup does set still wins over what's here now.
export function applyRestoredBackup(parsed, currentUser) {
  return {
    user: { ...currentUser, ...(parsed.user || {}) },
    incomes: parsed.incomes || [],
    goals: parsed.goals || [],
    cards: parsed.cards || [],
    expenses: parsed.expenses || [],
    gastosVariables: parsed.gastosVariables || [],
  };
}
