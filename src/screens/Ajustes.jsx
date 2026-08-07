import { useRef, useState } from 'react';
import { todayISO } from '../lib/dates';
import { cardStyle, labelStyle, textInputStyle, stickyHeaderStyle } from '../lib/styles';
import NumberInput from '../components/NumberInput';

export default function Ajustes({ data, setData, canInstall, isInstalled, onInstall }) {
  const { user } = data;
  const dark = user.theme === 'oscuro';
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const fileInputRef = useRef(null);

  const setUserField = (key, transform = (v) => v) => (e) => {
    setData((s) => ({ ...s, user: { ...s.user, [key]: transform(e.target.value) } }));
  };

  const toggleTheme = () => {
    setData((s) => ({ ...s, user: { ...s.user, theme: s.user.theme === 'oscuro' ? 'light' : 'oscuro' } }));
  };

  const exportData = () => {
    const payload = { user: data.user, incomes: data.incomes, goals: data.goals, cards: data.cards, exportedAt: todayISO() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payday-datos-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerRestore = () => fileInputRef.current?.click();
  const handleRestoreFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        setData((s) => ({
          user: parsed.user || s.user,
          incomes: parsed.incomes || [],
          goals: parsed.goals || [],
          cards: parsed.cards || [],
        }));
      } catch {
        alert('Archivo inválido');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmReset = () => {
    setData((s) => ({ ...s, incomes: [], goals: [], cards: [] }));
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...stickyHeaderStyle, fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>Ajustes</div>

      {(canInstall || isInstalled) && (
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

      <div style={labelStyle}>FINANZAS</div>
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>PAGO BASE POR DÍA</div>
          <NumberInput
            value={user.payBaseDay}
            onChange={setUserField('payBaseDay', (v) => Number(v) || 0)}
            style={{ ...textInputStyle(), padding: 12, borderRadius: 12 }}
          />
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
      </div>

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

      <div style={labelStyle}>DATOS</div>
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" onClick={exportData} style={actionRowStyle}>
          Descargar datos (JSON)
        </button>
        <input type="file" ref={fileInputRef} accept="application/json" onChange={handleRestoreFile} style={{ display: 'none' }} />
        <button type="button" onClick={triggerRestore} style={actionRowStyle}>
          Restaurar datos
        </button>
        <button type="button" onClick={() => setResetConfirmOpen(true)} style={{ ...actionRowStyle, color: 'var(--accent)' }}>
          Limpiar todo
        </button>

        {resetConfirmOpen && (
          <div style={{ padding: 14, borderRadius: 14, background: 'var(--input-bg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>Esto borrará todos tus datos de la app. ¿Continuar?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={confirmReset}
                style={{ flex: 1, padding: 10, borderRadius: 12, background: 'var(--accent)', color: 'white', textAlign: 'center', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none' }}
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
    </div>
  );
}
