import { useState } from 'react';
import { fmt } from '../lib/format';
import { formatShortDate, monthsSince, todayISO } from '../lib/dates';
import { cardStyle, labelStyle, textInputStyle } from '../lib/styles';
import { monthlyInterestCost, simulateCardPayoff, formatMonthsLabel } from '../lib/debt';
import NumberInput from '../components/NumberInput';
import BottomSheet from '../components/BottomSheet';
import FixedHeader from '../components/FixedHeader';

const EXTRA_PRESETS = [0, 20000, 50000, 100000, 200000];

function ExplainerNote({ children }) {
  return <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 8 }}>{children}</div>;
}

export default function DeudaDetalle({ data, setData, cardId, onNavigate }) {
  const { cards } = data;
  const { currency } = data.user;
  const card = cards.find((c) => c.id === cardId);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', note: '' });
  const [extraText, setExtraText] = useState('');

  if (!card) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 88px)' }}>
        <FixedHeader>
          <button type="button" onClick={() => onNavigate('tarjetas')} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer' }}>
            ‹ Volver a Deudas
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
  const donut = `conic-gradient(var(--accent) ${pct}%, var(--divider) ${pct}% 100%)`;
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

  const today = todayISO();
  const openPayModal = () => {
    setPayForm({ amount: '', note: '' });
    setPayModalOpen(true);
  };
  const confirmPay = () => {
    const amount = Number(payForm.amount) || 0;
    if (amount <= 0) return;
    setData((s) => ({
      ...s,
      cards: s.cards.map((c) =>
        c.id === card.id ? { ...c, balance: Math.max(0, c.balance - amount), history: [...c.history, { date: today, amount, note: payForm.note }] } : c,
      ),
    }));
    setPayModalOpen(false);
  };

  const scenarioCardStyle = { background: 'var(--input-bg)', borderRadius: 16, padding: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 100px)' }}>
      <FixedHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={() => onNavigate('tarjetas')}
            style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
          >
            ‹ Deudas
          </button>
          <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--text)', letterSpacing: '-0.02em' }}>{card.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>
            {card.tipo || 'Tarjeta de crédito'}
            {card.interestRate > 0 && ` · ${card.interestRate}% E.A.`}
          </div>
        </div>
      </FixedHeader>

      {/* Donut de progreso */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 96, height: 96, borderRadius: '50%', background: donut, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>{pct}%</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
          <div>
            <div style={labelStyle}>SALDO PENDIENTE</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>{fmt(card.balance, currency)}</div>
          </div>
          <div>
            <div style={labelStyle}>ABONADO EN TOTAL</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--accent-text)' }}>{fmt(paidToDate, currency)}</div>
          </div>
        </div>
      </div>
      <ExplainerNote>
        Este círculo muestra qué tanto de esta deuda ya pagaste ({pct}%). Entre más lleno, más cerca estás de terminarla.
        {months !== null && ` Llevas ${months === 0 ? 'menos de un mes' : months === 1 ? '1 mes' : `${months} meses`} con esta deuda.`}
      </ExplainerNote>

      {/* Costo mensual del interés */}
      {card.interestRate > 0 && (
        <div style={cardStyle}>
          <div style={labelStyle}>LO QUE TE CUESTA CADA MES</div>
          <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--danger-text)', marginTop: 6, letterSpacing: '-0.02em' }}>
            {fmt(interestCost, currency)} <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>en intereses</span>
          </div>
          <ExplainerNote>
            Con un saldo de {fmt(card.balance, currency)} a {card.interestRate}% E.A., esto es lo que se suma a tu deuda cada mes solo por
            tenerla — no reduce lo que debes, es dinero extra que pagas por no haberla saldado todavía.
          </ExplainerNote>
        </div>
      )}

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
              <div style={{ fontSize: 12, color: 'var(--danger-text)', marginTop: 4 }}>El mínimo no alcanza a cubrir el interés — nunca se paga sola.</div>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginTop: 4 }}>{fmt(baseline.totalInterest, currency)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>en intereses · {formatMonthsLabel(baseline.monthsToPayoff)}</div>
              </>
            )}
          </div>
          <div style={{ ...scenarioCardStyle, background: 'var(--accent-soft-bg)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-text)' }}>ABONANDO EXTRA</div>
            {withExtra.stuck ? (
              <div style={{ fontSize: 12, color: 'var(--danger-text)', marginTop: 4 }}>Ese extra tampoco alcanza a cubrir el interés.</div>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginTop: 4 }}>{fmt(withExtra.totalInterest, currency)}</div>
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

        {extraRescuesFromStuck && (
          <div style={{ marginTop: 12, background: 'var(--accent-soft-bg)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              Con el mínimo solo, esta deuda <b>nunca se termina de pagar</b> — el interés crece más rápido de lo que abonas. Pero con{' '}
              {fmt(extra, currency)} extra al mes, sí la terminarías de pagar, en{' '}
              <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{formatMonthsLabel(withExtra.monthsToPayoff)}</span>.
            </div>
          </div>
        )}

        {extra > 0 && !extraRescuesFromStuck && interestSaved !== null && (
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
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            El más reciente: {formatShortDate(card.history[card.history.length - 1].date)} ·{' '}
            {fmt(card.history[card.history.length - 1].amount, currency)}
          </div>
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
        <BottomSheet onClose={() => setPayModalOpen(false)}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Registrar pago</div>
          <NumberInput
            value={payForm.amount}
            onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="Monto a pagar"
            style={textInputStyle()}
          />
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
            Confirmar pago
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
