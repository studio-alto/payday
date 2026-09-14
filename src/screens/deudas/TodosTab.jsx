import { fmt } from '../../lib/format';
import { formatShortDate } from '../../lib/dates';
import { cardStyle, labelStyle } from '../../lib/styles';
import MonthSwitcher from './MonthSwitcher';

// "Todos" tab — solo lectura: gastos fijos ya pagados en el mes visto (desde el
// historial de cada gasto, la misma fuente que monthlyRecap.js usa para "gastos
// fijos" — no el monto mensual recurrente) más los gastos variables, combinados
// en una sola lista por fecha. Sin botón de "+" porque no crea nada por sí sola.
export default function TodosTab({ data, monthNav }) {
  const { expenses } = data;
  const { currency } = data.user;
  const gastosVariables = data.gastosVariables || [];

  const fixedPaidThisMonth = expenses.flatMap((e) =>
    (e.history || [])
      .filter((h) => monthNav.inMonth(h.date))
      .map((h) => ({ date: h.date, amount: h.amount, name: e.name, categoria: e.categoria, kind: 'fijo' })),
  );
  const totalFixedPaidMonth = fixedPaidThisMonth.reduce((a, h) => a + h.amount, 0);

  const thisMonthVariables = gastosVariables.filter((g) => monthNav.inMonth(g.date));
  const totalVariableMonth = thisMonthVariables.reduce((a, g) => a + g.amount, 0);

  const allExpensesThisMonth = [...fixedPaidThisMonth, ...thisMonthVariables.map((g) => ({ ...g, kind: 'variable' }))].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const totalAllExpensesMonth = totalFixedPaidMonth + totalVariableMonth;

  return (
    <>
      <MonthSwitcher label={monthNav.label} isCurrentMonth={monthNav.isCurrent} onPrev={monthNav.goPrev} onNext={monthNav.goNext} />

      <div style={cardStyle}>
        <div style={labelStyle}>TOTAL GASTADO {monthNav.label.toUpperCase()}</div>
        <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.02em' }}>
          {fmt(totalAllExpensesMonth, currency)}
        </div>
        {totalAllExpensesMonth > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {fmt(totalFixedPaidMonth, currency)} en gastos fijos + {fmt(totalVariableMonth, currency)} en variables
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>{monthNav.label.toUpperCase()}</div>
        {allExpensesThisMonth.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            Sin gastos registrados {monthNav.isCurrent ? 'este mes' : `en ${monthNav.label.toLowerCase()}`}.
          </div>
        ) : (
          allExpensesThisMonth.map((item, idx) => (
            <div key={`${item.kind}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderTop: idx === 0 ? 'none' : '1px solid var(--divider)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{item.name || item.categoria}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {item.kind === 'fijo' ? 'Gasto fijo' : item.categoria} · {formatShortDate(item.date)}
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', flexShrink: 0 }}>{fmt(item.amount, currency)}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
