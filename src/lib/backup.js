import { todayISO, daysSince } from './dates';

const REMINDER_THRESHOLD_DAYS = 14;

// Whether Inicio should nudge about backing up — only when there's real data worth
// protecting (nothing registered yet means nothing to lose), and only once 14 days
// have passed since whichever happened more recently: the last successful backup
// (by any method — local share/download or Drive, both stamp the same
// `user.lastBackupAt`) or the last time the reminder itself was dismissed. A single
// shared field instead of separately-tracked "Drive status" — see the removed
// BackupStatusCard, which broke exactly because its own status could disagree with
// Ajustes → Datos.
export function shouldShowBackupReminder(data, now = new Date()) {
  const { incomes, goals, cards, expenses, gastosVariables } = data;
  const hasData = incomes.length > 0 || goals.length > 0 || cards.length > 0 || expenses.length > 0 || (gastosVariables || []).length > 0;
  if (!hasData) return false;

  const { lastBackupAt, backupReminderDismissedAt } = data.user;
  const candidates = [lastBackupAt, backupReminderDismissedAt].filter(Boolean);
  if (candidates.length === 0) return true;
  const mostRecent = candidates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
  return daysSince(mostRecent, now) >= REMINDER_THRESHOLD_DAYS;
}

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
    sueldosFijos: data.sueldosFijos,
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

// The no-account, works-everywhere backup path: hands the file to whatever the OS
// offers (Files/iCloud Drive on iOS, Drive/WhatsApp/"Save to device" on Android,
// AirDrop, Notes...) via the native share sheet, so nobody has to know what a JSON
// file is or where their browser puts downloads. `navigator.canShare` with a `files`
// entry is the real feature check (Web Share API Level 2) — supported on iOS Safari
// and Android Chrome/Samsung Internet, not on most desktop browsers or old Android
// WebViews, so downloadBackupJson() is the fallback there and whenever the sheet
// itself fails (not just a user cancel, which also lands in the catch).
export async function shareBackupJson(data) {
  const payload = buildBackupPayload(data);
  const file = new File([JSON.stringify(payload, null, 2)], `payday-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, {
    type: 'application/json',
  });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Respaldo de Payday' });
      return 'shared';
    } catch {
      // cancelled or failed — fall back to a plain download below
    }
  }
  downloadBackupJson(data);
  return 'downloaded';
}

// Guards against restoring a file that parses as JSON but doesn't have the shape
// the rest of the app assumes (e.g. hand-edited, or exported by a future version
// with a different schema) — those would otherwise crash later on a missing field.
// Shared by every restore entry point: file import, pasted text, and a Drive backup.
export function isValidBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  for (const key of ['incomes', 'goals', 'cards', 'expenses', 'gastosVariables', 'sueldosFijos']) {
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
  if (Array.isArray(parsed.sueldosFijos)) {
    for (const sf of parsed.sueldosFijos) {
      if (typeof sf.amount !== 'number' || typeof sf.payDayOfMonth !== 'number') return false;
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
    sueldosFijos: parsed.sueldosFijos?.length || 0,
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
    sueldosFijos: parsed.sueldosFijos || [],
  };
}
