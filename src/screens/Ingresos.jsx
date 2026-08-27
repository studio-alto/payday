import { useState } from 'react';
import { fmt } from '../lib/format';
import { dayTypeLabel, formatShortDate, isSameMonth } from '../lib/dates';
import { cardStyle, labelStyle, textInputStyle } from '../lib/styles';
import InlineConfirm from '../components/InlineConfirm';
import PencilIcon from '../components/PencilIcon';
import FixedHeader from '../components/FixedHeader';
import { reverseIncomeEffects } from '../lib/debt';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function IncomeRow({ inc, currency, isLast, onEdit, confirmDeleteId, setConfirmDeleteId, confirmDelete }) {
  return (
    <div style={{ padding: '11px 0', borderBottom: isLast ? 'none' : '1px solid var(--divider)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => onEdit(inc)}
            aria-label="Editar"
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: 'var(--input-bg)',
              flexShrink: 0,
            }}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteId(inc.id)}
            aria-label="Eliminar"
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              lineHeight: 1,
              fontWeight: 700,
              cursor: 'pointer',
              color: 'var(--danger-text)',
              background: 'var(--input-bg)',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      </div>
      {confirmDeleteId === inc.id && (
        <InlineConfirm message="¿Eliminar este ingreso?" onConfirm={() => confirmDelete(inc.id)} onCancel={() => setConfirmDeleteId(null)} />
      )}
    </div>
  );
}

export default function Ingresos({ data, setData, onNavigate, onEdit }) {
  const { incomes } = data;
  const { currency } = data.user;
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchText, setSearchText] = useState('');
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

  const totalMonthFiltered = incomes
    .filter((i) => isSameMonth(i.date) && i.estado !== 'proyectado' && (!selectedJob || i.name.trim() === selectedJob))
    .reduce((a, i) => a + i.amount, 0);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 230px)' }}>
      <FixedHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

        {jobNames.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            <button type="button" onClick={() => setSelectedJob(null)} style={jobChipStyle(!selectedJob)}>
              Todos
            </button>
            {jobNames.map((job) => (
              <button key={job} type="button" onClick={() => setSelectedJob(job)} style={jobChipStyle(selectedJob === job)}>
                {job}
              </button>
            ))}
          </div>
        )}

        <div style={cardStyle}>
          <div style={labelStyle}>TOTAL ESTE MES</div>
          {selectedJob && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{selectedJob}</div>}
          <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', marginTop: 6, letterSpacing: '-0.02em' }}>
            {fmt(totalMonthFiltered, currency)}
          </div>
        </div>
        </div>
      </FixedHeader>

      <input
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Buscar por nombre o nota…"
        style={textInputStyle()}
      />

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
    </div>
  );
}
