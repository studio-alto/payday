import { useRef, useState } from 'react';
import { todayISO, formatFullDate } from '../lib/dates';
import { buildSummaryCsv } from '../lib/exportCsv';
import { averageRecentIncome } from '../lib/incomeStats';
import { fetchLiveExchangeRates } from '../lib/exchangeRates';
import { fmt } from '../lib/format';
import { cardStyle, labelStyle, textInputStyle } from '../lib/styles';
import { hashPin } from '../lib/pin';
import { sendBackupEmail, emailBackupConfigured } from '../lib/emailBackup';
import NumberInput from '../components/NumberInput';
import FixedHeader from '../components/FixedHeader';
import BottomSheet from '../components/BottomSheet';
import PinPad from '../components/PinPad';

// Guards against restoring a file that parses as JSON but doesn't have the shape
// the rest of the app assumes (e.g. hand-edited, or exported by a future version
// with a different schema) — those would otherwise crash later on a missing field.
function isValidBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  for (const key of ['incomes', 'goals', 'cards', 'expenses']) {
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

export default function Ajustes({ data, setData, canInstall, isInstalled, onInstall }) {
  const { user } = data;
  const dark = user.theme === 'oscuro';
  const [section, setSection] = useState('general');
  const budgetTotal = (user.budgetNecesidades ?? 50) + (user.budgetDeseos ?? 30) + (user.budgetAhorro ?? 20);
  const avgRecentIncome = averageRecentIncome(data.incomes);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [ratesStatus, setRatesStatus] = useState('idle');
  const fileInputRef = useRef(null);

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

  const exportData = () => {
    const payload = { user: data.user, incomes: data.incomes, goals: data.goals, cards: data.cards, expenses: data.expenses, exportedAt: todayISO() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payday-datos-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareBackup = async () => {
    const payload = { user: data.user, incomes: data.incomes, goals: data.goals, cards: data.cards, expenses: data.expenses, exportedAt: todayISO() };
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

  const exportCsv = () => {
    const csv = buildSummaryCsv(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payday-resumen-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restoreFromParsed = (parsed) => {
    setData((s) => ({
      user: parsed.user || s.user,
      incomes: parsed.incomes || [],
      goals: parsed.goals || [],
      cards: parsed.cards || [],
      expenses: parsed.expenses || [],
    }));
  };

  const triggerRestore = () => fileInputRef.current?.click();
  const handleRestoreFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!isValidBackup(parsed)) {
          alert('Este archivo no tiene el formato de un respaldo de Payday.');
          return;
        }
        restoreFromParsed(parsed);
      } catch {
        alert('Archivo inválido');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const [pasteText, setPasteText] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const restoreFromPaste = () => {
    try {
      const parsed = JSON.parse(pasteText);
      if (!isValidBackup(parsed)) {
        alert('Este texto no tiene el formato de un respaldo de Payday.');
        return;
      }
      restoreFromParsed(parsed);
      setPasteText('');
      setPasteOpen(false);
    } catch {
      alert('Texto inválido. Revisa que lo hayas copiado completo.');
    }
  };

  const confirmReset = () => {
    setData((s) => ({ ...s, incomes: [], goals: [], cards: [], expenses: [] }));
    setResetConfirmOpen(false);
  };

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
        </>
      )}

      {section === 'finanzas' && (
      <>
      <div style={labelStyle}>FINANZAS</div>
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>PROMEDIO DE TUS ÚLTIMOS INGRESOS</div>
          <div style={{ ...textInputStyle(), padding: 12, borderRadius: 12, color: avgRecentIncome > 0 ? 'var(--text)' : 'var(--text-secondary)' }}>
            {avgRecentIncome > 0 ? fmt(avgRecentIncome, user.currency) : 'Aún no tienes ingresos registrados'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Se calcula solo, del promedio de tus últimos 10 ingresos — no lo escribes tú, porque tu pago varía día a día. Se
            usa para sugerir el monto al registrar y para proyectar tu mes en el Dashboard.
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
          Se usa como sugerencia al registrar un ingreso y como referencia en el Dashboard — no limita lo que realmente hagas.
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
              Si olvidas el PIN, la única forma de volver a entrar es borrar todos tus datos — no hay recuperación. Te
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
        <button type="button" onClick={exportCsv} style={actionRowStyle}>
          Descargar resumen (Excel)
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -4 }}>
          Para leer o compartir: ingresos, metas, deudas y gastos en una tabla.
        </div>
        <button type="button" onClick={shareBackup} style={actionRowStyle}>
          Compartir respaldo (JSON)
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -4 }}>
          Mándalo a Drive, correo o donde prefieras guardarlo — luego se puede restaurar en la app.
        </div>

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
                ? 'Enviado. Te llega como texto en el correo — para restaurar, cópialo y usa "Pegar para restaurar" abajo.'
                : emailStatus === 'error'
                  ? 'No se pudo enviar. Revisa tu internet e intenta de nuevo.'
                  : 'Te llega como texto dentro del correo (no como archivo adjunto).'}
            </div>
          </>
        )}

        <input type="file" ref={fileInputRef} accept="application/json" onChange={handleRestoreFile} style={{ display: 'none' }} />
        <button type="button" onClick={triggerRestore} style={actionRowStyle}>
          Restaurar datos (archivo)
        </button>

        {emailBackupConfigured && (
          <>
            <button type="button" onClick={() => setPasteOpen((v) => !v)} style={actionRowStyle}>
              {pasteOpen ? 'Cancelar' : 'Pegar para restaurar (desde el correo)'}
            </button>
            {pasteOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Pega aquí el texto del correo de respaldo"
                  rows={5}
                  style={{ ...textInputStyle(), padding: 12, borderRadius: 12, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                />
                <button
                  type="button"
                  onClick={restoreFromPaste}
                  disabled={!pasteText.trim()}
                  style={{ ...actionRowStyle, background: 'var(--accent)', color: 'white', opacity: pasteText.trim() ? 1 : 0.5 }}
                >
                  Restaurar desde texto
                </button>
              </div>
            )}
          </>
        )}
        <button type="button" onClick={() => setResetConfirmOpen(true)} style={{ ...actionRowStyle, color: 'var(--danger-text)' }}>
          Limpiar todo
        </button>

        {resetConfirmOpen && (
          <div style={{ padding: 14, borderRadius: 14, background: 'var(--input-bg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>
              Esto borrará tus ingresos, metas, deudas y gastos fijos. Tus ajustes (moneda, tema, tasas de cambio, etc.) se
              conservan. ¿Continuar?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={confirmReset}
                style={{ flex: 1, padding: 10, borderRadius: 12, background: 'var(--danger)', color: 'white', textAlign: 'center', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none' }}
              >
                Sí, borrar
              </button>
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                style={{ flex: 1, padding: 10, borderRadius: 12, background: 'var(--card-bg)', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', border: 'none' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
