import { useState } from 'react';
import { formatRelativeTime } from '../lib/dates';
import { cardStyle, labelStyle } from '../lib/styles';
import { googleConfigured, hasConnectedBefore, getAccessToken, connectGoogle } from '../lib/googleAuth';
import { backupSummaryToDrive, backupJsonToDrive } from '../lib/googleDrive';
import { sendReportLinkEmail } from '../lib/emailBackup';
import { downloadBackupJson } from '../lib/backup';
import Toast from './Toast';

// Home-screen counterpart to the same backup actions in Ajustes → Datos — same
// underlying functions (backupSummaryToDrive, downloadBackupJson), so syncing from
// either place keeps the other one's "última sincronización" correct too.
export default function BackupStatusCard({ data, setData }) {
  const [status, setStatus] = useState('idle'); // idle | loading | error (success shows as a Toast, not a lingering state)
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null); // { message, variant }
  const connected = hasConnectedBefore();

  if (!googleConfigured) return null;

  const backupNow = async () => {
    // Guards re-entry during a run without a real `disabled` attribute on the
    // button (see below) — a fast double-tap just no-ops on the second tap.
    if (status === 'loading') return;
    setStatus('loading');
    setError('');
    try {
      const accessToken = getAccessToken();
      if (!accessToken) return; // button is disabled whenever this would be null — see below
      const link = await backupSummaryToDrive(accessToken, data);
      // Alongside the human-readable Excel: a machine-readable JSON backup, so
      // "Restaurar datos → Sincronizar con Google Drive" has something real to list.
      await backupJsonToDrive(accessToken, data);
      setData((s) => ({ ...s, user: { ...s.user, lastDriveSyncAt: new Date().toISOString() } }));
      if (data.user.backupEmail) await sendReportLinkEmail(link, data.user.backupEmail);
      setStatus('idle');
      setToast({ message: '✓ Respaldado correctamente', variant: 'success' });
    } catch (err) {
      const message = err.message || 'Algo salió mal al respaldar. Intenta de nuevo.';
      setError(message);
      setStatus('error');
      setToast({ message, variant: 'error' });
    }
  };

  const connectFromHere = () => {
    // Remember to land back on Home once Google redirects back (full-page
    // redirect — installed PWAs on iOS can't do this via a popup).
    sessionStorage.setItem('payday_return_tab', 'dashboard');
    connectGoogle({ silent: connected });
  };

  const loading = status === 'loading';

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {toast && <Toast message={toast.message} onClose={() => setToast(null)} variant={toast.variant} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={labelStyle}>🔒 RESPALDO</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: connected ? 'var(--good-text)' : 'var(--text-secondary)' }}>
          {connected ? '✓ Conectado a Google Drive' : '✗ No conectado'}
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text)' }}>
        Última sincronización: <b>{data.user.lastDriveSyncAt ? formatRelativeTime(data.user.lastDriveSyncAt) : 'Nunca sincronizado'}</b>
      </div>

      {status === 'error' && <div style={{ fontSize: 12, color: 'var(--danger-text)' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={backupNow}
          disabled={!connected}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 16,
            background: !connected ? 'var(--input-bg)' : 'var(--good)',
            color: !connected ? 'var(--text-secondary)' : 'white',
            fontWeight: 700,
            fontSize: 13,
            cursor: !connected ? 'default' : 'pointer',
            border: 'none',
            opacity: loading ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading && (
            <div
              style={{
                width: 13,
                height: 13,
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: 'white',
                animation: 'payday-spin 0.7s linear infinite',
                flexShrink: 0,
              }}
            />
          )}
          {loading ? 'Sincronizando…' : 'Respaldar ahora'}
        </button>
        <button
          type="button"
          onClick={() => {
            downloadBackupJson(data);
            setToast({ message: '✓ Backup descargado', variant: 'success' });
          }}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 16,
            background: 'var(--input-bg)',
            color: 'var(--text)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            border: 'none',
          }}
        >
          Descargar backup
        </button>
      </div>

      {!connected && (
        <button
          type="button"
          onClick={connectFromHere}
          style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
        >
          Conectar Google →
        </button>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Tus datos se guardan en este dispositivo. "Respaldar ahora" sube una copia a tu Drive. Impórtala en
        Ajustes → Datos → "Restaurar datos" si cambias de equipo. "Descargar backup" funciona incluso sin conectar Google.
      </div>
    </div>
  );
}
