import { useState } from 'react';
import { fmt } from '../lib/format';
import { DAY_TYPES, todayISO } from '../lib/dates';
import { uid } from '../lib/id';
import { cardStyle, fieldLabelStyle, textInputStyle, primaryButtonStyle, secondaryButtonStyle } from '../lib/styles';
import NumberInput from '../components/NumberInput';
import FixedHeader from '../components/FixedHeader';
import { METHODS, computeDebtWaterfall, reverseIncomeEffects, applyIncomeEffects } from '../lib/debt';

const AHORRO_PCTS = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
const TARJETA_PCTS = [0, 0.1, 0.15, 0.2, 0.3, 0.4];
const AMOUNT_PRESETS = [10000, 20000, 50000, 100000, 150000];

function emptyForm(payBaseDay, goals) {
  const defaultGoal = goals.find((g) => g.current < g.target) || goals[0];
  return {
    name: '',
    amount: payBaseDay > 0 ? String(payBaseDay) : '',
    date: todayISO(),
    type: 'normal',
    note: '',
    ahorroMonto: '',
    tarjetaMonto: '',
    goalId: defaultGoal ? defaultGoal.id : '',
    esFuturo: false,
  };
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
    goalId: income.distribution.goalId || '',
    esFuturo: income.estado === 'proyectado',
  };
}

export default function Registrar({ data, setData, onNavigate, editingIncome, onDoneEditing }) {
  const isEditing = !!editingIncome;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => (isEditing ? formFromIncome(editingIncome) : emptyForm(data.user.payBaseDay, data.goals)));
  const [ahorroPctText, setAhorroPctText] = useState('');
  const [tarjetaPctText, setTarjetaPctText] = useState('');

  const today = todayISO();
  const { currency } = data.user;

  const nameFrequency = {};
  data.incomes.forEach((i) => {
    const n = i.name.trim();
    if (n) nameFrequency[n] = (nameFrequency[n] || 0) + 1;
  });
  const existingNames = Object.keys(nameFrequency)
    .sort((a, b) => nameFrequency[b] - nameFrequency[a])
    .slice(0, 8);

  const regAmount = Number(form.amount) || 0;
  const ahorroMonto = Number(form.ahorroMonto) || 0;
  const tarjetaMonto = Number(form.tarjetaMonto) || 0;
  const overAllocated = ahorroMonto + tarjetaMonto > regAmount;
  const debtMethod = data.user.debtMethod || 'bola_nieve';
  const debtWaterfall = computeDebtWaterfall(data.cards, debtMethod, tarjetaMonto);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setDate = (e) => {
    const value = !form.esFuturo && e.target.value > today ? today : e.target.value;
    setForm((f) => ({ ...f, date: value }));
  };
  const toggleEsFuturo = () => setForm((f) => ({ ...f, esFuturo: !f.esFuturo, date: f.esFuturo ? (f.date > today ? today : f.date) : f.date }));
  const setType = (key) => setForm((f) => ({ ...f, type: key }));
  const setAmountPreset = (amt) => setForm((f) => ({ ...f, amount: String(amt) }));
  const addZeros = () => setForm((f) => (f.amount ? { ...f, amount: f.amount + '000' } : f));
  const setAhorroPct = (pct) => {
    setAhorroPctText('');
    setForm((f) => ({ ...f, ahorroMonto: String(Math.round(regAmount * pct)) }));
  };
  const setTarjetaPct = (pct) => {
    setTarjetaPctText('');
    setForm((f) => ({ ...f, tarjetaMonto: String(Math.round(regAmount * pct)) }));
  };
  const setAhorroMontoManual = (e) => {
    setAhorroPctText('');
    setForm((f) => ({ ...f, ahorroMonto: e.target.value }));
  };
  const setTarjetaMontoManual = (e) => {
    setTarjetaPctText('');
    setForm((f) => ({ ...f, tarjetaMonto: e.target.value }));
  };
  const setAhorroPctManual = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
    const pct = Math.min(100, Number(digits) || 0);
    setAhorroPctText(digits);
    setForm((f) => ({ ...f, ahorroMonto: String(Math.round(regAmount * (pct / 100))) }));
  };
  const setTarjetaPctManual = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
    const pct = Math.min(100, Number(digits) || 0);
    setTarjetaPctText(digits);
    setForm((f) => ({ ...f, tarjetaMonto: String(Math.round(regAmount * (pct / 100))) }));
  };

  const goStep2 = () => {
    if (regAmount > 0) setStep(2);
  };
  const goStep4 = () => {
    if (!overAllocated) setStep(4);
  };

  const handleSave = () => {
    setData((s) => {
      let goals = s.goals;
      let cards = s.cards;

      if (isEditing) {
        const reversed = reverseIncomeEffects(editingIncome, goals, cards);
        goals = reversed.goals;
        cards = reversed.cards;
      }

      const baseEntry = {
        id: isEditing ? editingIncome.id : uid(),
        name: form.name,
        amount: regAmount,
        date: form.date,
        type: form.type,
        note: form.note,
        estado: form.esFuturo ? 'proyectado' : 'confirmado',
        distribution: { ahorro: ahorroMonto, tarjeta: tarjetaMonto, goalId: form.goalId || null },
      };

      // Money not yet received shouldn't move into goals/debts yet — that happens once
      // the income is edited and confirmed as received.
      const applied = form.esFuturo
        ? { goals, cards, debtAllocations: [] }
        : applyIncomeEffects(baseEntry, goals, cards, s.user.debtMethod || 'bola_nieve');
      const entry = { ...baseEntry, distribution: { ...baseEntry.distribution, debtAllocations: applied.debtAllocations } };

      return {
        ...s,
        incomes: isEditing ? s.incomes.map((i) => (i.id === entry.id ? entry : i)) : [...s.incomes, entry],
        goals: applied.goals,
        cards: applied.cards,
      };
    });
    onDoneEditing?.();
    onNavigate('dashboard');
  };

  const stepDots = [1, 2, 3, 4].map((n) => ({ n, active: n <= step }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 'var(--header-h, 110px)' }}>
      <FixedHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
      </FixedHeader>

      {step === 1 && (
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>¿Cuánto ganaste?</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <div style={{ flex: 1 }}>
              <NumberInput value={form.amount} onChange={setField('amount')} placeholder="¿Cuánto ganaste?" style={textInputStyle(true)} />
            </div>
            <button
              type="button"
              onClick={addZeros}
              disabled={!form.amount}
              style={{
                padding: '0 16px',
                borderRadius: 16,
                background: 'var(--input-bg)',
                color: 'var(--text)',
                fontWeight: 800,
                fontSize: 16,
                cursor: form.amount ? 'pointer' : 'default',
                opacity: form.amount ? 1 : 0.4,
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              +000
            </button>
          </div>
          <div>
            <div style={fieldLabelStyle}>MONTOS RÁPIDOS</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AMOUNT_PRESETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmountPreset(amt)}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: form.amount === String(amt) ? 'var(--text)' : 'var(--input-bg)',
                    color: form.amount === String(amt) ? 'var(--page-bg)' : 'var(--text)',
                    border: 'none',
                  }}
                >
                  {fmt(amt, currency)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={fieldLabelStyle}>NOMBRE DEL INGRESO</div>
            <input
              type="text"
              value={form.name}
              onChange={setField('name')}
              placeholder="Ej: Turno restaurante, Domingo obra"
              style={textInputStyle()}
            />
            {existingNames.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {existingNames.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, name: n }))}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 16,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: form.name === n ? 'var(--text)' : 'var(--input-bg)',
                      color: form.name === n ? 'var(--page-bg)' : 'var(--text-secondary)',
                      border: 'none',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={fieldLabelStyle}>FECHA</div>
            <input type="date" value={form.date} max={form.esFuturo ? undefined : today} onChange={setDate} style={textInputStyle()} />
          </div>
          <button
            type="button"
            onClick={toggleEsFuturo}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              borderRadius: 14,
              background: 'var(--input-bg)',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Es un ingreso futuro</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Aún no lo he recibido, quiero dejarlo planeado</div>
            </div>
            <div
              style={{
                width: 40,
                height: 24,
                borderRadius: 20,
                background: form.esFuturo ? 'var(--accent)' : '#D5D5D5',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'white',
                  position: 'absolute',
                  top: 3,
                  left: form.esFuturo ? 19 : 3,
                  transition: 'left 0.2s ease',
                }}
              />
            </div>
          </button>
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
          {form.esFuturo && (
            <div style={{ fontSize: 12, color: 'var(--accent)', background: 'var(--input-bg)', padding: 10, borderRadius: 12 }}>
              Como es un ingreso futuro, esta distribución quedará planeada pero no se aplicará a tus metas hasta que confirmes que ya lo recibiste.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {AHORRO_PCTS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setAhorroPct(pct)}
                style={{
                  padding: '9px 14px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: 'var(--input-bg)',
                  color: 'var(--text)',
                  border: 'none',
                }}
              >
                {Math.round(pct * 100)}%
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                inputMode="numeric"
                value={ahorroPctText}
                onChange={setAhorroPctManual}
                placeholder="% personalizado"
                style={textInputStyle()}
              />
            </div>
            <div style={{ flex: 1 }}>
              <NumberInput
                value={form.ahorroMonto}
                onChange={setAhorroMontoManual}
                placeholder="Monto ($)"
                style={textInputStyle()}
              />
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>Ahorro: {fmt(ahorroMonto, currency)}</div>
          {data.goals.length > 0 && ahorroMonto > 0 && (
            <div>
              <div style={fieldLabelStyle}>¿A QUÉ META VA ESTE AHORRO?</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {data.goals.map((g) => {
                  const active = form.goalId === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, goalId: g.id }))}
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
                      {g.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, goalId: '' }))}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: !form.goalId ? 'var(--text)' : 'var(--input-bg)',
                    color: !form.goalId ? 'var(--page-bg)' : 'var(--text)',
                    border: 'none',
                  }}
                >
                  Sin meta
                </button>
              </div>
            </div>
          )}
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TARJETA_PCTS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setTarjetaPct(pct)}
                style={{
                  padding: '9px 14px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: 'var(--input-bg)',
                  color: 'var(--text)',
                  border: 'none',
                }}
              >
                {Math.round(pct * 100)}%
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                inputMode="numeric"
                value={tarjetaPctText}
                onChange={setTarjetaPctManual}
                placeholder="% personalizado"
                style={textInputStyle()}
              />
            </div>
            <div style={{ flex: 1 }}>
              <NumberInput
                value={form.tarjetaMonto}
                onChange={setTarjetaMontoManual}
                placeholder="Monto ($)"
                style={textInputStyle()}
              />
            </div>
          </div>
          <div style={{ background: 'var(--input-bg)', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>Ahorro</span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(ahorroMonto, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Deudas</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(tarjetaMonto, currency)}</span>
            </div>
          </div>
          {tarjetaMonto > 0 && (
            <div style={{ background: 'var(--input-bg)', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>
                {form.esFuturo ? 'SE ABONARÁ CUANDO LO CONFIRMES' : 'SE ABONARÁ AUTOMÁTICO'} · {METHODS.find((m) => m.key === debtMethod)?.label.toUpperCase()}
              </div>
              {debtWaterfall.allocations.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No tienes deudas pendientes.</div>
              ) : (
                debtWaterfall.allocations.map((a) => (
                  <div key={a.cardId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text)' }}>{a.name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(a.amount, currency)}</span>
                  </div>
                ))
              )}
              {debtWaterfall.leftover > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Sobran {fmt(debtWaterfall.leftover, currency)} sin deudas a las que aplicarlos.
                </div>
              )}
            </div>
          )}
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
