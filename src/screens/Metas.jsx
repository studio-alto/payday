import { useState } from 'react';
import { fmt } from '../lib/format';
import { uid } from '../lib/id';
import { cardStyle, textInputStyle, primaryButtonStyle } from '../lib/styles';
import BottomSheet from '../components/BottomSheet';
import InlineConfirm from '../components/InlineConfirm';

const GOAL_PRESETS = ['Fondo de emergencia', 'Viaje', 'Laptop', 'Curso', 'Otra'];

function emptyForm() {
  return { name: '', target: '', current: '', description: '' };
}

export default function Metas({ data, setData }) {
  const { goals } = data;
  const { currency } = data.user;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [addingToGoalId, setAddingToGoalId] = useState(null);
  const [addAmount, setAddAmount] = useState('');

  const openNewModal = () => {
    setEditingGoalId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };
  const openEditModal = (g) => {
    setEditingGoalId(g.id);
    setForm({ name: g.name, target: String(g.target), current: String(g.current), description: g.description || '' });
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const pickPreset = (label) => setForm((f) => ({ ...f, name: label === 'Otra' ? '' : label }));

  const saveGoal = () => {
    if (!form.name || !form.target) return;
    setData((s) => {
      if (editingGoalId) {
        return {
          ...s,
          goals: s.goals.map((g) =>
            g.id === editingGoalId
              ? { ...g, name: form.name, target: Number(form.target), current: Number(form.current) || 0, description: form.description }
              : g,
          ),
        };
      }
      return {
        ...s,
        goals: [
          ...s.goals,
          { id: uid(), name: form.name, target: Number(form.target), current: Number(form.current) || 0, description: form.description, estado: 'activa' },
        ],
      };
    });
    setModalOpen(false);
  };

  const askDelete = (id) => setConfirmDeleteId(id);
  const cancelDelete = () => setConfirmDeleteId(null);
  const confirmDelete = (id) => {
    setData((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
    setConfirmDeleteId(null);
  };

  const startAdd = (id) => {
    setAddingToGoalId(id);
    setAddAmount('');
  };
  const cancelAdd = () => setAddingToGoalId(null);
  const confirmAdd = (id) => {
    const amount = Number(addAmount) || 0;
    if (amount <= 0) return;
    setData((s) => ({ ...s, goals: s.goals.map((g) => (g.id === id ? { ...g, current: g.current + amount } : g)) }));
    setAddingToGoalId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>Metas</div>

      {goals.map((g) => {
        const pct = Math.min(100, Math.round((g.current / g.target) * 100));
        return (
          <div key={g.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{g.name}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => openEditModal(g)} style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  Editar
                </button>
                <button type="button" onClick={() => askDelete(g.id)} style={{ fontSize: 13, cursor: 'pointer', color: 'var(--accent)' }}>
                  Eliminar
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {fmt(g.current, currency)} de {fmt(g.target, currency)}
            </div>
            <div style={{ height: 8, background: 'var(--divider)', borderRadius: 6, overflow: 'hidden', marginTop: 10 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--text)', borderRadius: 6, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pct}%</div>
              <button
                type="button"
                onClick={() => startAdd(g.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  background: 'var(--text)',
                  color: 'var(--page-bg)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                + Agregar
              </button>
            </div>

            {addingToGoalId === g.id && (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 14, background: 'var(--input-bg)', display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  autoFocus
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="Monto a agregar"
                  style={{ ...textInputStyle(), flex: 1, background: 'var(--card-bg)' }}
                />
                <button
                  type="button"
                  onClick={() => confirmAdd(g.id)}
                  style={{ padding: '0 16px', borderRadius: 14, background: 'var(--text)', color: 'var(--page-bg)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Listo
                </button>
                <button
                  type="button"
                  onClick={cancelAdd}
                  style={{ padding: '0 12px', borderRadius: 14, color: 'var(--text-secondary)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            )}

            {confirmDeleteId === g.id && (
              <InlineConfirm
                message="¿Eliminar esta meta?"
                onConfirm={() => confirmDelete(g.id)}
                onCancel={cancelDelete}
              />
            )}
          </div>
        );
      })}

      <button type="button" onClick={openNewModal} style={primaryButtonStyle()}>
        + Nueva meta
      </button>

      {modalOpen && (
        <BottomSheet onClose={closeModal}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{editingGoalId ? 'Editar meta' : 'Nueva meta'}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {GOAL_PRESETS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => pickPreset(label)}
                style={{ padding: '8px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--input-bg)', color: 'var(--text)' }}
              >
                {label}
              </button>
            ))}
          </div>
          <input type="text" value={form.name} onChange={setField('name')} placeholder="Nombre de la meta" style={textInputStyle()} />
          <input type="number" value={form.target} onChange={setField('target')} placeholder="Monto objetivo" style={textInputStyle()} />
          <input type="number" value={form.current} onChange={setField('current')} placeholder="Monto actual (opcional)" style={textInputStyle()} />
          <textarea
            value={form.description}
            onChange={setField('description')}
            placeholder="Descripción (opcional)"
            rows={2}
            style={{ ...textInputStyle(), resize: 'none' }}
          />
          <button type="button" onClick={saveGoal} style={{ ...primaryButtonStyle(), height: 50, borderRadius: 25 }}>
            Guardar meta
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
