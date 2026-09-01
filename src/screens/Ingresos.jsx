import { useEffect, useState } from 'react';
import { fmt } from '../lib/format';
import { dayTypeLabel, formatShortDate, isSameMonth, isWithinDays, todayISO } from '../lib/dates';
import { cardStyle, labelStyle, textInputStyle } from '../lib/styles';
import InlineConfirm from '../components/InlineConfirm';
import FixedHeader from '../components/FixedHeader';
import CardMenu from '../components/CardMenu';
import MonthCalendar from '../components/MonthCalendar';
import { reverseIncomeEffects } from '../lib/debt';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const TIME_FILTERS = [
  { key: 'mes', label: 'Este mes' },
  { key: '30dias', label: 'Últimos 30 días' },
  { key: 'todo', label: 'Todo' },
];

function IncomeRow({ inc, currency, isLast, onEdit, confirmDeleteId, setConfirmDeleteId, confirmDelete }) {
  return (
    <CardMenu
      actions={[
        { label: 'Editar', onClick: () => onEdit(inc) },
        { label: 'Eliminar', destructive: true, onClick: () => setConfirmDeleteId(inc.id) },
      ]}
    >
      <div style={{ padding: '11px 44px 11px 0', borderBottom: isLast ? 'none' : '1px solid var(--divider)', background: 'var(--card-bg)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {inc.name || dayTypeLabel(inc.type)}
            </div>
            {inc.estado === 'proyectado' && (
              <div style={{ fontSize: 9, fontWeight: 700, color: 'white', background: 'var(--accent)', padding: '2px 6px', borderRadius: 8, flexShrink: 0 }}>
                PROYECTADO
              </div>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', marginTop: 4 }}>{fmt(inc.amount, currency)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, whiteSpace: 'nowrap' }}>
            {formatShortDate(inc.date)} · {dayTypeLabel(inc.type)}
          </div>
        </div>
        {confirmDeleteId === inc.id && (
          <InlineConfirm message="¿Eliminar este ingreso?" onConfirm={() => confirmDelete(inc.id)} onCancel={() => setConfirmDeleteId(null)} />
        )}
      </div>
    </CardMenu>
  );
}

export default function Ingresos({ data, setData, onNavigate, onEdit }) {
  const { incomes, expenses } = data;
  const { currency } = data.user;
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [timeFilter, setTimeFilter] = useState('mes');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const goPrevMonth = () => {
    setSelectedDay(null);
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    setSelectedDay(null);
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };
  const toggleSelectedDay = (dateStr) => setSelectedDay((d) => (d === dateStr ? null : dateStr));

  // Selecting a day (or switching filters) can shrink the list a lot — without
  // this, a scroll position that made sense for the longer list leaves the
  // viewport looking at empty space past the new, shorter content, with the
  // floating nav appearing to sit in the middle of things.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [timeFilter, month, year, selectedDay]);

  const jobNames = [...new Set(incomes.map((i) => i.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const sortedIncomes = [...incomes].sort((a, b) => b.date.localeCompare(a.date));
  const search = searchText.trim().toLowerCase();
  const filteredIncomes = sortedIncomes.filter((i) => {
    if (selectedJob && i.name.trim() !== selectedJob) return false;
    if (search && !`${i.name} ${i.note || ''}`.toLowerCase().includes(search)) return false;
    return true;
  });

  // "Este mes" and "Últimos 30 días" render as a flat list — no clicking through an
  // accordion for the common case of checking recent income. "Todo" is the one mode
  // that hands you the year+month browser, for digging through older history.
  const flatIncomes = filteredIncomes.filter((i) => (timeFilter === 'mes' ? isSameMonth(i.date) : isWithinDays(i.date, 30)));
  const flatTotal = flatIncomes.filter((i) => i.estado !== 'proyectado').reduce((a, i) => a + i.amount, 0);

  // "Todo" renders a real calendar for the selected month: at-a-glance dots for
  // which days had income or an expense payment, plus both totals below —
  // easier to scan than clicking through 12 collapsed months one by one.
  const calIncomes = filteredIncomes.filter((i) => {
    const d = new Date(i.date + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const calIncomeTotal = calIncomes.filter((i) => i.estado !== 'proyectado').reduce((a, i) => a + i.amount, 0);

  const calExpensePayments = (expenses || []).flatMap((e) =>
    e.history
      .filter((h) => {
        const d = new Date(h.date + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map((h) => ({ ...h, name: e.name })),
  );
  const calExpenseTotal = calExpensePayments.reduce((a, h) => a + h.amount, 0);

  const incomeDaySet = new Set(calIncomes.map((i) => i.date));
  const expenseDaySet = new Set(calExpensePayments.map((h) => h.date));

  // When a day is tapped on the calendar, narrow the list below to just that
  // day's income and expense payments instead of the whole month.
  const dayIncomes = selectedDay ? calIncomes.filter((i) => i.date === selectedDay) : calIncomes;
  const dayExpensePayments = selectedDay ? calExpensePayments.filter((h) => h.date === selectedDay) : calExpensePayments;

  const jobChipStyle = (active) => ({
    padding: '9px 14px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    border: 'none',
    background: active ? 'var(--text)' : 'var(--input-bg)',
    color: active ? 'var(--page-bg)' : 'var(--text)',
  });

  const confirmDelete = (id) => {
    setData((s) => {
      const income = s.incomes.find((i) => i.id === id);
      const reversed = reverseIncomeEffects(income, s.goals, s.cards);
      return { ...s, incomes: s.incomes.filter((i) => i.id !== id), goals: reversed.goals, cards: reversed.cards };
    });
    setConfirmDeleteId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 150px)' }}>
      <FixedHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              aria-label="Volver"
              onClick={() => onNavigate('dashboard')}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--card-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <div style={{ width: 9, height: 9, borderLeft: '2px solid var(--text)', borderBottom: '2px solid var(--text)', transform: 'rotate(45deg)', marginLeft: 3 }} />
            </button>
            <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>Todos los ingresos</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {TIME_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setTimeFilter(f.key)}
                aria-pressed={timeFilter === f.key}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 20,
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  background: timeFilter === f.key ? 'var(--text)' : 'var(--input-bg)',
                  color: timeFilter === f.key ? 'var(--page-bg)' : 'var(--text)',
                  border: 'none',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </FixedHeader>

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={labelStyle}>FILTRAR</div>
          {(selectedJob || searchText) && (
            <button
              type="button"
              onClick={() => {
                setSelectedJob(null);
                setSearchText('');
              }}
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}
            >
              Limpiar
            </button>
          )}
        </div>

        {jobNames.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 10 }}>
            <button type="button" onClick={() => setSelectedJob(null)} aria-pressed={!selectedJob} style={jobChipStyle(!selectedJob)}>
              Todos
            </button>
            {jobNames.map((job) => (
              <button key={job} type="button" onClick={() => setSelectedJob(job)} aria-pressed={selectedJob === job} style={jobChipStyle(selectedJob === job)}>
                {job}
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Buscar por nombre o nota…"
          style={textInputStyle()}
        />
      </div>

      {timeFilter !== 'todo' && (
        <>
          <div style={cardStyle}>
            <div style={labelStyle}>{timeFilter === 'mes' ? 'TOTAL ESTE MES' : 'TOTAL ÚLTIMOS 30 DÍAS'}</div>
            {selectedJob && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{selectedJob}</div>}
            <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', marginTop: 6, letterSpacing: '-0.02em' }}>{fmt(flatTotal, currency)}</div>
          </div>

          <div style={cardStyle}>
            {flatIncomes.length > 0 ? (
              flatIncomes.map((inc, idx) => (
                <IncomeRow
                  key={inc.id}
                  inc={inc}
                  currency={currency}
                  isLast={idx === flatIncomes.length - 1}
                  onEdit={onEdit}
                  confirmDeleteId={confirmDeleteId}
                  setConfirmDeleteId={setConfirmDeleteId}
                  confirmDelete={confirmDelete}
                />
              ))
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {timeFilter === 'mes' ? 'Sin ingresos este mes.' : 'Sin ingresos en los últimos 30 días.'}
              </div>
            )}
          </div>
        </>
      )}

      {timeFilter === 'todo' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <button type="button" onClick={goPrevMonth} aria-label="Mes anterior" style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 14 }}>
              ‹
            </button>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
              {MONTH_LABELS[month]} {year}
            </div>
            <button type="button" onClick={goNextMonth} aria-label="Mes siguiente" style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 14 }}>
              ›
            </button>
          </div>

          <MonthCalendar
            year={year}
            month={month}
            incomeDays={incomeDaySet}
            expenseDays={expenseDaySet}
            today={todayISO()}
            selectedDay={selectedDay}
            onSelectDay={toggleSelectedDay}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1, background: 'var(--input-bg)', borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>TOTAL INGRESOS</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginTop: 3 }}>{fmt(calIncomeTotal, currency)}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--input-bg)', borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>TOTAL GASTOS</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginTop: 3 }}>{fmt(calExpenseTotal, currency)}</div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={labelStyle}>{selectedDay ? formatShortDate(selectedDay).toUpperCase() : 'TODO EL MES'}</div>
              {selectedDay && (
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}
                >
                  Ver todo el mes
                </button>
              )}
            </div>

            {dayExpensePayments.map((h, idx) => (
              <div
                key={`${h.name}-${idx}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--divider)' }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{h.name}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger-text)' }}>-{fmt(h.amount, currency)}</div>
              </div>
            ))}

            {dayIncomes.length > 0 ? (
              dayIncomes.map((inc, idx) => (
                <IncomeRow
                  key={inc.id}
                  inc={inc}
                  currency={currency}
                  isLast={idx === dayIncomes.length - 1}
                  onEdit={onEdit}
                  confirmDeleteId={confirmDeleteId}
                  setConfirmDeleteId={setConfirmDeleteId}
                  confirmDelete={confirmDelete}
                />
              ))
            ) : dayExpensePayments.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {selectedDay ? 'Sin ingresos ni gastos este día.' : 'Sin ingresos este mes.'}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
