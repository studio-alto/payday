import { useState } from 'react';
import { fmt } from '../lib/format';
import { formatShortDate, monthsSince, todayISO, addMonthsISO, formatMonthYear, advanceDueDate } from '../lib/dates';
import { cardStyle, labelStyle, textInputStyle } from '../lib/styles';
import { monthlyInterestCost, simulateCardPayoff, formatMonthsLabel, debtPriorityRank, METHODS } from '../lib/debt';
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

function EditPencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="12"
      height="12"
      style={{ flexShrink: 0 }}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

// One stat cell in the "Detalle completo" grid below — `onEdit` makes the whole cell
// tappable (reusing whichever modal already owns that field) instead of duplicating
// an edit affordance for values that already have one elsewhere. Label-above-value,
// same pattern as the SALDO PENDIENTE / ABONADO EN TOTAL tiles higher up on this
// screen, just laid out 2-per-row instead of 1, so the whole "ficha" reads like one
// dashboard of stats instead of a long list. Sits inside a grid whose own background
// shows through the 1px gaps as dividing lines — see the wrapping grid below.
function DetailRow({ label, value, valueColor = 'var(--text)', sub, onEdit, span }) {
  const Wrapper = onEdit ? 'button' : 'div';
  return (
    <Wrapper
      type={onEdit ? 'button' : undefined}
      onClick={onEdit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
        gridColumn: span ? '1 / -1' : undefined,
        border: 'none',
        background: 'var(--card-bg)',
        padding: '14px 14px',
        textAlign: 'left',
        cursor: onEdit ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
        {label}
        {onEdit && (
          <span style={{ color: 'var(--accent-text)', display: 'inline-flex' }}>
            <EditPencilIcon />
          </span>
        )}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: valueColor, letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</div>}
    </Wrapper>
  );
}

export default function DeudaDetalle({ data, setData, cardId, onNavigate, onEditIncome }) {
  const { cards } = data;
  const { currency } = data.user;
  const card = cards.find((c) => c.id === cardId);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', note: '', date: '' });
  const [editingHistoryIdx, setEditingHistoryIdx] = useState(null);
  const [deleteHistoryIdx, setDeleteHistoryIdx] = useState(null);
  const [extraText, setExtraText] = useState('');
  const [cuotaModalOpen, setCuotaModalOpen] = useState(false);
  const [cuotaText, setCuotaText] = useState('');
  const [interesModalOpen, setInteresModalOpen] = useState(false);
  const [interesText, setInteresText] = useState('');
  const [montoOriginalModalOpen, setMontoOriginalModalOpen] = useState(false);
  const [montoOriginalText, setMontoOriginalText] = useState('');

  if (!card) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 88px)' }}>
        <FixedHeader>
          <button type="button" onClick={() => onNavigate('tarjetas')} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer' }}>
            ‹ Volver a Gastos
          </button>
        </FixedHeader>
        <div style={cardStyle}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Esta deuda ya no existe. Puede que la hayas eliminado.</div>
        </div>
      </div>
    );
  }

  const paidToDate = card.history.reduce((a, h) => a + h.amount, 0);
  const pct = paidToDate + card.balance > 0 ? Math.round((paidToDate / (paidToDate + card.balance)) * 100) : 0;
  const months = card.startDate ? monthsSince(card.startDate) : null;
  // Real cost this month is whatever the person types from their own statement — a rate
  // times the balance rarely matches it exactly (cycle dates, promos, minimum interest
  // charges). The scenario comparison below still projects forward from the rate, since
  // that's explicitly about "what would happen if", not "what did this actually cost".
  const interesManual = card.interesMensual || 0;
  const interestCost = monthlyInterestCost(card);
  // If the real interest from the statement is way above what the entered E.A. rate
  // projects, the number typed in "Tasa de interés anual" is very likely the card's
  // monthly rate, not the annual one this screen expects — a common mix-up, since a
  // Colombian extracto usually prints both a monthly rate and an E.A. one. Flagging it
  // beats leaving every projection on this screen silently off by roughly the same factor.
  const possibleRateMismatch = interesManual > 0 && interestCost > 0 && interesManual > interestCost * 3;
  // Whether this debt actually accrues interest at all — a personal loan from family
  // or friends often doesn't, and comparing "interest paid" between two scenarios that
  // are both always $0 is meaningless, so the scenario cards below switch to comparing
  // payoff time instead when this is false.
  const hasInterest = card.interestRate > 0;
  const debtMethod = data.user.debtMethod || 'bola_nieve';
  const methodLabel = METHODS.find((m) => m.key === debtMethod)?.label || '';
  const { rank: priorityRank, total: totalOpenDebts } = debtPriorityRank(cards.filter((c) => !c.archived), debtMethod, card.id);

  const extra = Number(extraText) || 0;
  const baseline = simulateCardPayoff(card, 0);
  const withExtra = simulateCardPayoff(card, extra);
  // Concrete calendar month each scenario would finish in — "6 meses" is an abstract
  // count, "julio 2026" is the actual future the person is deciding between.
  const baselinePayoffDate = !baseline.stuck ? addMonthsISO(baseline.monthsToPayoff) : null;
  const withExtraPayoffDate = !withExtra.stuck ? addMonthsISO(withExtra.monthsToPayoff) : null;
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
        const paidOn = payForm.date || today;
        return {
          ...c,
          balance: Math.max(0, c.balance - amount),
          nextPayment: advanceDueDate(c.nextPayment, paidOn),
          history: [...c.history, { date: paidOn, amount, note: payForm.note }],
        };
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

  // A quick way to set/update just the cuota — credit cards especially have a minimum
  // payment that moves with the balance each cycle, so this needs to be editable often,
  // not buried behind the full "Editar deuda" form.
  const openCuotaModal = () => {
    setCuotaText(card.minPayment > 0 ? String(card.minPayment) : '');
    setCuotaModalOpen(true);
  };
  const saveCuota = () => {
    const minPayment = Number(cuotaText) || 0;
    setData((s) => ({ ...s, cards: s.cards.map((c) => (c.id === card.id ? { ...c, minPayment } : c)) }));
    setCuotaModalOpen(false);
  };

  // What the debt actually cost this month, straight from the statement — a typed-in
  // number instead of a rate-based estimate, same reasoning as cuota mensual above.
  const openInteresModal = () => {
    setInteresText(card.interesMensual > 0 ? String(card.interesMensual) : '');
    setInteresModalOpen(true);
  };
  const saveInteres = () => {
    const interesMensual = Number(interesText) || 0;
    setData((s) => ({ ...s, cards: s.cards.map((c) => (c.id === card.id ? { ...c, interesMensual } : c)) }));
    setInteresModalOpen(false);
  };

  // What you originally borrowed — pure reference, never used in any calculation
  // (the balance is what actually drives everything else), so it's fine to leave
  // unset for a debt that's been around since before you started using Payday.
  const openMontoOriginalModal = () => {
    setMontoOriginalText(card.originalAmount > 0 ? String(card.originalAmount) : '');
    setMontoOriginalModalOpen(true);
  };
  const saveMontoOriginal = () => {
    const originalAmount = Number(montoOriginalText) || 0;
    setData((s) => ({ ...s, cards: s.cards.map((c) => (c.id === card.id ? { ...c, originalAmount } : c)) }));
    setMontoOriginalModalOpen(false);
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
          <button
            type="button"
            onClick={openInteresModal}
            style={{ ...heroTileStyle, background: 'var(--danger)', border: 'none', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.06em' }}>TE CUESTA CADA MES</div>
            <div style={{ fontWeight: 800, fontSize: 26, color: 'white', marginTop: 10, letterSpacing: '-0.02em' }}>
              {interesManual > 0 ? fmt(interesManual, currency) : 'No configurado'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: 700 }}>
              {interesManual > 0 ? 'en intereses · Editar' : 'Toca para ingresarlo'}
            </div>
          </button>
        )}
      </div>

      {possibleRateMismatch && (
        <div style={{ ...cardStyle, background: 'var(--danger-soft-bg)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--danger-text)' }}>⚠️ Revisa la tasa que ingresaste</div>
          <div style={{ fontSize: 12, color: 'var(--danger-text)' }}>
            Con {card.interestRate}% E.A. este mes te cobrarían aprox. {fmt(interestCost, currency)}, pero ingresaste{' '}
            {fmt(interesManual, currency)} reales desde tu extracto. Es posible que {card.interestRate}% sea tu tasa
            mensual y no la E.A. (anual) — revísalo en tu extracto y corrígelo en "Editar" desde Gastos si es así.
          </div>
        </div>
      )}

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

      <button
        type="button"
        onClick={openCuotaModal}
        style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={labelStyle}>CUOTA MENSUAL</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: card.minPayment > 0 ? 'var(--text)' : 'var(--text-secondary)' }}>
            {card.minPayment > 0 ? fmt(card.minPayment, currency) : 'No configurada'}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-text)' }}>Editar</span>
        </div>
      </button>

      {cuotaModalOpen && (
        <BottomSheet onClose={() => setCuotaModalOpen(false)}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Cuota mensual</div>
          <ExplainerNote>
            El pago mínimo que debes hacer cada mes por esta deuda. En tarjetas de crédito suele cambiar de un mes a otro. Actualízalo aquí cuando cambie.
          </ExplainerNote>
          <NumberInput value={cuotaText} onChange={(e) => setCuotaText(e.target.value)} placeholder="Ej: 400.000" style={textInputStyle()} />
          <button
            type="button"
            onClick={saveCuota}
            style={{ height: 50, borderRadius: 25, background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: 'none' }}
          >
            Guardar
          </button>
        </BottomSheet>
      )}

      {interesModalOpen && (
        <BottomSheet onClose={() => setInteresModalOpen(false)}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Interés de este mes</div>
          <ExplainerNote>
            Cuánto te cobraron en intereses este mes, según tu extracto o app del banco. Cada tarjeta calcula esto un
            poco distinto (fechas de corte, promociones, cobros mínimos), así que es más confiable copiarlo de ahí que
            calcularlo con la tasa.
          </ExplainerNote>
          <NumberInput value={interesText} onChange={(e) => setInteresText(e.target.value)} placeholder="Ej: 15.000" style={textInputStyle()} />
          <button
            type="button"
            onClick={saveInteres}
            style={{ height: 50, borderRadius: 25, background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: 'none' }}
          >
            Guardar
          </button>
        </BottomSheet>
      )}

      {montoOriginalModalOpen && (
        <BottomSheet onClose={() => setMontoOriginalModalOpen(false)}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Monto total original</div>
          <ExplainerNote>
            Cuánto pediste prestado en un inicio. Es solo de referencia para que veas cuánto llevas recorrido: no afecta
            ningún cálculo de esta pantalla, esos siempre parten del saldo pendiente de hoy.
          </ExplainerNote>
          <NumberInput value={montoOriginalText} onChange={(e) => setMontoOriginalText(e.target.value)} placeholder="Ej: 5.000.000" style={textInputStyle()} />
          <button
            type="button"
            onClick={saveMontoOriginal}
            style={{ height: 50, borderRadius: 25, background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: 'none' }}
          >
            Guardar
          </button>
        </BottomSheet>
      )}

      <ExplainerNote>
        El círculo muestra qué tanto de esta deuda ya pagaste ({pct}%): entre más lleno, más cerca estás de terminarla.
        {card.interestRate > 0 &&
          ` Lo rojo es lo que te cuesta cada mes solo por tenerla (tú lo ingresas desde tu extracto). No reduce lo que debes, es dinero extra que pagas por no haberla saldado todavía. "E.A." significa Efectivo Anual: es la tasa de interés que cobran por un año completo, la misma que suele aparecer en tu extracto o contrato.`}
        {months !== null && ` Llevas ${months === 0 ? 'menos de un mes' : months === 1 ? '1 mes' : `${months} meses`} con esta deuda.`}
      </ExplainerNote>

      {/* Ficha completa: todos los datos de la deuda, organizados en un solo lugar */}
      <div style={cardStyle}>
        <div style={labelStyle}>DETALLE COMPLETO</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1,
            marginTop: 14,
            background: 'var(--divider)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <DetailRow
            label="Monto total original"
            value={card.originalAmount > 0 ? fmt(card.originalAmount, currency) : 'No configurado'}
            valueColor={card.originalAmount > 0 ? 'var(--text)' : 'var(--text-secondary)'}
            onEdit={openMontoOriginalModal}
          />
          <DetailRow
            label="Tasa de interés anual"
            value={card.interestRate > 0 ? `${card.interestRate}% E.A.` : 'No configurada'}
            valueColor={card.interestRate > 0 ? 'var(--text)' : 'var(--text-secondary)'}
          />
          <DetailRow
            label="Pago mínimo mensual"
            value={card.minPayment > 0 ? fmt(card.minPayment, currency) : 'No configurado'}
            valueColor={card.minPayment > 0 ? 'var(--text)' : 'var(--text-secondary)'}
            onEdit={openCuotaModal}
          />
          <DetailRow
            label="Prioridad"
            value={priorityRank !== null ? `#${priorityRank} de ${totalOpenDebts}` : 'Ya la pagaste'}
            sub={priorityRank !== null ? methodLabel : null}
          />
          <DetailRow
            label="Interés mensual estimado"
            value={interestCost > 0 ? fmt(interestCost, currency) : 'No aplica'}
            sub={card.interestRate > 0 ? 'según la tasa, no tu extracto real' : 'falta configurar la tasa'}
          />
          <DetailRow
            label="Meses restantes estimados"
            value={baseline.stuck ? 'No se alcanza a pagar así' : formatMonthsLabel(baseline.monthsToPayoff)}
            valueColor={baseline.stuck ? 'var(--danger-text)' : 'var(--text)'}
            sub="pagando solo el mínimo, desde hoy"
          />
          <DetailRow
            label="Interés total acumulado estimado"
            value={baseline.stuck ? '—' : fmt(baseline.totalInterest, currency)}
            sub="hasta terminar de pagarla, con el mínimo"
          />
          <DetailRow label="Abonado hasta hoy" value={fmt(paidToDate, currency)} valueColor="var(--accent-text)" />
          <DetailRow label="Balance pendiente" value={fmt(card.balance, currency)} span />
        </div>
      </div>

      {/* Comparación de escenarios */}
      <div style={cardStyle}>
        <div style={labelStyle}>{hasInterest ? '¿CUÁNTO PAGARÍAS EN INTERESES EN TOTAL?' : '¿CUÁNDO TERMINARÍAS DE PAGARLA?'}</div>
        <ExplainerNote>
          {hasInterest
            ? 'Esto proyecta hacia adelante, desde el saldo de hoy. No es lo que ya pagaste, es lo que pagarías si sigues el plan que elijas.'
            : 'Esto proyecta hacia adelante, desde el saldo de hoy: en qué mes real la terminarías de pagar según cuánto abones.'}
        </ExplainerNote>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <div style={scenarioCardStyle}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>SOLO EL MÍNIMO</div>
            {baseline.stuck ? (
              <div style={{ fontSize: 12, color: 'var(--danger-text)', marginTop: 4 }}>
                {minGap > 0 ? (
                  <>El mínimo ({fmt(card.minPayment || 0, currency)}) no cubre el interés mensual ({fmt(interestCost, currency)}). Te faltan {fmt(minGap, currency)} más al mes solo para que deje de crecer.</>
                ) : (
                  <>No tienes un pago mínimo que reduzca esta deuda, así que el saldo nunca baja por sí solo.</>
                )}
              </div>
            ) : hasInterest ? (
              <>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.01em' }}>{fmt(baseline.totalInterest, currency)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>en intereses · {formatMonthsLabel(baseline.monthsToPayoff)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Terminarías en {formatMonthYear(baselinePayoffDate)}</div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.01em' }}>{formatMonthsLabel(baseline.monthsToPayoff)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Terminarías en {formatMonthYear(baselinePayoffDate)}</div>
              </>
            )}
          </div>
          <div style={{ ...scenarioCardStyle, background: 'var(--accent-soft-bg)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-text)' }}>ABONANDO EXTRA</div>
            {withExtra.stuck ? (
              <div style={{ fontSize: 12, color: 'var(--danger-text)', marginTop: 4 }}>
                {extra > 0 ? (
                  <>Con el mínimo + este extra ({fmt((card.minPayment || 0) + extra, currency)}) sigues sin cubrir el interés ({fmt(interestCost, currency)}). Te faltan {fmt(extraGap, currency)} más al mes.</>
                ) : (
                  <>Agrega un abono extra arriba. Ahora mismo el mínimo no cubre el interés.</>
                )}
              </div>
            ) : hasInterest ? (
              <>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.01em' }}>{fmt(withExtra.totalInterest, currency)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>en intereses · {formatMonthsLabel(withExtra.monthsToPayoff)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Terminarías en {formatMonthYear(withExtraPayoffDate)}</div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.01em' }}>{formatMonthsLabel(withExtra.monthsToPayoff)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Terminarías en {formatMonthYear(withExtraPayoffDate)}</div>
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
              {fmt(extra, currency)} es más de lo que esta deuda necesita para pagarse rápido. La{' '}
              <b>saldarías por completo {withExtra.monthsToPayoff === 1 ? 'este mes' : `en ${formatMonthsLabel(withExtra.monthsToPayoff)}`}</b>
              {withExtraPayoffDate && `, en ${formatMonthYear(withExtraPayoffDate)}`}, y de ahí en adelante te sobrarían{' '}
              <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{fmt(withExtra.surplus, currency)}</span> cada mes que podrías destinar a tus otras deudas o metas.
            </div>
          </div>
        )}

        {!hasSurplus && extraRescuesFromStuck && (
          <div style={{ marginTop: 12, background: 'var(--accent-soft-bg)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              Con el mínimo solo, esta deuda <b>nunca se termina de pagar</b>.
              {hasInterest ? ' El interés crece más rápido de lo que abonas.' : ' No tienes una cuota mensual configurada (o es de $0), así que el saldo no baja solo.'}
              {' '}Pero con {fmt(extra, currency)} extra al mes, sí la terminarías de pagar, en{' '}
              <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{formatMonthsLabel(withExtra.monthsToPayoff)}</span>
              {withExtraPayoffDate && `, en ${formatMonthYear(withExtraPayoffDate)}`}.
            </div>
          </div>
        )}

        {!hasSurplus && extra > 0 && !extraRescuesFromStuck && interestSaved !== null && (hasInterest || monthsSaved > 0) && (
          <div style={{ marginTop: 12, background: 'var(--accent-soft-bg)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              {hasInterest ? (
                <>
                  Abonando {fmt(extra, currency)} extra cada mes, te ahorrarías{' '}
                  <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{fmt(Math.max(0, interestSaved), currency)}</span> en intereses
                  {monthsSaved > 0 && (
                    <>
                      {' '}
                      y terminarías <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{monthsSaved} {monthsSaved === 1 ? 'mes' : 'meses'}</span> antes, en{' '}
                      {formatMonthYear(withExtraPayoffDate)}.
                    </>
                  )}
                </>
              ) : (
                <>
                  Abonando {fmt(extra, currency)} extra cada mes, terminarías{' '}
                  <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{monthsSaved} {monthsSaved === 1 ? 'mes' : 'meses'}</span> antes, en{' '}
                  {formatMonthYear(withExtraPayoffDate)}.
                </>
              )}
            </div>
          </div>
        )}

        {extra === 0 && (
          <ExplainerNote>Escribe un monto arriba para comparar cómo cambia si abonas más que el mínimo.</ExplainerNote>
        )}

        <ExplainerNote>
          {hasInterest
            ? 'Si solo pagas el mínimo, el interés se sigue sumando cada mes sobre lo que debes, así que terminas pagando más en total. Cada peso extra que abonas reduce el saldo sobre el que se calcula el interés del mes siguiente, por eso pagas menos intereses y terminas antes.'
            : 'Cada peso extra que abonas se descuenta directo del saldo pendiente, así que entre más abones cada mes, antes terminas de pagarla.'}
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
          sortedHistory.map((h) => {
            const linkedIncome = h.incomeId ? data.incomes.find((i) => i.id === h.incomeId) : null;
            return (
              <div key={h._idx} style={{ padding: '10px 0', borderTop: '1px solid var(--divider)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{fmt(h.amount, currency)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {formatShortDate(h.date)}
                      {h.note ? ` · ${h.note}` : ''}
                      {h.incomeId ? ' · Desde un ingreso' : ''}
                    </div>
                  </div>
                  {linkedIncome ? (
                    <button
                      type="button"
                      onClick={() => onEditIncome(linkedIncome)}
                      style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer', border: 'none', background: 'none', padding: '4px 0', flexShrink: 0 }}
                    >
                      Editar ingreso
                    </button>
                  ) : (
                    <CardMenu
                      inline
                      triggerBg="transparent"
                      actions={[
                        { label: 'Editar', onClick: () => openEditHistoryModal(h._idx) },
                        { label: 'Eliminar', destructive: true, onClick: () => askDeleteHistory(h._idx) },
                      ]}
                    />
                  )}
                </div>
                {deleteHistoryIdx === h._idx && (
                  <InlineConfirm
                    message="¿Eliminar este abono? El monto vuelve al saldo pendiente."
                    onConfirm={() => confirmDeleteHistory(h._idx)}
                    onCancel={cancelDeleteHistory}
                  />
                )}
              </div>
            );
          })
        )}
        {sortedHistory.some((h) => h.incomeId) && (
          <ExplainerNote>
            Los abonos marcados "Desde un ingreso" se editan o eliminan desde ese ingreso. Usa "Editar ingreso" para ir directo.
          </ExplainerNote>
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
