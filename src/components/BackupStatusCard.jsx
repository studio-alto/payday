import { useEffect, useState } from 'react';
import { formatRelativeTime } from '../lib/dates';
import { cardStyle, labelStyle } from '../lib/styles';
import { googleConfigured, hasConnectedBefore, getAccessToken, connectGoogle, consumeRedirectResult } from '../lib/googleAuth';
import { backupSummaryToDrive, backupJsonToDrive } from '../lib/googleDrive';
import { sendReportLinkEmail } from '../lib/emailBackup';
import { shareBackupJson } from '../lib/backup';
import Toast from './Toast';

// Home-screen counterpart to the same backup actions in Ajustes → Datos — same
// underlying functions (backupSummaryToDrive, shareBackupJson), so syncing from
// either place keeps the other one's "última sincronización" correct too.
export default function BackupStatusCard({ data, setData }) {
  const [status, setStatus] = useState('idle'); // idle | loading | error (success shows as a Toast, not a lingering state)
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null); // { message, variant }
  const connected = hasConnectedBefore();
  // hasConnectedBefore() only means "granted access at some point" — it stays true
  // long after the ~1h session token dies, which used to be exactly what made this
  // card claim "✓ Conectado" while every sync attempt failed silently. This flag
  // tracks a *this-visit* reconnect failure so the label can stop lying once we
  // actually know the silent retry (see backupNow) didn't work.
  const [reconnectFailed, setReconnectFailed] = useState(false);
  useEffect(() => {
    if (consumeRedirectResult() === 'error') setReconnectFailed(true);
  }, []);

  const shareNow = async () => {
    const result = await shareBackupJson(data);
    if (result === 'shared') setToast({ message: '✓ Copia guardada', variant: 'success' });
    else if (result === 'downloaded') setToast({ message: '✓ Backup descargado', variant: 'success' });
  };

  const connectFromHere = () => {
    // Remember to land back on Home once Google redirects back (full-page
    // redirect — installed PWAs on iOS can't do this via a popup).
    sessionStorage.setItem('payday_return_tab', 'dashboard');
    // Only try the invisible reconnect once per visit — if it already bounced
    // back with an error, a second silent attempt would just fail the same way,
    // so this time show the real consent screen instead.
    connectGoogle({ silent: connected && !reconnectFailed });
    setReconnectFailed(false);
  };

  const backupNow = async () => {
    // Guards re-entry during a run without a real `disabled` attribute on the
    // button (see below) — a fast double-tap just no-ops on the second tap.
    if (status === 'loading') return;
    setStatus('loading');
    setError('');
    try {
      const accessToken = getAccessToken();
      if (!accessToken) {
        // The ~1h session token is gone (very common — iOS/Android PWAs get their
        // whole session wiped often), but Drive access was granted before, so try
        // reconnecting invisibly instead of hanging forever on a token that will
        // never show up. This navigates away and back; if the browser's Google
        // session is also gone, connectFromHere's redirect bounces back with an
        // error, which the effect above picks up as reconnectFailed.
        setStatus('idle');
        connectFromHere();
        return;
      }
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

  const loading = status === 'loading';
  // hasConnectedBefore() alone used to be shown as "conectado" forever, even once
  // a same-visit silent reconnect had already come back with an error — this is
  // the one case where the label needs to stop claiming a working connection.
  const driveNeedsReconnect = connected && reconnectFailed;
  const driveLabel = !connected ? '✗ No conectado' : driveNeedsReconnect ? '⚠ Reconecta tu cuenta' : '✓ Conectado a Google Drive';
  const driveLabelColor = !connected ? 'var(--text-secondary)' : driveNeedsReconnect ? 'var(--danger-text)' : 'var(--good-text)';

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {toast && <Toast message={toast.message} onClose={() => setToast(null)} variant={toast.variant} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={labelStyle}>🔒 RESPALDO</div>
        {googleConfigured && <div style={{ fontSize: 12, fontWeight: 700, color: driveLabelColor }}>{driveLabel}</div>}
      </div>

      {googleConfigured && (
        <div style={{ fontSize: 13, color: 'var(--text)' }}>
          Última sincronización con Drive: <b>{data.user.lastDriveSyncAt ? formatRelativeTime(data.user.lastDriveSyncAt) : 'Nunca sincronizado'}</b>
        </div>
      )}

      {status === 'error' && <div style={{ fontSize: 12, color: 'var(--danger-text)' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={shareNow}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 16,
            background: 'var(--good)',
            color: 'white',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            border: 'none',
          }}
        >
          Guardar copia de seguridad
        </button>
        {googleConfigured && (
          <button
            type="button"
            onClick={backupNow}
            disabled={!connected}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 16,
              background: 'var(--input-bg)',
              color: !connected ? 'var(--text-secondary)' : 'var(--text)',
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
                  border: '2px solid rgba(0,0,0,0.25)',
                  borderTopColor: 'var(--text)',
                  animation: 'payday-spin 0.7s linear infinite',
                  flexShrink: 0,
                }}
              />
            )}
            {loading ? 'Sincronizando…' : 'Respaldar a Drive'}
          </button>
        )}
      </div>

      {googleConfigured && (!connected || driveNeedsReconnect) && (
        <button
          type="button"
          onClick={connectFromHere}
          style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
        >
          {connected ? 'Reconectar Google →' : 'Conectar Google →'}
        </button>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Tus datos se guardan en este dispositivo. "Guardar copia de seguridad" la manda a donde tú elijas —
        Archivos, iCloud Drive, Google Drive, WhatsApp— y funciona en cualquier equipo, con o sin cuenta de Google.
        {googleConfigured && ' "Respaldar a Drive" además la sube directo a tu carpeta de Drive.'} Para restaurar
        cualquiera de las dos, ve a Ajustes → Datos → "Restaurar datos".
      </div>
    </div>
  );
}
