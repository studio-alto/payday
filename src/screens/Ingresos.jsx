import { useState } from 'react';
import { fmt } from '../lib/format';
import { dayTypeLabel, formatShortDate } from '../lib/dates';
import { cardStyle } from '../lib/styles';
import InlineConfirm from '../components/InlineConfirm';

export default function Ingresos({ data, setData, onNavigate, onEdit }) {
  const { incomes } = data;
  const { currency } = data.user;
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const sortedIncomes = [...incomes].sort((a, b) => b.date.localeCompare(a.date));

  const confirmDelete = (id) => {
    setData((s) => ({ ...s, incomes: s.incomes.filter((i) => i.id !== id) }));
    setConfirmDeleteId(null);
  };

  return (
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

      <div style={cardStyle}>
        {sortedIncomes.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Todavía no has registrado ingresos.</div>
        )}
        {sortedIncomes.map((inc, idx) => (
          <div
            key={inc.id}
            style={{ padding: '11px 0', borderBottom: idx === sortedIncomes.length - 1 ? 'none' : '1px solid var(--divider)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{inc.name || dayTypeLabel(inc.type)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {formatShortDate(inc.date)} · {dayTypeLabel(inc.type)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{fmt(inc.amount, currency)}</div>
                <button type="button" onClick={() => onEdit(inc)} style={{ fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  Editar
                </button>
                <button type="button" onClick={() => setConfirmDeleteId(inc.id)} style={{ fontSize: 12, cursor: 'pointer', color: 'var(--accent)' }}>
                  Eliminar
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
