import { useState } from 'react';
import { fmt } from '../lib/format';
import { dayTypeLabel, formatShortDate, isSameMonth } from '../lib/dates';
import { cardStyle, labelStyle } from '../lib/styles';
import InlineConfirm from '../components/InlineConfirm';
import PencilIcon from '../components/PencilIcon';
import FixedHeader from '../components/FixedHeader';
import { reverseIncomeEffects } from '../lib/debt';

export default function Ingresos({ data, setData, onNavigate, onEdit }) {
  const { incomes } = data;
  const { currency } = data.user;
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);

  const jobNames = [...new Set(incomes.map((i) => i.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const sortedIncomes = [...incomes].sort((a, b) => b.date.localeCompare(a.date));
  const filteredIncomes = selectedJob ? sortedIncomes.filter((i) => i.name.trim() === selectedJob) : sortedIncomes;

  const totalMonthFiltered = incomes
    .filter((i) => isSameMonth(i.date) && (!selectedJob || i.name.trim() === selectedJob))
    .reduce((a, i) => a + i.amount, 0);

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

      <div style={cardStyle}>
        {filteredIncomes.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {selectedJob ? 'No hay ingresos de este trabajo.' : 'Todavía no has registrado ingresos.'}
          </div>
        )}
        {filteredIncomes.map((inc, idx) => (
          <div
            key={inc.id}
            style={{ padding: '11px 0', borderBottom: idx === filteredIncomes.length - 1 ? 'none' : '1px solid var(--divider)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {inc.name || dayTypeLabel(inc.type)}
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
                    color: 'var(--accent)',
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
        ))}
      </div>
    </div>
  );
}
