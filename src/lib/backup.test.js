import { describe, it, expect } from 'vitest';
import { shouldShowBackupReminder } from './backup';

function emptyData(userOverrides = {}) {
  return {
    user: userOverrides,
    incomes: [],
    goals: [],
    cards: [],
    expenses: [],
    gastosVariables: [],
  };
}

describe('shouldShowBackupReminder', () => {
  it('never shows with no data registered yet — nothing to lose', () => {
    expect(shouldShowBackupReminder(emptyData())).toBe(false);
  });

  it('shows once there is data and no backup has ever been made', () => {
    const data = { ...emptyData(), incomes: [{ id: 'i1' }] };
    expect(shouldShowBackupReminder(data)).toBe(true);
  });

  it('does not show right after a recent backup', () => {
    const now = new Date(2026, 8, 15);
    const data = { ...emptyData({ lastBackupAt: new Date(2026, 8, 10).toISOString() }), incomes: [{ id: 'i1' }] };
    expect(shouldShowBackupReminder(data, now)).toBe(false);
  });

  it('shows again once 14+ days have passed since the last backup', () => {
    const now = new Date(2026, 8, 15);
    const data = { ...emptyData({ lastBackupAt: new Date(2026, 7, 1).toISOString() }), incomes: [{ id: 'i1' }] };
    expect(shouldShowBackupReminder(data, now)).toBe(true);
  });

  it('a dismissal snoozes it, even with an older lastBackupAt', () => {
    const now = new Date(2026, 8, 15);
    const data = {
      ...emptyData({
        lastBackupAt: new Date(2026, 6, 1).toISOString(),
        backupReminderDismissedAt: new Date(2026, 8, 10).toISOString(),
      }),
      incomes: [{ id: 'i1' }],
    };
    expect(shouldShowBackupReminder(data, now)).toBe(false);
  });

  it('a real backup after a dismissal resets the clock from the backup', () => {
    const now = new Date(2026, 8, 15);
    const data = {
      ...emptyData({
        backupReminderDismissedAt: new Date(2026, 7, 1).toISOString(),
        lastBackupAt: new Date(2026, 8, 10).toISOString(),
      }),
      incomes: [{ id: 'i1' }],
    };
    expect(shouldShowBackupReminder(data, now)).toBe(false);
  });
});
