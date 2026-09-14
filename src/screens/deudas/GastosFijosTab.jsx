import { useImperativeHandle, useState } from 'react';
import { fmt } from '../../lib/format';
import { formatShortDate, todayISO, isSameMonth, daysUntilPayday } from '../../lib/dates';
import { uid } from '../../lib/id';
import { cardStyle, textInputStyle, primaryButtonStyle } from '../../lib/styles';
import BottomSheet from '../../components/BottomSheet';
import InlineConfirm from '../../components/InlineConfirm';
import NumberInput from '../../components/NumberInput';
import CardMenu from '../../components/CardMenu';
import MonthSwitcher from './MonthSwitcher';

const CATEGORIAS = ['Suscripción', 'Servicios', 'Transporte', 'Vivienda', 'Tarjeta de crédito', 'Otro'];

function emptyExpenseForm() {
  return { name: '', categoria: 'Suscripción', amount: '', dueDay: '', medioPago: 'efectivo' };
}

// Concentric progress rings (Apple Watch-style), one per metric — outer to inner.
// Each ring is drawn as a track circle plus a colored arc circle rotated to start at
// 12 o'clock, exactly like the reference image Natalia shared.
function ActivityRings({ rings, size = 128, strokeWidth = 9, gap = 4 }) {
  const center = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      {rings.map((r, i) => {
        const radius = center - strokeWidth / 2 - i * (strokeWidth + gap);
        const circumference = 2 * Math.PI * radius;
        const pct = Math.min(100, Math.max(0, r.pct));
        return (
          <g key={i}>
            <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--divider)" strokeWidth={strokeWidth} />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={r.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct / 100)}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </g>
        );
      })}
    </svg>
  );
}

// "Gastos fijos" tab — pagos recurrentes (arriendo, suscripciones), su estado del
// mes actual, y un vistazo de solo lectura a lo pagado en meses anteriores.
export default function GastosFijosTab({ data, setData, monthNav, addRef }) {
  const { cards, expenses } = data;
  const { currency } = data.user;
  const today = todayISO();

  // "Eliminar" archives a gasto fijo that has payment history instead of removing it
  // outright (see confirmDeleteExpense below) — otherwise cancelling a subscription
  // and deleting it here would also erase every month it was ever paid from
  // monthlyRecap, the payoff charts and the "mes pasado" view below.
  const activeExpenses = expenses.filter((e) => !e.archived);

  const sortedExpenses = [...activeExpenses].sort((a, b) => daysUntilPayday(a.dueDay) - daysUntilPayday(b.dueDay));
  const totalExpenses = activeExpenses.reduce((a, e) => a + e.amount, 0);
  // Precomputed once so both the "ESTE MES" summary and each card agree on the same
  // paid/overdue read — overdue means "past this month's due day and still unpaid"
  // (daysUntilPayday always looks forward to the *next* occurrence, so it alone can't tell us that).
  const todayDayOfMonth = new Date(today + 'T00:00:00').getDate();
  const expensesWithStatus = sortedExpenses.map((e) => {
    const paidThisMonth = e.history.some((h) => isSameMonth(h.date));
    return { ...e, paidThisMonth, isOverdue: !paidThisMonth && todayDayOfMonth > e.dueDay };
  });
  const paidCount = expensesWithStatus.filter((e) => e.paidThisMonth).length;
  const pendingCount = activeExpenses.length - paidCount;
  const paidPct = activeExpenses.length > 0 ? Math.round((paidCount / activeExpenses.length) * 100) : 0;
  // Three distinct, real readings of the same month's bills — how many are checked off,
  // how much of the money is actually covered (a paid big bill moves this more than a
  // paid small one), and how much of it is overdue. Not the same metric three times.
  const paidAmount = expensesWithStatus.filter((e) => e.paidThisMonth).reduce((a, e) => a + e.amount, 0);
  const paidAmountPct = totalExpenses > 0 ? Math.round((paidAmount / totalExpenses) * 100) : 0;
  const overdueCount = expensesWithStatus.filter((e) => e.isOverdue).length;
  const overduePct = activeExpenses.length > 0 ? Math.round((overdueCount / activeExpenses.length) * 100) : 0;
  const nextDueId = expensesWithStatus.find((e) => !e.paidThisMonth && !e.isOverdue)?.id;

  // Read-only "mes pasado" view — desde el historial de cada gasto (la misma fuente
  // que monthlyRecap.js usa), no el monto mensual recurrente. Full `expenses` (not
  // activeExpenses) so an archived gasto's past payments still count for whatever
  // month they actually happened in.
  const fixedPaidThisMonth = expenses.flatMap((e) =>
    (e.history || [])
      .filter((h) => monthNav.inMonth(h.date))
      .map((h) => ({ date: h.date, amount: h.amount, name: e.name, categoria: e.categoria, kind: 'fijo' })),
  );
  const totalFixedPaidMonth = fixedPaidThisMonth.reduce((a, h) => a + h.amount, 0);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm());
  const [confirmDeleteExpenseId, setConfirmDeleteExpenseId] = useState(null);

  const openNewExpenseModal = () => {
    setEditingExpenseId(null);
    setExpenseForm(emptyExpenseForm());
    setExpenseModalOpen(true);
  };
  useImperativeHandle(addRef, () => ({ openNew: openNewExpenseModal }));

  const openEditExpenseModal = (e) => {
    setEditingExpenseId(e.id);
    setExpenseForm({ name: e.name, categoria: e.categoria, amount: String(e.amount), dueDay: String(e.dueDay), medioPago: e.medioPago });
    setExpenseModalOpen(true);
  };
  const closeExpenseModal = () => setExpenseModalOpen(false);
  const setExpenseField = (key) => (e) => setExpenseForm((f) => ({ ...f, [key]: e.target.value }));

  const saveExpense = () => {
    if (!expenseForm.name || !expenseForm.amount || !expenseForm.dueDay) return;
    const dueDay = Math.min(31, Math.max(1, Number(expenseForm.dueDay) || 1));
    setData((s) => {
      if (editingExpenseId) {
        return {
          ...s,
          expenses: s.expenses.map((e) =>
            e.id === editingExpenseId
              ? { ...e, name: expenseForm.name, categoria: expenseForm.categoria, amount: Number(expenseForm.amount), dueDay, medioPago: expenseForm.medioPago }
              : e,
          ),
        };
      }
      return {
        ...s,
        expenses: [
          ...s.expenses,
          { id: uid(), name: expenseForm.name, categoria: expenseForm.categoria, amount: Number(expenseForm.amount), dueDay, medioPago: expenseForm.medioPago, history: [] },
        ],
      };
    });
    setExpenseModalOpen(false);
  };

  const askDeleteExpense = (id) => setConfirmDeleteExpenseId(id);
  const cancelDeleteExpense = () => setConfirmDeleteExpenseId(null);
  const confirmDeleteExpense = (id) => {
    setData((s) => ({
      ...s,
      expenses: s.expenses
        .map((e) => (e.id === id && e.history.length > 0 ? { ...e, archived: true } : e))
        .filter((e) => e.id !== id || e.archived),
    }));
    setConfirmDeleteExpenseId(null);
  };

  const markExpensePaid = (id) => {
    setData((s) => ({
      ...s,
      expenses: s.expenses.map((e) => (e.id === id ? { ...e, history: [...e.history, { date: today, amount: e.amount }] } : e)),
    }));
  };

  const [confirmUndoPaidId, setConfirmUndoPaidId] = useState(null);
  const askUndoExpensePaid = (id) => setConfirmUndoPaidId(id);
  const cancelUndoExpensePaid = () => setConfirmUndoPaidId(null);
  // Removes this month's "marcado como pagado" entry — for when it was tapped by
  // mistake. Only touches the most recent entry dated this month, not the whole history.
  const undoExpensePaid = (id) => {
    setData((s) => ({
      ...s,
      expenses: s.expenses.map((e) => {
        if (e.id !== id) return e;
        const lastIndexThisMonth = e.history.map((h) => isSameMonth(h.date)).lastIndexOf(true);
        if (lastIndexThisMonth === -1) return e;
        return { ...e, history: e.history.filter((_, i) => i !== lastIndexThisMonth) };
      }),
    }));
    setConfirmUndoPaidId(null);
  };

  return (
    <>
      {activeExpenses.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Aún no tienes gastos fijos</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            Agrega tus pagos mensuales (arriendo, servicios, suscripciones) para saber cuándo vencen.
          </div>
          <button
            type="button"
            onClick={openNewExpenseModal}
            style={{ ...primaryButtonStyle(), marginTop: 14, padding: '10px 20px', borderRadius: 20, display: 'inline-block', width: 'auto' }}
          >
            + Nuevo gasto
          </button>
        </div>
      )}

      {activeExpenses.length > 0 && (
        <MonthSwitcher label={monthNav.label} isCurrentMonth={monthNav.isCurrent} onPrev={monthNav.goPrev} onNext={monthNav.goNext} />
      )}

      {activeExpenses.length > 0 && monthNav.isCurrent && (
        <div style={cardStyle}>
          <div
            style={{
              display: 'inline-block',
              padding: '5px 12px',
              borderRadius: 14,
              background: 'var(--text)',
              color: 'var(--page-bg)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            ESTE MES
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 0 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--text)', letterSpacing: '-0.02em' }}>{fmt(totalExpenses, currency)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>Total en gastos fijos</div>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--accent-text)' }}>{paidCount}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>Ya pagados</div>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>{pendingCount}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>Por pagar</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ position: 'relative', width: 128, height: 128 }}>
                <ActivityRings
                  rings={[
                    { pct: paidPct, color: 'var(--accent)' },
                    { pct: paidAmountPct, color: 'var(--text)' },
                    { pct: overduePct, color: 'var(--danger)' },
                  ]}
                />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{paidPct}%</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700 }}>{paidPct}% pagados</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text)', flexShrink: 0 }} />
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700 }}>{paidAmountPct}% del monto</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700 }}>{overduePct}% vencidos</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!monthNav.isCurrent && (
        <div style={cardStyle}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
            PAGADO EN {monthNav.label.toUpperCase()}
          </div>
          <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.02em' }}>
            {fmt(totalFixedPaidMonth, currency)}
          </div>
          {fixedPaidThisMonth.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>Sin gastos fijos pagados ese mes.</div>
          ) : (
            [...fixedPaidThisMonth]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((h, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderTop: '1px solid var(--divider)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{h.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {h.categoria} · {formatShortDate(h.date)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', flexShrink: 0 }}>{fmt(h.amount, currency)}</div>
                </div>
              ))
          )}
        </div>
      )}

      {monthNav.isCurrent && expensesWithStatus.map((e) => {
        const daysLeft = daysUntilPayday(e.dueDay);
        const linkedCard = e.medioPago !== 'efectivo' ? cards.find((c) => c.id === e.medioPago) : null;
        const highlighted = e.isOverdue || e.id === nextDueId;
        const bg = e.isOverdue ? 'var(--danger)' : e.id === nextDueId ? 'var(--accent)' : 'var(--card-bg)';
        const fg = highlighted ? 'white' : 'var(--text)';
        const fgSoft = highlighted ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)';
        const chipBg = highlighted ? 'rgba(255,255,255,0.25)' : 'var(--input-bg)';

        return (
          <CardMenu
            key={e.id}
            actions={[
              { label: 'Editar', onClick: () => openEditExpenseModal(e) },
              { label: 'Eliminar', destructive: true, onClick: () => askDeleteExpense(e.id) },
            ]}
            triggerBg={highlighted ? 'rgba(255,255,255,0.25)' : 'var(--input-bg)'}
            triggerColor={highlighted ? 'white' : 'var(--text-secondary)'}
          >
          <div style={{ ...cardStyle, padding: 16, background: bg }}>
            {highlighted && (
              <div style={{ fontSize: 10, fontWeight: 700, color: fgSoft, letterSpacing: '0.06em', marginBottom: 2 }}>
                {e.isOverdue ? 'VENCIDO' : 'PRÓXIMO A VENCER'}
              </div>
            )}
            <div style={{ fontWeight: 700, fontSize: 15, color: fg, paddingRight: 34 }}>{e.name}</div>
            <div style={{ fontSize: 11, color: fgSoft, fontWeight: 700, marginTop: 2 }}>
              {e.categoria}
              {linkedCard && ` · ${linkedCard.name}${linkedCard.interestRate > 0 ? ` · ${linkedCard.interestRate}% E.A.` : ''}`}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, gap: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 20, color: fg, letterSpacing: '-0.02em' }}>{fmt(e.amount, currency)}</div>
              <div style={{ fontSize: 11, color: fgSoft, fontWeight: highlighted ? 700 : 400, textAlign: 'right', flexShrink: 0 }}>
                <div>Vence día {e.dueDay} · {daysLeft === 0 ? 'hoy' : daysLeft === 1 ? 'en 1 día' : `en ${daysLeft} días`}</div>
                {e.paidThisMonth && <div style={{ color: highlighted ? 'white' : 'var(--accent-text)', fontWeight: 700 }}>Pagado este mes</div>}
              </div>
            </div>

            <button
              type="button"
              onClick={() => (e.paidThisMonth ? askUndoExpensePaid(e.id) : markExpensePaid(e.id))}
              style={{
                padding: '7px 14px',
                borderRadius: 18,
                background: e.paidThisMonth ? chipBg : highlighted ? 'white' : 'var(--text)',
                color: e.paidThisMonth ? fg : highlighted ? bg : 'var(--page-bg)',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
                display: 'inline-block',
                marginTop: 10,
                border: 'none',
              }}
            >
              {e.paidThisMonth ? 'Pagado este mes · Deshacer' : 'Marcar como pagado'}
            </button>

            {confirmUndoPaidId === e.id && (
              <InlineConfirm
                message="¿Deshacer? Volverá a aparecer como pendiente de pago."
                onConfirm={() => undoExpensePaid(e.id)}
                onCancel={cancelUndoExpensePaid}
              />
            )}

            {confirmDeleteExpenseId === e.id && (
              <InlineConfirm message="¿Eliminar este gasto?" onConfirm={() => confirmDeleteExpense(e.id)} onCancel={cancelDeleteExpense} />
            )}
          </div>
          </CardMenu>
        );
      })}

      {expenseModalOpen && (
        <BottomSheet onClose={closeExpenseModal}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{editingExpenseId ? 'Editar gasto' : 'Nuevo gasto'}</div>
          <select value={expenseForm.categoria} onChange={setExpenseField('categoria')} style={textInputStyle()}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={expenseForm.name}
            onChange={setExpenseField('name')}
            placeholder="Nombre (ej: Netflix, Internet, Transporte)"
            style={textInputStyle()}
          />
          <NumberInput value={expenseForm.amount} onChange={setExpenseField('amount')} placeholder="Monto mensual" style={textInputStyle()} />
          <input
            type="text"
            inputMode="numeric"
            value={expenseForm.dueDay}
            onChange={(e) => setExpenseForm((f) => ({ ...f, dueDay: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
            placeholder="Día del mes en que vence (1-31)"
            style={textInputStyle()}
          />
          <select value={expenseForm.medioPago} onChange={setExpenseField('medioPago')} style={textInputStyle()}>
            <option value="efectivo">Efectivo / débito</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                Tarjeta: {c.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={saveExpense} style={{ ...primaryButtonStyle(), height: 50, borderRadius: 25 }}>
            Guardar
          </button>
        </BottomSheet>
      )}
    </>
  );
}
