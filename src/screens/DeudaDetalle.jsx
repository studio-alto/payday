import { useState } from 'react';
import { fmt } from '../lib/format';
import { formatShortDate, monthsSince, todayISO } from '../lib/dates';
import { cardStyle, labelStyle, textInputStyle } from '../lib/styles';
import { monthlyInterestCost, simulateCardPayoff, formatMonthsLabel } from '../lib/debt';
import NumberInput from '../components/NumberInput';
import DateField from '../components/DateField';
import BottomSheet from '../components/BottomSheet';
import FixedHeader from '../components/FixedHeader';
import ProgressRing from '../components/ProgressRing';
import InlineConfirm from '../components/InlineConfirm';
import CardMenu from '../components/CardMenu';

const EXTRA_PRESETS = [0, 20000, 50000, 100000, 200000];

function ExplainerNote({ children }) {
  return <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 8 }}>{children}</div>;
}

export default function DeudaDetalle({ data, setData, cardId, onNavigate }) {
  const { cards } = data;
  const { currency } = data.user;
  const card = cards.find((c) => c.id === cardId);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', note: '', date: '' });
  const [editingHistoryIdx, setEditingHistoryIdx] = useState(null);
  const [deleteHistoryIdx, setDeleteHistoryIdx] = useState(null);
  const [extraText, setExtraText] = useState('');

  if (!card) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 88px)' }}>
        <FixedHeader>
          <button type="button" onClick={() => onNavigate('tarjetas')} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer' }}>
            ‹ Volver a Gastos
          </button>
        </FixedHeader>
        <div style={cardStyle}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Esta deuda ya no existe — puede que la hayas eliminado.</div>
        </div>
      </div>
    );
  }

  const paidToDate = card.history.reduce((a, h) => a + h.amount, 0);
  const pct = paidToDate + card.balance > 0 ? Math.round((paidToDate / (paidToDate + card.balance)) * 100) : 0;
  const months = card.startDate ? monthsSince(card.startDate) : null;
  const interestCost = monthlyInterestCost(card);

  const extra = Number(extraText) || 0;
  const baseline = simulateCardPayoff(card, 0);
  const withExtra = simulateCardPayoff(card, extra);
  const bothResolve = !baseline.stuck && !withExtra.stuck;
  const interestSaved = bothResolve ? baseline.totalInterest - withExtra.totalInterest : null;
  const monthsSaved = bothResolve ? baseline.monthsToPayoff - withExtra.monthsToPayoff : null;
  // The minimum payment alone never covers the interest (balance would grow forever),
  // but this extra amount is enough to actually pay it off — the single most useful
  // thing this screen can tell someone in that situation.
  const extraRescuesFromStuck = extra > 0 && baseline.stuck && !withExtra.stuck;
  // The extra typed in is more than this debt will ever need — telling someone "1 mes"
  // is technically true but useless when what they actually want to know is how much
  // of that money is free to go toward something else.
  const hasSurplus = extra > 0 && !withExtra.stuck && withExtra.surplus > 0;
  // How far the minimum payment (and, separately, minimum + extra) falls short of this
  // month's interest — the exact number someone needs to close that gap, not just "it's stuck".
  const minGap = Math.max(0, Math.round(interestCost - (card.minPayment || 0)));
  const extraGap = Math.max(0, Math.round(interestCost - (card.minPayment || 0) - extra));

  const today = todayISO();
  const sortedHistory = card.history.map((h, i) => ({ ...h, _idx: i })).sort((a, b) => b.date.localeCompare(a.date));
  const openPayModal = () => {
    setEditingHistoryIdx(null);
    setPayForm({ amount: '', note: '', date: today });
    setPayModalOpen(true);
  };
  const openEditHistoryModal = (idx) => {
    const entry = card.history[idx];
    setEditingHistoryIdx(idx);
    setPayForm({ amount: String(entry.amount), note: entry.note || '', date: entry.date });
    setPayModalOpen(true);
  };
  const confirmPay = () => {
    const amount = Number(payForm.amount) || 0;
    if (amount <= 0) return;
    setData((s) => ({
      ...s,
      cards: s.cards.map((c) => {
        if (c.id !== card.id) return c;
        if (editingHistoryIdx !== null) {
          const oldAmount = c.history[editingHistoryIdx].amount;
          const history = c.history.map((h, i) => (i === editingHistoryIdx ? { date: payForm.date || today, amount, note: payForm.note } : h));
          return { ...c, balance: Math.max(0, c.balance + oldAmount - amount), history };
        }
        return { ...c, balance: Math.max(0, c.balance - amount), history: [...c.history, { date: payForm.date || today, amount, note: payForm.note }] };
      }),
    }));
    setPayModalOpen(false);
    setEditingHistoryIdx(null);
  };
  const askDeleteHistory = (idx) => setDeleteHistoryIdx(idx);
  const cancelDeleteHistory = () => setDeleteHistoryIdx(null);
  const confirmDeleteHistory = (idx) => {
    setData((s) => ({
      ...s,
      cards: s.cards.map((c) => {
        if (c.id !== card.id) return c;
        const entry = c.history[idx];
        return { ...c, balance: c.balance + entry.amount, history: c.history.filter((_, i) => i !== idx) };
      }),
    }));
    setDeleteHistoryIdx(null);
  };

  const scenarioCardStyle = { background: 'var(--input-bg)', borderRadius: 16, padding: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 };
  const heroTileStyle = { ...cardStyle, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minWidth: 0 };
  const statTileStyle = { ...cardStyle, flex: 1, minWidth: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 100px)' }}>
      <FixedHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={() => onNavigate('tarjetas')}
            style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
          >
            ‹ Gastos
          </button>
          <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--text)', letterSpacing: '-0.02em' }}>{card.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>
            {card.tipo || 'Tarjeta de crédito'}
            {card.interestRate > 0 && ` · ${card.interestRate}% E.A.`}
          </div>
        </div>
      </FixedHeader>

      {/* Hero: dona de progreso + costo mensual del interés, lado a lado */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={heroTileStyle}>
          <div style={labelStyle}>% PAGADO</div>
          <ProgressRing pct={pct} size={128} style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--text)', letterSpacing: '-0.02em' }}>{pct}%</div>
          </ProgressRing>
        </div>

        {card.interestRate > 0 && (
          <div style={{ ...heroTileStyle, background: 'var(--danger)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.06em' }}>TE CUESTA CADA MES</div>
            <div style={{ fontWeight: 800, fontSize: 26, color: 'white', marginTop: 10, letterSpacing: '-0.02em' }}>{fmt(interestCost, currency)}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: 700 }}>en intereses</div>
          </div>
        )}
      </div>

      {/* Saldo y abonado, en tarjetas secundarias */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={statTileStyle}>
          <div style={labelStyle}>SALDO PENDIENTE</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', marginTop: 6, letterSpacing: '-0.02em' }}>{fmt(card.balance, currency)}</div>
        </div>
        <div style={statTileStyle}>
          <div style={labelStyle}>ABONADO EN TOTAL</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--accent-text)', marginTop: 6, letterSpacing: '-0.02em' }}>{fmt(paidToDate, currency)}</div>
        </div>
      </div>

      <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={labelStyle}>CUOTA MENSUAL</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: card.minPayment > 0 ? 'var(--text)' : 'var(--text-secondary)' }}>
          {card.minPayment > 0 ? fmt(card.minPayment, currency) : 'No configurada'}
        </div>
      </div>

      <ExplainerNote>
        El círculo muestra qué tanto de esta deuda ya pagaste ({pct}%) — entre más lleno, más cerca estás de terminarla.
        {card.interestRate > 0 &&
          ` Lo rojo es lo que te cuesta cada mes solo por tenerla — no reduce lo que debes, es dinero extra que pagas por no haberla saldado todavía.`}
        {months !== null && ` Llevas ${months === 0 ? 'menos de un mes' : months === 1 ? '1 mes' : `${months} meses`} con esta deuda.`}
      </ExplainerNote>

      {/* Comparación de escenarios */}
      <div style={cardStyle}>
        <div style={labelStyle}>¿CUÁNTO PAGARÍAS EN INTERESES EN TOTAL?</div>
        <ExplainerNote>
          Esto proyecta hacia adelante, desde el saldo de hoy — no es lo que ya pagaste, es lo que pagarías si sigues el plan que elijas.
        </ExplainerNote>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <div style={scenarioCardStyle}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>SOLO EL MÍNIMO</div>
            {baseline.stuck ? (
              <div style={{ fontSize: 12, color: 'var(--danger-text)', marginTop: 4 }}>
                {minGap > 0 ? (
                  <>El mínimo ({fmt(card.minPayment || 0, currency)}) no cubre el interés mensual ({fmt(interestCost, currency)}) — te faltan {fmt(minGap, currency)} más al mes solo para que deje de crecer.</>
                ) : (
                  <>No tienes un pago mínimo que reduzca esta deuda, así que el saldo nunca baja por sí solo.</>
                )}
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.01em' }}>{fmt(baseline.totalInterest, currency)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>en intereses · {formatMonthsLabel(baseline.monthsToPayoff)}</div>
              </>
            )}
          </div>
          <div style={{ ...scenarioCardStyle, background: 'var(--accent-soft-bg)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-text)' }}>ABONANDO EXTRA</div>
            {withExtra.stuck ? (
              <div style={{ fontSize: 12, color: 'var(--danger-text)', marginTop: 4 }}>
                {extra > 0 ? (
                  <>Con el mínimo + este extra ({fmt((card.minPayment || 0) + extra, currency)}) sigues sin cubrir el interés ({fmt(interestCost, currency)}) — te faltan {fmt(extraGap, currency)} más al mes.</>
                ) : (
                  <>Agrega un abono extra arriba — ahora mismo el mínimo no cubre el interés.</>
                )}
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.01em' }}>{fmt(withExtra.totalInterest, currency)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>en intereses · {formatMonthsLabel(withExtra.monthsToPayoff)}</div>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 700 }}>ABONO EXTRA AL MES (además del mínimo)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {EXTRA_PRESETS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setExtraText(amt === 0 ? '' : String(amt))}
                style={{
                  padding: '8px 12px',
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: extra === amt ? 'var(--text)' : 'var(--input-bg)',
                  color: extra === amt ? 'var(--page-bg)' : 'var(--text)',
                  border: 'none',
                }}
              >
                {amt === 0 ? 'Ninguno' : fmt(amt, currency)}
              </button>
            ))}
          </div>
          <NumberInput value={extraText} onChange={(e) => setExtraText(e.target.value)} placeholder="Otro monto" style={textInputStyle()} />
        </div>

        {hasSurplus && (
          <div style={{ marginTop: 12, background: 'var(--accent-soft-bg)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              {fmt(extra, currency)} es más de lo que esta deuda necesita — con eso la <b>saldas por completo este mes</b> y te sobran{' '}
              <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{fmt(withExtra.surplus, currency)}</span> que podrías destinar a tus otras deudas o metas.
            </div>
          </div>
        )}

        {!hasSurplus && extraRescuesFromStuck && (
          <div style={{ marginTop: 12, background: 'var(--accent-soft-bg)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              Con el mínimo solo, esta deuda <b>nunca se termina de pagar</b> — el interés crece más rápido de lo que abonas. Pero con{' '}
              {fmt(extra, currency)} extra al mes, sí la terminarías de pagar, en{' '}
              <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{formatMonthsLabel(withExtra.monthsToPayoff)}</span>.
            </div>
          </div>
        )}

        {!hasSurplus && extra > 0 && !extraRescuesFromStuck && interestSaved !== null && (
          <div style={{ marginTop: 12, background: 'var(--accent-soft-bg)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              Abonando {fmt(extra, currency)} extra cada mes, te ahorrarías{' '}
              <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{fmt(Math.max(0, interestSaved), currency)}</span> en intereses
              {monthsSaved > 0 && (
                <>
                  {' '}
                  y terminarías <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{monthsSaved} {monthsSaved === 1 ? 'mes' : 'meses'}</span> antes.
                </>
              )}
            </div>
          </div>
        )}

        {extra === 0 && (
          <ExplainerNote>Escribe un monto arriba para comparar cómo cambia si abonas más que el mínimo.</ExplainerNote>
        )}

        <ExplainerNote>
          Si solo pagas el mínimo, el interés se sigue sumando cada mes sobre lo que debes, así que terminas pagando más en total. Cada peso
          extra que abonas reduce el saldo sobre el que se calcula el interés del mes siguiente — por eso pagas menos intereses y terminas antes.
        </ExplainerNote>
      </div>

      {/* Historial */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={labelStyle}>ABONOS REGISTRADOS</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{card.history.length}</div>
        </div>
        {card.history.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>Todavía no has registrado abonos a esta deuda.</div>
        ) : (
          sortedHistory.map((h) => (
            <div key={h._idx} style={{ padding: '10px 0', borderTop: '1px solid var(--divider)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{fmt(h.amount, currency)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {formatShortDate(h.date)}
                    {h.note ? ` · ${h.note}` : ''}
                  </div>
                </div>
                <CardMenu
                  inline
                  triggerBg="transparent"
                  actions={[
                    { label: 'Editar', onClick: () => openEditHistoryModal(h._idx) },
                    { label: 'Eliminar', destructive: true, onClick: () => askDeleteHistory(h._idx) },
                  ]}
                />
              </div>
              {deleteHistoryIdx === h._idx && (
                <InlineConfirm
                  message="¿Eliminar este abono? El monto vuelve al saldo pendiente."
                  onConfirm={() => confirmDeleteHistory(h._idx)}
                  onCancel={cancelDeleteHistory}
                />
              )}
            </div>
          ))
        )}
        <button
          type="button"
          onClick={openPayModal}
          style={{
            padding: '9px 16px',
            borderRadius: 20,
            background: 'var(--text)',
            color: 'var(--page-bg)',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            display: 'inline-block',
            marginTop: 10,
            border: 'none',
          }}
        >
          Registrar pago
        </button>
      </div>

      {payModalOpen && (
        <BottomSheet onClose={() => { setPayModalOpen(false); setEditingHistoryIdx(null); }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{editingHistoryIdx !== null ? 'Editar abono' : 'Registrar pago'}</div>
          <NumberInput
            value={payForm.amount}
            onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="Monto a pagar"
            style={textInputStyle()}
          />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 700 }}>FECHA DEL ABONO</div>
            <DateField
              value={payForm.date}
              max={today}
              onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))}
              style={textInputStyle()}
            />
          </div>
          <input
            type="text"
            value={payForm.note}
            onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Nota (opcional)"
            style={textInputStyle()}
          />
          <button
            type="button"
            onClick={confirmPay}
            style={{ height: 50, borderRadius: 25, background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: 'none' }}
          >
            {editingHistoryIdx !== null ? 'Guardar cambios' : 'Confirmar pago'}
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
