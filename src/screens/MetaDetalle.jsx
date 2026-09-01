import { useState } from 'react';
import { fmt } from '../lib/format';
import { formatFullDate, todayISO } from '../lib/dates';
import { cardStyle, labelStyle, textInputStyle } from '../lib/styles';
import { computeSavingsProjection, estimateMonthsToGoal, projectGoalByContribution, CONTRIBUTION_FREQUENCIES } from '../lib/goalProjection';
import { formatMonthsLabel } from '../lib/debt';
import NumberInput from '../components/NumberInput';
import FixedHeader from '../components/FixedHeader';
import InlineConfirm from '../components/InlineConfirm';
import ProgressRing from '../components/ProgressRing';

function ExplainerNote({ children }) {
  return <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 8 }}>{children}</div>;
}

export default function MetaDetalle({ data, setData, goalId, onNavigate }) {
  const { goals } = data;
  const { currency } = data.user;
  const goal = goals.find((g) => g.id === goalId);

  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null);
  const [freq, setFreq] = useState('mensual');
  const [simAmount, setSimAmount] = useState('');

  if (!goal) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 88px)' }}>
        <FixedHeader>
          <button
            type="button"
            onClick={() => onNavigate('metas')}
            style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
          >
            ‹ Volver a Metas
          </button>
        </FixedHeader>
        <div style={cardStyle}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Esta meta ya no existe — puede que la hayas eliminado.</div>
        </div>
      </div>
    );
  }

  const remaining = Math.max(0, goal.target - goal.current);
  const completed = goal.current >= goal.target;
  const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));

  const dateProjection = computeSavingsProjection(remaining, goal.fechaObjetivo);
  const monthsEstimate = !goal.fechaObjetivo ? estimateMonthsToGoal(remaining, goal.history || []) : null;

  const freqDef = CONTRIBUTION_FREQUENCIES.find((f) => f.key === freq);
  const simAmountNum = Number(simAmount) || 0;
  const simProjection = projectGoalByContribution(remaining, simAmountNum, freq);

  const sortedHistory = (goal.history || [])
    .map((h, i) => ({ ...h, _idx: i }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const askDeleteContribution = (idx) => setConfirmDeleteIdx(idx);
  const cancelDeleteContribution = () => setConfirmDeleteIdx(null);
  const confirmDeleteContribution = (idx) => {
    setData((s) => ({
      ...s,
      goals: s.goals.map((g) => {
        if (g.id !== goal.id) return g;
        const entry = g.history[idx];
        return { ...g, current: Math.max(0, g.current - entry.amount), history: g.history.filter((_, i) => i !== idx) };
      }),
    }));
    setConfirmDeleteIdx(null);
  };

  const heroTileStyle = { ...cardStyle, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minWidth: 0 };
  const statTileStyle = { ...cardStyle, flex: 1, minWidth: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 100px)' }}>
      <FixedHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={() => onNavigate('metas')}
            style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
          >
            ‹ Metas
          </button>
          <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--text)', letterSpacing: '-0.02em' }}>{goal.name}</div>
          {goal.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>{goal.description}</div>}
        </div>
      </FixedHeader>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={heroTileStyle}>
          <div style={labelStyle}>AVANCE</div>
          <ProgressRing pct={pct} size={128} style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--text)', letterSpacing: '-0.02em' }}>{pct}%</div>
          </ProgressRing>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={statTileStyle}>
          <div style={labelStyle}>AHORRADO</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', marginTop: 6, letterSpacing: '-0.02em' }}>{fmt(goal.current, currency)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>de {fmt(goal.target, currency)}</div>
        </div>
        <div style={statTileStyle}>
          <div style={labelStyle}>TE FALTA</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: completed ? 'var(--accent-text)' : 'var(--text)', marginTop: 6, letterSpacing: '-0.02em' }}>
            {completed ? '¡Completada!' : fmt(remaining, currency)}
          </div>
        </div>
      </div>

      {dateProjection?.overdue && (
        <div style={{ ...cardStyle, background: 'var(--danger)' }}>
          <div style={{ fontSize: 13, color: 'white', fontWeight: 700 }}>
            La fecha objetivo ({formatFullDate(goal.fechaObjetivo)}) ya pasó — edita la meta para ponerle una nueva fecha.
          </div>
        </div>
      )}

      {dateProjection && !dateProjection.overdue && (
        <div style={cardStyle}>
          <div style={labelStyle}>PARA LLEGAR ANTES DEL {formatFullDate(goal.fechaObjetivo)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 10 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Por día</span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(dateProjection.daily, currency)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Por semana</span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(dateProjection.weekly, currency)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Por mes</span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(dateProjection.monthly, currency)}</span>
          </div>
        </div>
      )}

      {monthsEstimate !== null && (
        <div style={cardStyle}>
          <div style={labelStyle}>A ESTE RITMO</div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 8 }}>
            Te faltan aproximadamente{' '}
            <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{formatMonthsLabel(monthsEstimate)}</span> para completarla, según
            tu ritmo de aportes.
          </div>
        </div>
      )}

      {!completed && (
        <div style={cardStyle}>
          <div style={labelStyle}>SIMULADOR: ¿CADA CUÁNTO QUIERES APORTAR?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {CONTRIBUTION_FREQUENCIES.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFreq(f.key)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: freq === f.key ? 'var(--text)' : 'var(--input-bg)',
                  color: freq === f.key ? 'var(--page-bg)' : 'var(--text)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <NumberInput
              value={simAmount}
              onChange={(e) => setSimAmount(e.target.value)}
              placeholder={`Monto cada ${freqDef.noun}`}
              style={textInputStyle()}
            />
          </div>
          {simProjection ? (
            <div style={{ marginTop: 12, background: 'var(--accent-soft-bg)', borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>
                Aportando {fmt(simAmountNum, currency)} cada {freqDef.noun}, completarías la meta en{' '}
                <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>
                  {simProjection.periods} {simProjection.periods === 1 ? freqDef.noun : freqDef.nounPlural}
                </span>{' '}
                — alrededor del <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{formatFullDate(simProjection.completionDate)}</span>.
              </div>
            </div>
          ) : (
            <ExplainerNote>Escribe un monto para ver cuándo completarías la meta a ese ritmo.</ExplainerNote>
          )}
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={labelStyle}>APORTES REGISTRADOS</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{sortedHistory.length}</div>
        </div>
        {sortedHistory.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>Todavía no has registrado aportes a esta meta.</div>
        ) : (
          sortedHistory.map((h) => (
            <div key={h._idx} style={{ padding: '11px 0', borderTop: '1px solid var(--divider)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{fmt(h.amount, currency)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {formatFullDate(h.date)}
                    {h.incomeId ? ' · Desde un ingreso' : ''}
                  </div>
                </div>
                {!h.incomeId && (
                  <button
                    type="button"
                    onClick={() => askDeleteContribution(h._idx)}
                    aria-label="Eliminar aporte"
                    style={{ color: 'var(--danger-text)', fontWeight: 700, fontSize: 18, cursor: 'pointer', border: 'none', background: 'none', padding: '4px 8px', lineHeight: 1, flexShrink: 0 }}
                  >
                    ×
                  </button>
                )}
              </div>
              {confirmDeleteIdx === h._idx && (
                <InlineConfirm message="¿Eliminar este aporte?" onConfirm={() => confirmDeleteContribution(h._idx)} onCancel={cancelDeleteContribution} />
              )}
            </div>
          ))
        )}
        {sortedHistory.some((h) => h.incomeId) && (
          <ExplainerNote>Los aportes marcados "Desde un ingreso" se editan o eliminan desde ese ingreso, no aquí.</ExplainerNote>
        )}
      </div>
    </div>
  );
}
