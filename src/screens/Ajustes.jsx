import { useEffect, useState } from 'react';
import { todayISO, formatFullDate } from '../lib/dates';
import { referenceIncome } from '../lib/incomeStats';
import { fetchLiveExchangeRates } from '../lib/exchangeRates';
import { fmt } from '../lib/format';
import { cardStyle, labelStyle, textInputStyle } from '../lib/styles';
import { hashPin } from '../lib/pin';
import { sendBackupEmail, sendReportLinkEmail, emailBackupConfigured } from '../lib/emailBackup';
import { googleConfigured, hasValidToken, hasConnectedBefore, consumeRedirectResult, getAccessToken, connectGoogle, disconnectGoogle } from '../lib/googleAuth';
import { backupSummaryToDrive, backupJsonToDrive } from '../lib/googleDrive';
import { buildBackupPayload, downloadBackupJson } from '../lib/backup';
import { syncFinancialEventsToCalendar } from '../lib/googleCalendar';
import NumberInput from '../components/NumberInput';
import FixedHeader from '../components/FixedHeader';
import BottomSheet from '../components/BottomSheet';
import PinPad from '../components/PinPad';

export default function Ajustes({ data, setData, canInstall, isInstalled, onInstall, onNavigate }) {
  const { user } = data;
  const dark = user.theme === 'oscuro';
  // Restores the "Datos" tab after a Google connect redirect bounces the
  // whole page away and back (see connectGoogle() in lib/googleAuth) — otherwise
  // returning from Google would land back on "General" with no indication of why.
  const [section, setSection] = useState(() => {
    const pending = sessionStorage.getItem('payday_return_section');
    if (pending) sessionStorage.removeItem('payday_return_section');
    return pending || 'general';
  });
  const budgetTotal = (user.budgetNecesidades ?? 50) + (user.budgetDeseos ?? 30) + (user.budgetAhorro ?? 20);
  const incomeMode = user.incomeMode || 'variable';
  const setIncomeMode = (mode) => setData((s) => ({ ...s, user: { ...s.user, incomeMode: mode } }));
  const avgRecentIncome = referenceIncome(data.incomes, incomeMode);
  const [ratesStatus, setRatesStatus] = useState('idle');

  const [pinFlow, setPinFlow] = useState(null);
  const [pinResetSignal, setPinResetSignal] = useState(0);
  const bumpPinReset = () => setPinResetSignal((n) => n + 1);
  const startPinSetup = () => setPinFlow({ action: 'setup', phase: 'new1', firstPin: null, error: null });
  const startPinChange = () => setPinFlow({ action: 'change', phase: 'verify', firstPin: null, error: null });
  const startPinDisable = () => setPinFlow({ action: 'disable', phase: 'verify', firstPin: null, error: null });
  const closePinFlow = () => setPinFlow(null);

  const handlePinDigits = async (digits) => {
    if (!pinFlow) return;
    if (pinFlow.phase === 'verify') {
      const hash = await hashPin(digits);
      if (hash !== user.appLockPin) {
        setPinFlow((f) => ({ ...f, error: 'PIN incorrecto' }));
        bumpPinReset();
        return;
      }
      if (pinFlow.action === 'disable') {
        setData((s) => ({ ...s, user: { ...s.user, appLockPin: null } }));
        closePinFlow();
        return;
      }
      setPinFlow({ action: 'change', phase: 'new1', firstPin: null, error: null });
      bumpPinReset();
      return;
    }
    if (pinFlow.phase === 'new1') {
      setPinFlow((f) => ({ ...f, phase: 'new2', firstPin: digits, error: null }));
      bumpPinReset();
      return;
    }
    if (pinFlow.phase === 'new2') {
      if (digits !== pinFlow.firstPin) {
        setPinFlow((f) => ({ ...f, phase: 'new1', firstPin: null, error: 'Los PIN no coinciden, intenta otra vez' }));
        bumpPinReset();
        return;
      }
      const hash = await hashPin(digits);
      setData((s) => ({ ...s, user: { ...s.user, appLockPin: hash } }));
      closePinFlow();
    }
  };

  const pinPhaseLabel = pinFlow?.phase === 'verify' ? 'Ingresa tu PIN actual' : pinFlow?.phase === 'new1' ? 'Crea un PIN de 4 dígitos' : 'Confirma tu PIN';

  const refreshRates = async () => {
    setRatesStatus('loading');
    try {
      const rates = await fetchLiveExchangeRates();
      setData((s) => ({ ...s, user: { ...s.user, ...rates, ratesUpdatedAt: todayISO() } }));
      setRatesStatus('idle');
    } catch {
      setRatesStatus('error');
    }
  };

  const setUserField = (key, transform = (v) => v) => (e) => {
    setData((s) => ({ ...s, user: { ...s.user, [key]: transform(e.target.value) } }));
  };

  const toggleTheme = () => {
    setData((s) => ({ ...s, user: { ...s.user, theme: s.user.theme === 'oscuro' ? 'light' : 'oscuro' } }));
  };

  const exportData = () => downloadBackupJson(data);

  const shareBackup = async () => {
    const payload = buildBackupPayload(data);
    const file = new File([JSON.stringify(payload, null, 2)], `payday-datos-${todayISO()}.json`, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Respaldo de Payday' });
        return;
      } catch {
        // person cancelled the share sheet, or it failed — fall back to a plain download
      }
    }
    exportData();
  };

  const [emailStatus, setEmailStatus] = useState('idle');
  const sendEmailBackup = async () => {
    if (!user.backupEmail) return;
    setEmailStatus('loading');
    try {
      await sendBackupEmail(data, user.backupEmail);
      setEmailStatus('sent');
    } catch {
      setEmailStatus('error');
    }
  };

  const [excelStatus, setExcelStatus] = useState('idle');
  const exportExcel = async () => {
    setExcelStatus('loading');
    try {
      // ExcelJS is a heavy library (~250KB gzipped) only this one action needs —
      // loaded on demand so it doesn't bloat the Ajustes screen's own chunk (which
      // the PWA precaches) for every visit that never touches the export button.
      const { buildSummaryWorkbook } = await import('../lib/exportExcel');
      const blob = await buildSummaryWorkbook(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payday-resumen-${todayISO()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setExcelStatus('idle');
    } catch {
      setExcelStatus('error');
    }
  };

  const [driveStatus, setDriveStatus] = useState('idle'); // idle | loading | uploaded | emailed | error
  const [driveError, setDriveError] = useState('');
  const [calendarStatus, setCalendarStatus] = useState('idle'); // idle | loading | synced | error
  const [calendarError, setCalendarError] = useState('');
  const connectedToGoogle = hasValidToken();
  // If a silent reconnect attempt (see startGoogleConnect below) just failed —
  // Google bounced back with an error instead of a token — say so, since
  // otherwise it looks like the button silently did nothing.
  const [silentReconnectFailed, setSilentReconnectFailed] = useState(false);
  useEffect(() => {
    if (consumeRedirectResult() === 'error') setSilentReconnectFailed(true);
  }, []);
  const startGoogleConnect = () => {
    // Remember where we were — connectGoogle() leaves the app entirely (Google's
    // consent screen, then back), so the next load needs to know to land back on
    // this tab instead of the default Home screen.
    sessionStorage.setItem('payday_return_tab', 'config');
    sessionStorage.setItem('payday_return_section', 'datos');
    setSilentReconnectFailed(false);
    // Once connected before, the ~1h token expiring shouldn't mean re-approving
    // by hand every time — try an invisible reconnect first (works as long as
    // the browser's own Google session is still active) before falling back to
    // the real consent screen.
    connectGoogle({ silent: hasConnectedBefore() });
  };

  const [disconnectStatus, setDisconnectStatus] = useState('idle'); // idle | loading | done | error
  const disconnectGoogleAccount = async () => {
    setDisconnectStatus('loading');
    try {
      await disconnectGoogle();
      setDisconnectStatus('done');
    } catch {
      setDisconnectStatus('error');
    }
  };

  const sendToDrive = async () => {
    setDriveStatus('loading');
    setDriveError('');
    try {
      const accessToken = getAccessToken();
      const link = await backupSummaryToDrive(accessToken, data);
      // Alongside the human-readable Excel: a machine-readable JSON backup, so
      // "Restaurar datos → Sincronizar con Google Drive" has something real to list.
      await backupJsonToDrive(accessToken, data);
      // Same field the Home screen's backup status card reads — syncing from either
      // place should update the same "última sincronización" the person sees there.
      setData((s) => ({ ...s, user: { ...s.user, lastDriveSyncAt: new Date().toISOString() } }));
      if (user.backupEmail) {
        await sendReportLinkEmail(link, user.backupEmail);
        setDriveStatus('emailed');
      } else {
        setDriveStatus('uploaded');
      }
    } catch (err) {
      setDriveError(err.message || 'Algo salió mal.');
      setDriveStatus('error');
    }
  };
  const syncCalendar = async () => {
    setCalendarStatus('loading');
    setCalendarError('');
    try {
      const accessToken = getAccessToken();
      await syncFinancialEventsToCalendar(accessToken, data);
      setCalendarStatus('synced');
    } catch (err) {
      setCalendarError(err.message || 'Algo salió mal.');
      setCalendarStatus('error');
    }
  };

  // Restoring and wiping data now live in their own screen (Ajustes → Datos →
  // "Restaurar datos"), reached via onNavigate('restaurar') below — see
  // screens/RestaurarDatos.jsx.

  const actionRowStyle = {
    padding: 12,
    borderRadius: 14,
    background: 'var(--input-bg)',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text)',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 'var(--header-h, 88px)' }}>
      <FixedHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>Ajustes</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'general', label: 'General' },
              { key: 'finanzas', label: 'Finanzas' },
              { key: 'seguridad', label: 'Seguridad' },
              { key: 'datos', label: 'Datos' },
            ].map((s) => {
              const active = section === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  style={{
                    flex: 1,
                    padding: '9px 0',
                    borderRadius: 20,
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    background: active ? 'var(--text)' : 'var(--input-bg)',
                    color: active ? 'var(--page-bg)' : 'var(--text)',
                    border: 'none',
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </FixedHeader>

      {section === 'general' && (canInstall || isInstalled) && (
        <>
          <div style={labelStyle}>APP</div>
          <div style={cardStyle}>
            {isInstalled ? (
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>App instalada en este dispositivo ✓</div>
            ) : (
              <button type="button" onClick={onInstall} style={{ ...actionRowStyle, background: 'var(--accent)', color: 'white' }}>
                Instalar app
              </button>
            )}
          </div>
        </>
      )}

      {section === 'general' && (
        <>
          <div style={labelStyle}>APARIENCIA</div>
          <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>Tema oscuro</div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Alternar tema oscuro"
              style={{
                width: 46,
                height: 27,
                borderRadius: 20,
                background: dark ? 'var(--accent)' : '#E5E5E5',
                position: 'relative',
                cursor: 'pointer',
                border: 'none',
                padding: 0,
              }}
            >
              <div
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: '50%',
                  background: 'white',
                  position: 'absolute',
                  top: 3,
                  left: dark ? 22 : 3,
                  transition: 'left 0.2s ease',
                }}
              />
            </button>
          </div>

          <div style={labelStyle}>AYUDA</div>
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={() => window.open('https://claude.ai/code/artifact/80b6d8ee-ce43-454a-9116-d0a82792a636', '_blank', 'noopener,noreferrer')}
              style={actionRowStyle}
            >
              Guía de uso
            </button>
            <button
              type="button"
              onClick={() => window.open('https://claude.ai/code/artifact/e3ca2e18-7982-4aad-b8db-4c4e5e514c30', '_blank', 'noopener,noreferrer')}
              style={actionRowStyle}
            >
              Política de privacidad
            </button>
          </div>
        </>
      )}

      {section === 'finanzas' && (
      <>
      <div style={labelStyle}>FINANZAS</div>
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>TIPO DE INGRESO</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setIncomeMode('variable')}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: 14,
                textAlign: 'center',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                background: incomeMode === 'variable' ? 'var(--text)' : 'var(--input-bg)',
                color: incomeMode === 'variable' ? 'var(--page-bg)' : 'var(--text)',
                border: 'none',
              }}
            >
              Variable (día a día)
            </button>
            <button
              type="button"
              onClick={() => setIncomeMode('fijo')}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: 14,
                textAlign: 'center',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                background: incomeMode === 'fijo' ? 'var(--text)' : 'var(--input-bg)',
                color: incomeMode === 'fijo' ? 'var(--page-bg)' : 'var(--text)',
                border: 'none',
              }}
            >
              Fijo (mensual)
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            {incomeMode === 'fijo'
              ? 'Para cuando recibes un sueldo fijo una vez al mes, en vez de ingresos variables día a día.'
              : 'Para pagos que varían: turnos, domingos, festivos, etc.'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>
            {incomeMode === 'fijo' ? 'TU INGRESO MENSUAL' : 'PROMEDIO DE TUS ÚLTIMOS INGRESOS'}
          </div>
          <div style={{ ...textInputStyle(), padding: 12, borderRadius: 12, color: avgRecentIncome > 0 ? 'var(--text)' : 'var(--text-secondary)' }}>
            {avgRecentIncome > 0 ? fmt(avgRecentIncome, user.currency) : 'Aún no tienes ingresos registrados'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            {incomeMode === 'fijo'
              ? 'Es el último ingreso que registraste. Se actualiza solo cuando registras el del mes siguiente.'
              : 'Se calcula solo, del promedio de tus últimos 10 ingresos. No lo escribes tú, porque tu pago varía día a día.'}{' '}
            Se usa para sugerir el monto al registrar y para proyectar tu mes en el Dashboard.
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>MONEDA</div>
          <select value={user.currency} onChange={setUserField('currency')} style={{ ...textInputStyle(), padding: 12, borderRadius: 12 }}>
            <option value="COP">COP</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>DÍA DE PAGO DEL MES</div>
          <NumberInput
            value={user.payDayOfMonth}
            onChange={setUserField('payDayOfMonth', (v) => Math.min(31, Math.max(1, Number(v) || 1)))}
            style={{ ...textInputStyle(), padding: 12, borderRadius: 12 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>META DE INGRESO MENSUAL (OPCIONAL)</div>
          <NumberInput
            value={user.metaIngresoMensual || ''}
            onChange={setUserField('metaIngresoMensual', (v) => Number(v) || 0)}
            placeholder="Ej: 1.500.000"
            style={{ ...textInputStyle(), padding: 12, borderRadius: 12 }}
          />
        </div>
        <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>TASAS DE CAMBIO (1 COP →)</div>
          <button
            type="button"
            onClick={refreshRates}
            disabled={ratesStatus === 'loading'}
            style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-text)', cursor: ratesStatus === 'loading' ? 'default' : 'pointer' }}
          >
            {ratesStatus === 'loading' ? 'Actualizando…' : 'Actualizar ahora'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: ratesStatus === 'error' ? 'var(--danger-text)' : 'var(--text-secondary)', marginTop: -8 }}>
          {ratesStatus === 'error'
            ? 'No se pudo conectar. Revisa tu internet e intenta de nuevo.'
            : user.ratesUpdatedAt
              ? `Actualizado automáticamente: ${user.ratesUpdatedAt === todayISO() ? 'hoy' : formatFullDate(user.ratesUpdatedAt)}`
              : 'Se actualiza solo, una vez al día, cuando abres la app.'}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>USD</div>
            <NumberInput
              value={user.usdRate || 4000}
              onChange={setUserField('usdRate', (v) => Number(v) || 4000)}
              style={{ ...textInputStyle(), padding: 12, borderRadius: 12 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>EUR</div>
            <NumberInput
              value={user.eurRate || 4500}
              onChange={setUserField('eurRate', (v) => Number(v) || 4500)}
              style={{ ...textInputStyle(), padding: 12, borderRadius: 12 }}
            />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          Cuántos pesos equivalen a 1 dólar / 1 euro. Se llenan solas, pero puedes escribir un valor propio si prefieres.
        </div>
        <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>REGLA DE PRESUPUESTO</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: budgetTotal === 100 ? 'var(--text-secondary)' : 'var(--accent)' }}>
            Total: {budgetTotal}%
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>NECESIDADES</div>
            <NumberInput
              value={user.budgetNecesidades ?? 50}
              onChange={setUserField('budgetNecesidades', (v) => Math.min(100, Number(v) || 0))}
              style={{ ...textInputStyle(), padding: 12, borderRadius: 12 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>DESEOS</div>
            <NumberInput
              value={user.budgetDeseos ?? 30}
              onChange={setUserField('budgetDeseos', (v) => Math.min(100, Number(v) || 0))}
              style={{ ...textInputStyle(), padding: 12, borderRadius: 12 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>AHORRO + DEUDAS</div>
            <NumberInput
              value={user.budgetAhorro ?? 20}
              onChange={setUserField('budgetAhorro', (v) => Math.min(100, Number(v) || 0))}
              style={{ ...textInputStyle(), padding: 12, borderRadius: 12 }}
            />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          Se usa como sugerencia al registrar un ingreso y como referencia en el Dashboard. No limita lo que realmente hagas.
        </div>
      </div>
      </>
      )}

      {section === 'seguridad' && (
      <>
      <div style={labelStyle}>SEGURIDAD</div>
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!user.appLockPin ? (
          <>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              Pide un PIN de 4 dígitos cada vez que abres la app, para que nadie más vea tus datos si toma tu teléfono
              desbloqueado.
            </div>
            <div style={{ fontSize: 12, color: 'var(--danger-text)', background: 'var(--danger-soft-bg)', padding: 10, borderRadius: 12 }}>
              Si olvidas el PIN, la única forma de volver a entrar es borrar todos tus datos. No hay recuperación. Te
              recomendamos hacer un respaldo antes de activarlo.
            </div>
            <button type="button" onClick={shareBackup} style={actionRowStyle}>
              Hacer respaldo ahora
            </button>
            <button type="button" onClick={startPinSetup} style={{ ...actionRowStyle, background: 'var(--accent)', color: 'white' }}>
              Activar bloqueo con PIN
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>Bloqueo con PIN activado ✓</div>
            <button type="button" onClick={startPinChange} style={actionRowStyle}>
              Cambiar PIN
            </button>
            <button type="button" onClick={startPinDisable} style={{ ...actionRowStyle, color: 'var(--danger-text)' }}>
              Desactivar bloqueo
            </button>
          </>
        )}
      </div>

      <div style={labelStyle}>PRIVACIDAD Y SEGURIDAD</div>
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ fontSize: 16, flexShrink: 0 }}>🔒</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
            Tus datos viven en este dispositivo, no en un servidor nuestro. Solo si tú decides respaldar, se sube una
            copia a tu propio Google Drive.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ fontSize: 16, flexShrink: 0 }}>🔒</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
            Payday no ve nada de tu Drive o Calendar hasta que tú autorizas la conexión, y solo accede a lo que esta
            app misma crea, nunca al resto de tus archivos.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ fontSize: 16, flexShrink: 0 }}>🔒</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
            Puedes desconectar tu cuenta de Google cuando quieras, y volver a conectarla después sin perder nada.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ fontSize: 16, flexShrink: 0 }}>🔒</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
            Tus respaldos quedan en una carpeta "Payday" dentro de tu Drive. Puedes abrirlos o borrarlos ahí mismo
            cuando quieras.
          </div>
        </div>

        {googleConfigured && (hasConnectedBefore() || disconnectStatus === 'done') && (
          <>
            <div style={{ height: 1, background: 'var(--divider)' }} />
            {disconnectStatus !== 'done' ? (
              <button
                type="button"
                onClick={disconnectGoogleAccount}
                disabled={disconnectStatus === 'loading'}
                style={{ ...actionRowStyle, color: 'var(--danger-text)', opacity: disconnectStatus === 'loading' ? 0.5 : 1 }}
              >
                {disconnectStatus === 'loading' ? 'Desconectando…' : 'Desconectar Google Drive'}
              </button>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--accent-text)', fontWeight: 700 }}>
                Desconectado. Tus datos en Google Drive permanecen intactos.
              </div>
            )}
            {disconnectStatus === 'error' && (
              <div style={{ fontSize: 11, color: 'var(--danger-text)' }}>No se pudo desconectar. Intenta de nuevo.</div>
            )}
            <button
              type="button"
              onClick={() => window.open('https://myaccount.google.com/permissions', '_blank')}
              style={{ fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left', border: 'none', background: 'none', padding: 0 }}
            >
              También puedes revisar o quitar el acceso desde tu cuenta de Google →
            </button>
          </>
        )}
      </div>
      </>
      )}

      {pinFlow && (
        <BottomSheet onClose={closePinFlow}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', textAlign: 'center' }}>{pinPhaseLabel}</div>
          {pinFlow.error && <div style={{ fontSize: 12, color: 'var(--danger-text)', textAlign: 'center' }}>{pinFlow.error}</div>}
          <PinPad onComplete={handlePinDigits} resetSignal={pinResetSignal} />
        </BottomSheet>
      )}

      {section === 'datos' && (
      <>
      <div style={labelStyle}>DATOS</div>
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={exportExcel}
          disabled={excelStatus === 'loading'}
          style={{ ...actionRowStyle, opacity: excelStatus === 'loading' ? 0.5 : 1 }}
        >
          {excelStatus === 'loading' ? 'Generando…' : 'Descargar resumen (Excel)'}
        </button>
        <div style={{ fontSize: 11, color: excelStatus === 'error' ? 'var(--danger-text)' : 'var(--text-secondary)', marginTop: -4 }}>
          {excelStatus === 'error'
            ? 'No se pudo generar el archivo. Intenta de nuevo.'
            : 'Un Excel con una hoja de resumen y una hoja por cada sección: ingresos, metas, deudas y gastos.'}
        </div>
        <button type="button" onClick={shareBackup} style={actionRowStyle}>
          Compartir respaldo (JSON)
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -4 }}>
          Mándalo a Drive, correo o donde prefieras guardarlo. Luego se puede restaurar en la app.
        </div>

        {googleConfigured && (
          <>
            <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>GOOGLE</div>
            {!connectedToGoogle ? (
              <>
                <button type="button" onClick={startGoogleConnect} style={actionRowStyle}>
                  Conectar con Google
                </button>
                <div style={{ fontSize: 11, color: silentReconnectFailed ? 'var(--danger-text)' : 'var(--text-secondary)', marginTop: -4 }}>
                  {silentReconnectFailed
                    ? 'No se pudo reconectar en silencio (puede que también haya que iniciar sesión de nuevo en Google). Toca el botón para autorizar otra vez.'
                    : 'Te lleva a Google para autorizar, y vuelve aquí. Solo puede ver y crear archivos que suba esta app en Drive, y crear/editar eventos en tu Calendar, nada más de tu cuenta.'}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={sendToDrive}
                  disabled={driveStatus === 'loading'}
                  style={{ ...actionRowStyle, opacity: driveStatus === 'loading' ? 0.5 : 1 }}
                >
                  {driveStatus === 'loading'
                    ? 'Subiendo…'
                    : user.backupEmail
                      ? 'Subir Excel a Drive y enviar el enlace por correo'
                      : 'Subir Excel a Drive'}
                </button>
                <div style={{ fontSize: 11, color: driveStatus === 'error' ? 'var(--danger-text)' : 'var(--text-secondary)', marginTop: -4 }}>
                  {driveStatus === 'error'
                    ? driveError
                    : driveStatus === 'emailed'
                      ? 'Listo, se subió a tu Drive (carpeta "Payday") y te mandamos el enlace por correo.'
                      : driveStatus === 'uploaded'
                        ? 'Listo, se subió a tu Drive, en una carpeta llamada "Payday".'
                        : 'Ya conectado a Google.'}
                </div>
                <button
                  type="button"
                  onClick={syncCalendar}
                  disabled={calendarStatus === 'loading'}
                  style={{ ...actionRowStyle, opacity: calendarStatus === 'loading' ? 0.5 : 1 }}
                >
                  {calendarStatus === 'loading' ? 'Sincronizando…' : 'Sincronizar recordatorios con Calendar'}
                </button>
                <div style={{ fontSize: 11, color: calendarStatus === 'error' ? 'var(--danger-text)' : 'var(--text-secondary)', marginTop: -4 }}>
                  {calendarStatus === 'error'
                    ? calendarError
                    : calendarStatus === 'synced'
                      ? 'Listo, se crearon/actualizaron los eventos de tus deudas, gastos fijos e ingresos esperados en tu Calendar.'
                      : 'Crea un evento por cada deuda (próximo pago), gasto fijo (próximo vencimiento) e ingreso esperado. Vuelve a tocar el botón cuando quieras que se actualicen.'}
                </div>
              </>
            )}
          </>
        )}

        {emailBackupConfigured && (
          <>
            <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>ENVIAR RESPALDO POR CORREO</div>
            <input
              type="email"
              value={user.backupEmail || ''}
              onChange={setUserField('backupEmail')}
              placeholder="tu@correo.com"
              style={textInputStyle()}
            />
            <button
              type="button"
              onClick={sendEmailBackup}
              disabled={!user.backupEmail || emailStatus === 'loading'}
              style={{ ...actionRowStyle, opacity: !user.backupEmail || emailStatus === 'loading' ? 0.5 : 1 }}
            >
              {emailStatus === 'loading' ? 'Enviando…' : 'Enviar ahora'}
            </button>
            <div style={{ fontSize: 11, color: emailStatus === 'error' ? 'var(--danger-text)' : 'var(--text-secondary)', marginTop: -4 }}>
              {emailStatus === 'sent'
                ? 'Enviado. Te llega como texto en el correo. Para restaurar, cópialo y pégalo en "Restaurar datos" abajo.'
                : emailStatus === 'error'
                  ? 'No se pudo enviar. Revisa tu internet e intenta de nuevo.'
                  : 'Te llega como texto dentro del correo (no como archivo adjunto).'}
            </div>
          </>
        )}

        <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem('payday_return_section', 'datos');
            onNavigate('restaurar');
          }}
          style={actionRowStyle}
        >
          Restaurar datos
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -4 }}>
          Importar un archivo, restaurar desde Google Drive, o borrar todo y empezar de cero.
        </div>
      </div>
      </>
      )}
    </div>
  );
}
