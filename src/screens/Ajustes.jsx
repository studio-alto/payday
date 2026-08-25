import { useRef, useState } from 'react';
import { todayISO } from '../lib/dates';
import { cardStyle, labelStyle, textInputStyle } from '../lib/styles';
import NumberInput from '../components/NumberInput';
import FixedHeader from '../components/FixedHeader';

export default function Ajustes({ data, setData, canInstall, isInstalled, onInstall }) {
  const { user } = data;
  const dark = user.theme === 'oscuro';
  const budgetTotal = (user.budgetNecesidades ?? 50) + (user.budgetDeseos ?? 30) + (user.budgetAhorro ?? 20);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const fileInputRef = useRef(null);

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
          expenses: parsed.expenses || [],
        }));
      } catch {
        alert('Archivo inválido');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
        <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>Ajustes</div>
      </FixedHeader>

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
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>TASAS DE CAMBIO (1 COP →)</div>
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
          Cuántos pesos equivalen a 1 dólar / 1 euro. Ajústalo cuando cambie la tasa real.
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
