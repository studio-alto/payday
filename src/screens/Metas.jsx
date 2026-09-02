import { useState } from 'react';
import { fmt } from '../lib/format';
import { uid } from '../lib/id';
import { cardStyle, labelStyle, textInputStyle, primaryButtonStyle } from '../lib/styles';
import { computeSavingsProjection, estimateMonthsToGoal } from '../lib/goalProjection';
import { formatMonthsLabel } from '../lib/debt';
import { formatFullDate, todayISO } from '../lib/dates';
import BottomSheet from '../components/BottomSheet';
import InlineConfirm from '../components/InlineConfirm';
import NumberInput from '../components/NumberInput';
import PlusIcon from '../components/PlusIcon';
import FixedHeader from '../components/FixedHeader';
import CardMenu from '../components/CardMenu';
import DateField from '../components/DateField';
import ProgressRing from '../components/ProgressRing';
import { CHART_COLORS } from '../lib/colors';

const GOAL_PRESETS = ['Fondo de emergencia', 'Viaje', 'Laptop', 'Curso', 'Otra'];

function emptyForm() {
  return { name: '', target: '', current: '', description: '', fechaObjetivo: '', color: '' };
}

export default function Metas({ data, setData, onViewDetail }) {
  const { goals } = data;
  const { currency } = data.user;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [addingToGoalId, setAddingToGoalId] = useState(null);
  const [addAmount, setAddAmount] = useState('');
  const [claimTarget, setClaimTarget] = useState('');

  // Ahorro that's counted in the Home totals but invisible here — either the
  // person picked "Sin meta" when distributing an ingreso, or the goal it was
  // tied to got deleted (which nulls the link but never moves the money anywhere).
  // Surfacing it — and letting it be assigned to a real goal — closes that gap.
  const unassignedIncomes = data.incomes.filter(
    (i) => i.estado !== 'proyectado' && !i.distribution.goalId && (i.distribution.ahorro || 0) > 0,
  );
  const unassignedTotal = unassignedIncomes.reduce((a, i) => a + i.distribution.ahorro, 0);
  const claimUnassigned = (goalId) => {
    setData((s) => {
      const targets = s.incomes.filter((i) => i.estado !== 'proyectado' && !i.distribution.goalId && (i.distribution.ahorro || 0) > 0);
      if (targets.length === 0) return s;
      const addedTotal = targets.reduce((a, i) => a + i.distribution.ahorro, 0);
      const entries = targets.map((i) => ({ date: i.date, amount: i.distribution.ahorro, incomeId: i.id }));
      return {
        ...s,
        incomes: s.incomes.map((i) => (targets.some((t) => t.id === i.id) ? { ...i, distribution: { ...i.distribution, goalId } } : i)),
        goals: s.goals.map((g) => (g.id === goalId ? { ...g, current: g.current + addedTotal, history: [...(g.history || []), ...entries] } : g)),
      };
    });
    setClaimTarget('');
  };

  const openNewModal = () => {
    setEditingGoalId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };
  const openEditModal = (g) => {
    setEditingGoalId(g.id);
    setForm({ name: g.name, target: String(g.target), current: String(g.current), description: g.description || '', fechaObjetivo: g.fechaObjetivo || '', color: g.color || '' });
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const pickPreset = (label) => setForm((f) => ({ ...f, name: label === 'Otra' ? '' : label }));
  const pickColor = (color) => setForm((f) => ({ ...f, color: f.color === color ? '' : color }));

  const saveGoal = () => {
    if (!form.name || !form.target) return;
    setData((s) => {
      if (editingGoalId) {
        return {
          ...s,
          goals: s.goals.map((g) =>
            g.id === editingGoalId
              ? { ...g, name: form.name, target: Number(form.target), current: Number(form.current) || 0, description: form.description, fechaObjetivo: form.fechaObjetivo || null, color: form.color || null }
              : g,
          ),
        };
      }
      const initialCurrent = Number(form.current) || 0;
      return {
        ...s,
        goals: [
          ...s.goals,
          {
            id: uid(),
            name: form.name,
            target: Number(form.target),
            current: initialCurrent,
            description: form.description,
            fechaObjetivo: form.fechaObjetivo || null,
            color: form.color || null,
            estado: 'activa',
            history: initialCurrent > 0 ? [{ date: todayISO(), amount: initialCurrent }] : [],
          },
        ],
      };
    });
    setModalOpen(false);
  };

  const askDelete = (id) => setConfirmDeleteId(id);
  const cancelDelete = () => setConfirmDeleteId(null);
  const confirmDelete = (id) => {
    setData((s) => ({
      ...s,
      goals: s.goals.filter((g) => g.id !== id),
      // Clear the dangling reference so editing/deleting one of these incomes later
      // doesn't silently no-op the ahorro reversal against a goal that no longer exists.
      incomes: s.incomes.map((i) =>
        i.distribution.goalId === id ? { ...i, distribution: { ...i.distribution, goalId: null } } : i,
      ),
    }));
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
    setData((s) => ({
      ...s,
      goals: s.goals.map((g) =>
        g.id === id ? { ...g, current: g.current + amount, history: [...(g.history || []), { date: todayISO(), amount }] } : g,
      ),
    }));
    setAddingToGoalId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 88px)' }}>
      <FixedHeader>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>Metas</div>
          <button
            type="button"
            onClick={openNewModal}
            aria-label="Nueva meta"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: 'none',
              flexShrink: 0,
            }}
          >
            <PlusIcon color="var(--page-bg)" />
          </button>
        </div>
      </FixedHeader>

      {unassignedTotal > 0 && (
        <div style={cardStyle}>
          <div style={labelStyle}>AHORRO SIN META</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.02em' }}>{fmt(unassignedTotal, currency)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            De ingresos donde elegiste "Sin meta", o de una meta que eliminaste — cuenta en tu ahorro total de Inicio, pero no en el
            progreso de ninguna meta hasta que lo asignes.
          </div>
          {goals.length > 0 ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em', marginTop: 12 }}>
                ASIGNAR A
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {goals.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setClaimTarget(g.id)}
                    style={{
                      padding: '9px 14px',
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: claimTarget === g.id ? 'var(--text)' : 'var(--input-bg)',
                      color: claimTarget === g.id ? 'var(--page-bg)' : 'var(--text)',
                      border: 'none',
                    }}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
              {claimTarget && (
                <InlineConfirm
                  message={`¿Asignar ${fmt(unassignedTotal, currency)} a "${goals.find((g) => g.id === claimTarget)?.name}"?`}
                  onConfirm={() => claimUnassigned(claimTarget)}
                  onCancel={() => setClaimTarget('')}
                />
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>Crea una meta para poder asignarlo.</div>
          )}
        </div>
      )}

      {goals.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Aún no tienes metas</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            Crea una para separar dinero de tus ingresos — un fondo de emergencia, un viaje, lo que quieras ahorrar.
          </div>
          <button
            type="button"
            onClick={openNewModal}
            style={{ ...primaryButtonStyle(), marginTop: 14, padding: '10px 20px', borderRadius: 20, display: 'inline-block', width: 'auto' }}
          >
            + Nueva meta
          </button>
        </div>
      )}

      {goals.map((g) => {
        const pct = Math.min(100, Math.round((g.current / g.target) * 100));
        const completed = g.current >= g.target;
        const projection = computeSavingsProjection(g.target - g.current, g.fechaObjetivo);
        const monthsEstimate = !g.fechaObjetivo ? estimateMonthsToGoal(g.target - g.current, g.history || []) : null;
        const isOverdue = projection?.overdue === true;
        const bg = isOverdue ? 'var(--danger)' : 'var(--card-bg)';
        const fg = isOverdue ? 'white' : 'var(--text)';
        const fgSoft = isOverdue ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)';
        const ringColor = isOverdue ? 'white' : (g.color || 'var(--accent)');
        const ringTrack = isOverdue ? 'rgba(255,255,255,0.3)' : 'var(--divider)';

        return (
          <CardMenu
            key={g.id}
            actions={[
              { label: 'Editar', onClick: () => openEditModal(g) },
              { label: 'Eliminar', destructive: true, onClick: () => askDelete(g.id) },
            ]}
            triggerBg={isOverdue ? 'rgba(255,255,255,0.25)' : 'var(--input-bg)'}
            triggerColor={isOverdue ? 'white' : 'var(--text-secondary)'}
          >
          <div style={{ ...cardStyle, background: bg }}>
            {isOverdue && (
              <div style={{ fontSize: 10, fontWeight: 700, color: fgSoft, letterSpacing: '0.06em', marginBottom: 2 }}>FECHA VENCIDA</div>
            )}
            {completed && !isOverdue && (
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-text)', letterSpacing: '0.06em', marginBottom: 2 }}>
                ✓ COMPLETADA
              </div>
            )}
            <div style={{ fontWeight: 700, fontSize: 15, color: fg, paddingRight: 34 }}>{g.name}</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <ProgressRing pct={pct} size={88} color={ringColor} trackColor={ringTrack}>
                <div style={{ fontWeight: 800, fontSize: 15, color: fg }}>{pct}%</div>
              </ProgressRing>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: fgSoft, fontWeight: 700 }}>AHORRADO</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: fg, letterSpacing: '-0.02em' }}>{fmt(g.current, currency)}</div>
                <div style={{ fontSize: 11, color: fgSoft, marginTop: 2 }}>de {fmt(g.target, currency)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => startAdd(g.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  background: isOverdue ? 'white' : 'var(--text)',
                  color: isOverdue ? bg : 'var(--page-bg)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                + Agregar
              </button>
              <button
                type="button"
                onClick={() => onViewDetail(g.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  background: isOverdue ? 'rgba(255,255,255,0.18)' : 'var(--input-bg)',
                  color: fg,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                Ver detalle
              </button>
            </div>

            {projection && (
              <div
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 14,
                  background: isOverdue ? 'rgba(255,255,255,0.18)' : 'var(--accent-soft-bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {projection.overdue ? (
                  <div style={{ fontSize: 12, color: 'white', fontWeight: 700 }}>
                    La fecha objetivo ({formatFullDate(g.fechaObjetivo)}) ya pasó — edita la meta para ponerle una nueva fecha.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>
                      PARA LLEGAR ANTES DEL {formatFullDate(g.fechaObjetivo)}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Por día</span>
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(projection.daily, currency)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Por semana</span>
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(projection.weekly, currency)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Por mes</span>
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(projection.monthly, currency)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {monthsEstimate !== null && (
              <div
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 14,
                  background: isOverdue ? 'rgba(255,255,255,0.18)' : 'var(--accent-soft-bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>A ESTE RITMO</div>
                <div style={{ fontSize: 13, color: fg }}>
                  Te faltan aproximadamente{' '}
                  <span style={{ fontWeight: 800, color: isOverdue ? 'white' : 'var(--accent-text)' }}>{formatMonthsLabel(monthsEstimate)}</span>{' '}
                  para completarla, según tu ritmo de aportes.
                </div>
              </div>
            )}

            {addingToGoalId === g.id && (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 14, background: isOverdue ? 'rgba(255,255,255,0.18)' : 'var(--input-bg)', display: 'flex', gap: 8 }}>
                <NumberInput
                  autoFocus
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="Monto a agregar"
                  style={{ ...textInputStyle(), flex: 1, background: 'var(--card-bg)' }}
                />
                <button
                  type="button"
                  onClick={() => confirmAdd(g.id)}
                  style={{ padding: '0 16px', borderRadius: 14, background: isOverdue ? 'white' : 'var(--text)', color: isOverdue ? bg : 'var(--page-bg)', fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none' }}
                >
                  Listo
                </button>
                <button
                  type="button"
                  onClick={cancelAdd}
                  style={{ padding: '0 12px', borderRadius: 14, color: fgSoft, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none', background: 'none' }}
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
          </CardMenu>
        );
      })}

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
          <NumberInput value={form.target} onChange={setField('target')} placeholder="Monto objetivo" style={textInputStyle()} />
          <NumberInput value={form.current} onChange={setField('current')} placeholder="Monto actual (opcional)" style={textInputStyle()} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>
              ¿PARA CUÁNDO LA QUIERES? (OPCIONAL)
            </div>
            <DateField value={form.fechaObjetivo} onChange={setField('fechaObjetivo')} style={textInputStyle()} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              Si la pones, te decimos cuánto ahorrar por día, semana o mes para llegar a tiempo. Si la dejas en blanco, te
              estimamos igual cuántos meses te faltan según tu ritmo de aportes.
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 700 }}>COLOR (OPCIONAL)</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => pickColor('')}
                aria-label="Color por defecto"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  border: form.color === '' ? '3px solid var(--text)' : '3px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
              {CHART_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => pickColor(c)}
                  aria-label={`Color ${c}`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: c,
                    border: form.color === c ? '3px solid var(--text)' : '3px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
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
