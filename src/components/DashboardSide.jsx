import { useState } from 'react';
import { fmt } from '../lib/format';
import { formatShortDate, todayISO } from '../lib/dates';
import { cardStyle, labelStyle } from '../lib/styles';
import { upcomingEvents, eventsForDay } from '../lib/upcoming';
import MonthCalendar from './MonthCalendar';
import { MethodTag } from './PaymentMethodIcon';

const KIND = {
  ingreso: { color: 'var(--good-text)', bg: 'var(--good-soft-bg)', path: 'M12 5v14M6 13l6 6 6-6' },
  gasto: { color: 'var(--accent-text)', bg: 'var(--accent-soft-bg)', path: 'M12 19V5M6 11l6-6 6 6' },
  deuda: { color: '#476bff', bg: 'rgba(71,107,255,0.12)', path: 'M3 7h18v10H3zM3 11h18' },
};

function EventIcon({ kind }) {
  const k = KIND[kind];
  return (
    <span style={{ width: 38, height: 38, borderRadius: '50%', background: k.bg, color: k.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={k.path} />
      </svg>
    </span>
  );
}

function relativeLabel(days) {
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  return `En ${days} días`;
}

function monthTitle(year, month) {
  const label = new Date(year, month, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayTitle(dateStr) {
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const arrowStyle = { width: 30, height: 30, borderRadius: '50%', background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' };

// Desktop-only right column of the dashboard (see .dash-side in index.css): a month
// calendar plus a timeline of what's coming up, or of whatever day gets tapped.
export default function DashboardSide({ data, onNavigate }) {
  const { user } = data;
  const currency = user.currency;
  const today = todayISO();
  const nowDate = new Date();
  const [view, setView] = useState({ year: nowDate.getFullYear(), month: nowDate.getMonth() });
  const [selectedDay, setSelectedDay] = useState(null);

  const goMonth = (delta) => {
    setSelectedDay(null);
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const inView = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getFullYear() === view.year && d.getMonth() === view.month;
  };
  const incomeDays = new Set(data.incomes.filter((i) => i.estado !== 'proyectado' && inView(i.date)).map((i) => i.date));
  const futureIncomeDays = new Set(data.incomes.filter((i) => i.estado === 'proyectado' && inView(i.date)).map((i) => i.date));
  const expenseDays = new Set([
    ...data.expenses.flatMap((e) => (e.history || []).filter((h) => inView(h.date)).map((h) => h.date)),
    ...(data.gastosVariables || []).filter((g) => inView(g.date)).map((g) => g.date),
  ]);

  const toggleDay = (dateStr) => setSelectedDay((d) => (d === dateStr ? null : dateStr));
  const events = selectedDay ? eventsForDay(data, selectedDay) : upcomingEvents(data).slice(0, 6);

  return (
    <>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button type="button" onClick={() => goMonth(-1)} aria-label="Mes anterior" style={arrowStyle}>
            ‹
          </button>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{monthTitle(view.year, view.month)}</div>
          <button type="button" onClick={() => goMonth(1)} aria-label="Mes siguiente" style={arrowStyle}>
            ›
          </button>
        </div>
        <MonthCalendar
          year={view.year}
          month={view.month}
          incomeDays={incomeDays}
          futureIncomeDays={futureIncomeDays}
          expenseDays={expenseDays}
          today={today}
          selectedDay={selectedDay}
          onSelectDay={toggleDay}
          showLegend
        />
        <button
          type="button"
          onClick={() => onNavigate('registrar')}
          style={{ marginTop: 14, width: '100%', height: 46, borderRadius: 23, background: 'var(--text)', color: 'var(--page-bg)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          Registrar ingreso
        </button>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={labelStyle}>{selectedDay ? dayTitle(selectedDay).toUpperCase() : 'LO QUE VIENE'}</div>
          {selectedDay && (
            <button type="button" onClick={() => setSelectedDay(null)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer' }}>
              Ver lo que viene
            </button>
          )}
        </div>

        {events.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {selectedDay ? 'Nada registrado ese día.' : 'Nada programado en los próximos 30 días.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <EventIcon kind={ev.kind} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                    {selectedDay ? ev.detail : `${ev.detail ? `${ev.detail} · ` : ''}${relativeLabel(ev.days)} · ${formatShortDate(ev.date)}`}
                    <MethodTag metodo={ev.metodo} />
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', flexShrink: 0 }}>
                  {ev.kind === 'ingreso' ? '+' : '−'}
                  {fmt(ev.amount, currency)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
