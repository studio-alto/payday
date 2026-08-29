import { useState } from 'react';
import { fmt } from '../lib/format';
import { dayTypeLabel, formatShortDate, isSameMonth, isWithinDays } from '../lib/dates';
import { cardStyle, labelStyle, textInputStyle } from '../lib/styles';
import InlineConfirm from '../components/InlineConfirm';
import PencilIcon from '../components/PencilIcon';
import FixedHeader from '../components/FixedHeader';
import SwipeActions from '../components/SwipeActions';
import { reverseIncomeEffects } from '../lib/debt';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const TIME_FILTERS = [
  { key: 'mes', label: 'Este mes' },
  { key: '30dias', label: 'Últimos 30 días' },
  { key: 'todo', label: 'Todo' },
];

function IncomeRow({ inc, currency, isLast, onEdit, confirmDeleteId, setConfirmDeleteId, confirmDelete }) {
  return (
    <SwipeActions
      borderRadius={0}
      actions={[
        { label: 'Editar', bg: 'var(--text)', color: 'var(--page-bg)', icon: <PencilIcon color="var(--page-bg)" accent="var(--page-bg)" />, onClick: () => onEdit(inc) },
        { label: 'Eliminar', bg: 'var(--danger)', icon: <span style={{ fontSize: 20, fontWeight: 700 }}>×</span>, onClick: () => setConfirmDeleteId(inc.id) },
      ]}
    >
      <div style={{ padding: '11px 0', borderBottom: isLast ? 'none' : '1px solid var(--divider)', background: 'var(--card-bg)' }}>
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
    </SwipeActions>
  );
}

export default function Ingresos({ data, setData, onNavigate, onEdit }) {
  const { incomes } = data;
  const { currency } = data.user;
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [timeFilter, setTimeFilter] = useState('mes');
  const [year, setYear] = useState(new Date().getFullYear());
  const [expandedMonths, setExpandedMonths] = useState(() => new Set([new Date().getMonth()]));

  const toggleMonth = (m) =>
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });

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

  const monthGroups = MONTH_LABELS.map((label, m) => {
    const items = filteredIncomes.filter((i) => {
      const d = new Date(i.date + 'T00:00:00');
      return d.getFullYear() === year && d.getMonth() === m;
    });
    return { month: m, label, items, total: items.reduce((a, i) => a + i.amount, 0) };
  });
  const yearTotal = monthGroups.reduce((a, mo) => a + mo.total, 0);

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
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 4 }}>
            <button type="button" onClick={() => setYear((y) => y - 1)} aria-label="Año anterior" style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 14 }}>
              ‹
            </button>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{year}</div>
            <button type="button" onClick={() => setYear((y) => y + 1)} aria-label="Año siguiente" style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 14 }}>
              ›
            </button>
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Total {year}: <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(yearTotal, currency)}</span>
          </div>

          {monthGroups.map((mo) => {
            const expanded = search ? mo.items.length > 0 : expandedMonths.has(mo.month);
            const hasItems = mo.items.length > 0;
            return (
              <div key={mo.month} style={{ borderTop: '1px solid var(--divider)' }}>
                <button
                  type="button"
                  onClick={() => toggleMonth(mo.month)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '12px 0', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      ›
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: hasItems ? 'var(--text)' : 'var(--text-secondary)' }}>{mo.label}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: hasItems ? 'var(--text)' : 'var(--text-secondary)' }}>{fmt(mo.total, currency)}</div>
                </button>

                {expanded && (
                  <div style={{ paddingBottom: 8 }}>
                    {hasItems ? (
                      mo.items.map((inc, idx) => (
                        <IncomeRow
                          key={inc.id}
                          inc={inc}
                          currency={currency}
                          isLast={idx === mo.items.length - 1}
                          onEdit={onEdit}
                          confirmDeleteId={confirmDeleteId}
                          setConfirmDeleteId={setConfirmDeleteId}
                          confirmDelete={confirmDelete}
                        />
                      ))
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', paddingBottom: 8 }}>Sin ingresos este mes.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
