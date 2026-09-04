import { useState } from 'react';
import { fmt } from '../lib/format';
import { cardStyle, labelStyle } from '../lib/styles';
import { computeMonthlyRecap, previousMonth } from '../lib/monthlyRecap';
import BottomSheet from './BottomSheet';

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// null means "no hay mes anterior con qué comparar" (previous was 0) — not the same
// as a real 0% change, so callers must handle it separately instead of showing "0%".
function pctChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

// Builds the whole sentence (not just a "12% MÁS" fragment to slot into a template)
// because the no-data-to-compare case reads as its own sentence, not "Ganaste sin
// datos del mes anterior que Agosto" — a fragment-based template can't say that cleanly.
function changeSentence(verb, pct, previousLabel, { risesAreGood }) {
  if (pct === null) return { text: `No hay datos de ${previousLabel} para comparar cuánto ${verb}.`, color: 'var(--text-secondary)' };
  if (pct === 0) return { text: `${capitalize(verb)} igual que ${previousLabel}.`, color: 'var(--text-secondary)' };
  const rose = pct > 0;
  const good = rose === risesAreGood;
  return { text: `${capitalize(verb)} ${Math.abs(pct)}% ${rose ? 'MÁS' : 'MENOS'} que ${previousLabel}.`, color: good ? 'var(--good-text)' : 'var(--danger-text)' };
}

function BarPair({ label, current, previous, max, currency }) {
  const hCurrent = Math.max(4, Math.round((current / max) * 64));
  const hPrevious = Math.max(4, Math.round((previous / max) * 64));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 64 }}>
        <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', borderRadius: 6, height: hCurrent, background: 'var(--text)', transition: 'height 0.4s ease' }} />
        </div>
        <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', borderRadius: 6, height: hPrevious, background: 'var(--divider)', transition: 'height 0.4s ease' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>{fmt(current, currency)}</div>
        <div style={{ flex: 1, textAlign: 'center' }}>{fmt(previous, currency)}</div>
      </div>
    </div>
  );
}

function TableRow({ label, current, previous, currency, risesAreGood }) {
  const pct = pctChange(current, previous);
  const label2 = pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`;
  const color = pct === null || pct === 0 ? 'var(--text-secondary)' : (pct > 0) === risesAreGood ? 'var(--good-text)' : 'var(--danger-text)';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr', gap: 8, padding: '10px 0', borderTop: '1px solid var(--divider)', alignItems: 'center' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text)', textAlign: 'right' }}>{fmt(current, currency)}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>{fmt(previous, currency)}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color, textAlign: 'right' }}>{label2}</div>
    </div>
  );
}

// This card's own "Gastos" and "Balance" are a simpler read than the end-of-month
// recap popup's netBalance (which also nets out ahorro and abonos a deudas) — here
// Gastos is just fixed + variable spending, and Balance = Ingresos − Gastos, so the
// three numbers always reconcile at a glance instead of silently not adding up.
export default function MonthComparisonCard({ data }) {
  const { currency } = data.user;
  const [detailOpen, setDetailOpen] = useState(false);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const prev = previousMonth(year, month);

  const current = computeMonthlyRecap(data, year, month);
  const previousRecap = computeMonthlyRecap(data, prev.year, prev.month);

  if (!current.hasActivity && !previousRecap.hasActivity) return null;

  const currentLabel = capitalize(current.label.split(' ')[0]);
  const previousLabel = capitalize(previousRecap.label.split(' ')[0]);

  const gastosActual = current.totalFixed + current.totalVariables;
  const gastosAnterior = previousRecap.totalFixed + previousRecap.totalVariables;
  const balanceActual = current.totalIncome - gastosActual;
  const balanceAnterior = previousRecap.totalIncome - gastosAnterior;

  const incomeChange = changeSentence('ganaste', pctChange(current.totalIncome, previousRecap.totalIncome), previousLabel, { risesAreGood: true });
  const expenseChange = changeSentence('gastaste', pctChange(gastosActual, gastosAnterior), previousLabel, { risesAreGood: false });

  const maxIncome = Math.max(1, current.totalIncome, previousRecap.totalIncome);
  const maxExpense = Math.max(1, gastosActual, gastosAnterior);

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
          {currentLabel} vs. {previousLabel}
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text)' }} />
            {currentLabel}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--divider)' }} />
            {previousLabel}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <BarPair label="INGRESOS" current={current.totalIncome} previous={previousRecap.totalIncome} max={maxIncome} currency={currency} />
        <BarPair label="GASTOS" current={gastosActual} previous={gastosAnterior} max={maxExpense} currency={currency} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: incomeChange.color }}>{incomeChange.text}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: expenseChange.color }}>{expenseChange.text}</div>
      </div>

      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
      >
        Ver detalles
      </button>

      {detailOpen && (
        <BottomSheet onClose={() => setDetailOpen(false)}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>
            {currentLabel} vs. {previousLabel}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr', gap: 8, paddingBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>MÉTRICA</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>{currentLabel.toUpperCase()}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>{previousLabel.toUpperCase()}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>CAMBIO</div>
          </div>
          <TableRow label="Ingresos" current={current.totalIncome} previous={previousRecap.totalIncome} currency={currency} risesAreGood />
          <TableRow label="Gastos" current={gastosActual} previous={gastosAnterior} currency={currency} risesAreGood={false} />
          <TableRow label="Balance" current={balanceActual} previous={balanceAnterior} currency={currency} risesAreGood />
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5 }}>
            Balance = Ingresos − Gastos (fijos + variables). No incluye lo que separaste para ahorro o deudas. Para
            ver el mes completo con eso, mira el resumen que aparece al empezar cada mes.
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
