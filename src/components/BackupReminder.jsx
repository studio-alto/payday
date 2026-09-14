import { cardStyle } from '../lib/styles';
import { daysSince } from '../lib/dates';

// Compact, dismissible nudge — not a status card. It reads the same
// `user.lastBackupAt` that Ajustes → Datos writes (see lib/backup.js), and tapping
// it just navigates there instead of repeating the backup actions or tracking its
// own "connected"/"last synced" state, on purpose: that duplication is exactly why
// the previous BackupStatusCard on Home got removed.
export default function BackupReminder({ data, setData, onNavigate }) {
  const { lastBackupAt } = data.user;
  const days = lastBackupAt ? daysSince(lastBackupAt) : null;

  const goBackup = () => {
    sessionStorage.setItem('payday_return_section', 'datos');
    onNavigate('config');
  };
  const dismiss = () => setData((s) => ({ ...s, user: { ...s.user, backupReminderDismissedAt: new Date().toISOString() } }));

  return (
    <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          {days === null ? 'Nunca has respaldado tus datos' : `No has respaldado en ${days} días`}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
          Tus datos solo viven en este dispositivo — un respaldo toma un momento.
        </div>
      </div>
      <button
        type="button"
        onClick={goBackup}
        style={{
          padding: '8px 14px',
          borderRadius: 16,
          background: 'var(--text)',
          color: 'var(--page-bg)',
          fontWeight: 700,
          fontSize: 12,
          cursor: 'pointer',
          border: 'none',
          flexShrink: 0,
        }}
      >
        Respaldar
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar recordatorio"
        style={{ fontSize: 18, lineHeight: 1, color: 'var(--text-secondary)', cursor: 'pointer', border: 'none', background: 'none', padding: 4, flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
}
