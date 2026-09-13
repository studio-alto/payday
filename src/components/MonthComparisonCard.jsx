import { useState } from 'react';
import { fmt } from '../lib/format';
import { cardStyle, labelStyle } from '../lib/styles';
import { computeMonthlyRecap, previousMonth } from '../lib/monthlyRecap';
import BottomSheet from './BottomSheet';

function nextMonth(year, month) {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}

function BreakdownRow({ label, value, currency, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--divider)' }}>
      <div style={{ fontSize: 13, color: 'var(--text)' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color || 'var(--text)' }}>{fmt(value, currency)}</div>
    </div>
  );
}

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
  const today = now.getDate();
  const prev = previousMonth(year, month);
  // Independent of the current/previous comparison above — lets the person page
  // back (or forward, up to the current month) through any month's own breakdown.
  const [browseMonth, setBrowseMonth] = useState({ year, month });
  const isBrowsingCurrentMonth = browseMonth.year === year && browseMonth.month === month;
  const goPrevMonth = () => setBrowseMonth((s) => previousMonth(s.year, s.month));
  const goNextMonth = () => setBrowseMonth((s) => nextMonth(s.year, s.month));
  const browseRecap = computeMonthlyRecap(data, browseMonth.year, browseMonth.month);
  const browseLabel = capitalize(browseRecap.label);
  // A month in progress only has data through today — comparing it against the
  // *whole* previous month makes every partial month look worse on income and
  // worse on spending alike, just because it hasn't finished yet. Capping the
  // previous month at the same day-of-month makes it a fair, same-length comparison.
  const daysInPrevMonth = new Date(prev.year, prev.month + 1, 0).getDate();
  const cutoff = Math.min(today, daysInPrevMonth);
  const isPartialMonth = today < new Date(year, month + 1, 0).getDate();

  const current = computeMonthlyRecap(data, year, month);
  const previousRecap = computeMonthlyRecap(data, prev.year, prev.month, cutoff);

  if (!current.hasActivity && !previousRecap.hasActivity) return null;

  const currentLabel = capitalize(current.label.split(' ')[0]);
  const previousLabel = capitalize(previousRecap.label.split(' ')[0]);

  const gastosActual = current.totalFixed + current.totalVariables;
  const gastosAnterior = previousRecap.totalFixed + previousRecap.totalVariables;

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

      {isPartialMonth && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          Comparando los primeros {today} días de cada mes, para que sea justo mientras {currentLabel} no termina.
        </div>
      )}

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
        onClick={() => {
          setBrowseMonth({ year, month });
          setDetailOpen(true);
        }}
        style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
      >
        Ver detalles
      </button>

      {detailOpen && (
        <BottomSheet onClose={() => setDetailOpen(false)}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Desglose mensual</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={goPrevMonth}
              aria-label="Mes anterior"
              style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--input-bg)', color: 'var(--text)', fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              ‹
            </button>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{browseLabel}</div>
            <button
              type="button"
              onClick={goNextMonth}
              disabled={isBrowsingCurrentMonth}
              aria-label="Mes siguiente"
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                background: 'var(--input-bg)',
                color: 'var(--text)',
                fontSize: 16,
                fontWeight: 700,
                border: 'none',
                cursor: isBrowsingCurrentMonth ? 'default' : 'pointer',
                opacity: isBrowsingCurrentMonth ? 0.3 : 1,
              }}
            >
              ›
            </button>
          </div>

          {!browseRecap.hasActivity ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 0' }}>
              Sin movimientos registrados en {browseLabel.toLowerCase()}.
            </div>
          ) : (
            <div>
              <BreakdownRow label="Ingresos" value={browseRecap.totalIncome} currency={currency} color="var(--good-text)" />
              <BreakdownRow label="Ahorro" value={browseRecap.totalAhorro} currency={currency} />
              <BreakdownRow label="Gastos fijos" value={browseRecap.totalFixed} currency={currency} />
              <BreakdownRow label="Gastos variables" value={browseRecap.totalVariables} currency={currency} />
              {browseRecap.totalDebtPaid > 0 && (
                <BreakdownRow label="Abonos a deudas" value={browseRecap.totalDebtPaid} currency={currency} />
              )}
              <BreakdownRow
                label="Balance del mes"
                value={browseRecap.netBalance}
                currency={currency}
                color={browseRecap.netBalance < 0 ? 'var(--danger-text)' : 'var(--good-text)'}
              />
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5 }}>
            Balance = Ingresos − Ahorro − Gastos fijos − Gastos variables − Abonos a deudas.
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
