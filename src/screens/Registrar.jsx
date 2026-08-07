import { useState } from 'react';
import { fmt } from '../lib/format';
import { DAY_TYPES, todayISO } from '../lib/dates';
import { uid } from '../lib/id';
import { cardStyle, fieldLabelStyle, textInputStyle, primaryButtonStyle, secondaryButtonStyle, chipStyle, stickyHeaderStyle } from '../lib/styles';
import NumberInput from '../components/NumberInput';

const AHORRO_PCTS = [0.1, 0.2, 0.3, 0.4, 0.5];
const TARJETA_PCTS = [0.1, 0.15, 0.2, 0.3, 0.4];

function emptyForm(payBaseDay) {
  return { name: '', amount: payBaseDay > 0 ? String(payBaseDay) : '', date: todayISO(), type: 'normal', note: '', ahorroMonto: '', tarjetaMonto: '' };
}

function formFromIncome(income) {
  return {
    name: income.name || '',
    amount: String(income.amount),
    date: income.date,
    type: income.type,
    note: income.note || '',
    ahorroMonto: income.distribution.ahorro ? String(income.distribution.ahorro) : '',
    tarjetaMonto: income.distribution.tarjeta ? String(income.distribution.tarjeta) : '',
  };
}

export default function Registrar({ data, setData, onNavigate, editingIncome, onDoneEditing }) {
  const isEditing = !!editingIncome;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => (isEditing ? formFromIncome(editingIncome) : emptyForm(data.user.payBaseDay)));

  const today = todayISO();
  const { currency } = data.user;

  const regAmount = Number(form.amount) || 0;
  const ahorroMonto = Number(form.ahorroMonto) || 0;
  const tarjetaMonto = Number(form.tarjetaMonto) || 0;
  const overAllocated = ahorroMonto + tarjetaMonto > regAmount;

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setDate = (e) => {
    const value = e.target.value > today ? today : e.target.value;
    setForm((f) => ({ ...f, date: value }));
  };
  const setType = (key) => setForm((f) => ({ ...f, type: key }));
  const setAhorroPct = (pct) => setForm((f) => ({ ...f, ahorroMonto: String(Math.round(regAmount * pct)) }));
  const setTarjetaPct = (pct) => setForm((f) => ({ ...f, tarjetaMonto: String(Math.round(regAmount * pct)) }));

  const goStep2 = () => {
    if (regAmount > 0) setStep(2);
  };
  const goStep4 = () => {
    if (!overAllocated) setStep(4);
  };

  const handleSave = () => {
    const entry = {
      id: isEditing ? editingIncome.id : uid(),
      name: form.name,
      amount: regAmount,
      date: form.date,
      type: form.type,
      note: form.note,
      distribution: { ahorro: ahorroMonto, tarjeta: tarjetaMonto },
    };
    setData((s) => ({
      ...s,
      incomes: isEditing ? s.incomes.map((i) => (i.id === entry.id ? entry : i)) : [...s.incomes, entry],
    }));
    onDoneEditing?.();
    onNavigate('dashboard');
  };

  const stepDots = [1, 2, 3, 4].map((n) => ({ n, active: n <= step }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...stickyHeaderStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          {isEditing ? 'Editar ingreso' : 'Registrar'}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {stepDots.map((sd) => (
            <div key={sd.n} style={{ flex: 1, height: 4, borderRadius: 4, background: sd.active ? 'var(--text)' : 'var(--divider)' }} />
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>PASO {step} DE 4</div>
      </div>

      {step === 1 && (
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>¿Cuánto ganaste?</div>
          <NumberInput value={form.amount} onChange={setField('amount')} placeholder="¿Cuánto ganaste?" style={textInputStyle(true)} />
          <div>
            <div style={fieldLabelStyle}>NOMBRE DEL INGRESO</div>
            <input
              type="text"
              value={form.name}
              onChange={setField('name')}
              placeholder="Ej: Turno restaurante, Domingo obra"
              style={textInputStyle()}
            />
          </div>
          <div>
            <div style={fieldLabelStyle}>FECHA</div>
            <input type="date" value={form.date} max={today} onChange={setDate} style={textInputStyle()} />
          </div>
          <div>
            <div style={fieldLabelStyle}>TIPO DE DÍA</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DAY_TYPES.map((dt) => {
                const active = form.type === dt.key;
                return (
                  <button
                    key={dt.key}
                    type="button"
                    onClick={() => setType(dt.key)}
                    style={{
                      padding: '9px 14px',
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: active ? 'var(--text)' : 'var(--input-bg)',
                      color: active ? 'var(--page-bg)' : 'var(--text)',
                      border: 'none',
                    }}
                  >
                    {dt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={fieldLabelStyle}>NOTA (OPCIONAL)</div>
            <textarea
              value={form.note}
              onChange={setField('note')}
              placeholder="¿Qué hiciste?"
              rows={2}
              style={{ ...textInputStyle(), resize: 'none' }}
            />
          </div>
          <button type="button" onClick={goStep2} disabled={regAmount <= 0} style={primaryButtonStyle(regAmount <= 0)}>
            Continuar
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>¿Cuánto al ahorro?</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>De {fmt(regAmount, currency)} ganados</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {AHORRO_PCTS.map((pct) => (
              <button key={pct} type="button" onClick={() => setAhorroPct(pct)} style={chipStyle}>
                {Math.round(pct * 100)}%
              </button>
            ))}
          </div>
          <NumberInput
            value={form.ahorroMonto}
            onChange={setField('ahorroMonto')}
            placeholder="Monto personalizado"
            style={{ ...textInputStyle(), fontSize: 16, fontWeight: 700 }}
          />
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>Ahorro: {fmt(ahorroMonto, currency)}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setStep(1)} style={{ ...secondaryButtonStyle, flex: 1 }}>
              Atrás
            </button>
            <button type="button" onClick={() => setStep(3)} style={{ ...primaryButtonStyle(), flex: 2 }}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>¿Cuánto a deudas?</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Te quedan {fmt(regAmount - ahorroMonto, currency)} disponibles</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {TARJETA_PCTS.map((pct) => (
              <button key={pct} type="button" onClick={() => setTarjetaPct(pct)} style={chipStyle}>
                {Math.round(pct * 100)}%
              </button>
            ))}
          </div>
          <NumberInput
            value={form.tarjetaMonto}
            onChange={setField('tarjetaMonto')}
            placeholder="Monto personalizado"
            style={{ ...textInputStyle(), fontSize: 16, fontWeight: 700 }}
          />
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>Deudas: {fmt(tarjetaMonto, currency)}</div>
          {overAllocated && <div style={{ fontSize: 12, color: 'var(--accent)' }}>La suma no puede superar lo ganado.</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setStep(2)} style={{ ...secondaryButtonStyle, flex: 1 }}>
              Atrás
            </button>
            <button type="button" onClick={goStep4} disabled={overAllocated} style={{ ...primaryButtonStyle(overAllocated), flex: 2 }}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Resumen</div>
          <div style={{ background: 'var(--input-bg)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total ganado</span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(regAmount, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Ahorro</span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(ahorroMonto, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Deudas</span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(tarjetaMonto, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--divider)', paddingTop: 10 }}>
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>Disponible</span>
              <span style={{ fontWeight: 800, color: 'var(--accent)' }}>{fmt(regAmount - ahorroMonto - tarjetaMonto, currency)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setStep(3)} style={{ ...secondaryButtonStyle, flex: 1 }}>
              Atrás
            </button>
            <button type="button" onClick={handleSave} style={{ ...primaryButtonStyle(), flex: 2 }}>
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
