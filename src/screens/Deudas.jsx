import { useState } from 'react';
import { fmt } from '../lib/format';
import { formatShortDate, todayISO, isSameMonth, daysUntilPayday } from '../lib/dates';
import { uid } from '../lib/id';
import { cardStyle, textInputStyle, primaryButtonStyle } from '../lib/styles';
import BottomSheet from '../components/BottomSheet';
import InlineConfirm from '../components/InlineConfirm';
import NumberInput from '../components/NumberInput';
import PencilIcon from '../components/PencilIcon';
import PlusIcon from '../components/PlusIcon';
import CategoryIcon from '../components/CategoryIcon';
import FixedHeader from '../components/FixedHeader';
import SwipeActions from '../components/SwipeActions';
import { sortDebtsByPriority, simulatePayoffPlan, formatMonthsLabel, monthlyPaidTotals, METHODS } from '../lib/debt';
import { VARIABLE_CATEGORIES, monthlyCategoryTotals, monthlyVariableTotals } from '../lib/variableExpenses';

const TIPOS = ['Tarjeta de crédito', 'Préstamo', 'Otro'];
const CATEGORIAS = ['Suscripción', 'Servicios', 'Transporte', 'Vivienda', 'Tarjeta de crédito', 'Otro'];

// Keeps digits and at most one decimal point (up to 2 decimal places) — interest rates
// like "2.5% E.A." need the point; plain digit-stripping was silently eating it.
function sanitizeDecimal(raw) {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  if (rest.length === 0) return whole.slice(0, 3);
  return `${whole.slice(0, 3)}.${rest.join('').slice(0, 2)}`;
}

// Same idea as sanitizeDecimal but for money amounts — no cap on the whole-number
// part (a balance or budget can be far more than 3 digits, unlike a percentage).
function sanitizeMoneyDecimal(raw) {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join('').slice(0, 2)}`;
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

function emptyForm() {
  return { tipo: 'Tarjeta de crédito', name: '', balance: '', nextPayment: '', minPayment: '', interestRate: '', startDate: '' };
}

function emptyExpenseForm() {
  return { name: '', categoria: 'Suscripción', amount: '', dueDay: '', medioPago: 'efectivo' };
}

function emptyVariableForm(today, defaultCategoria) {
  return { name: '', categoria: defaultCategoria, amount: '', date: today };
}

export default function Deudas({ data, setData, onViewDetail }) {
  const { cards, expenses } = data;
  const gastosVariables = data.gastosVariables || [];
  const { currency } = data.user;
  const debtMethod = data.user.debtMethod || 'bola_nieve';
  const today = todayISO();
  const todayDate = new Date(today + 'T00:00:00');
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth();

  const [section, setSection] = useState('deudas');

  const setDebtMethod = (key) => setData((s) => ({ ...s, user: { ...s.user, debtMethod: key } }));
  const extraMensual = Number(data.user.extraDeudaMensual) || 0;
  const setExtraMensual = (e) => setData((s) => ({ ...s, user: { ...s.user, extraDeudaMensual: Number(e.target.value) || 0 } }));

  const sortedCards = sortDebtsByPriority(cards, debtMethod);
  const priorityId = sortedCards.find((c) => c.balance > 0)?.id;
  const payoffPlan = simulatePayoffPlan(cards, debtMethod, extraMensual);

  const totalBalance = cards.reduce((a, c) => a + c.balance, 0);
  const totalPaidAllTime = cards.reduce((a, c) => a + c.history.reduce((h, x) => h + x.amount, 0), 0);
  const pctPaidGlobal = totalPaidAllTime + totalBalance > 0 ? Math.round((totalPaidAllTime / (totalPaidAllTime + totalBalance)) * 100) : 0;
  const debtDonut = `conic-gradient(var(--accent) ${pctPaidGlobal}%, var(--divider) ${pctPaidGlobal}% 100%)`;
  const monthlyPaid = monthlyPaidTotals(cards, 6);
  const maxMonthlyPaid = Math.max(1, ...monthlyPaid.map((m) => m.total));
  const monthlyPaidLabel = `Abonado por mes: ${monthlyPaid.map((m) => `${m.label} ${fmt(m.total, currency)}`).join(', ')}`;

  const sortedExpenses = [...expenses].sort((a, b) => daysUntilPayday(a.dueDay) - daysUntilPayday(b.dueDay));
  const totalExpenses = expenses.reduce((a, e) => a + e.amount, 0);
  // Precomputed once so both the "ESTE MES" summary and each card agree on the same
  // paid/overdue read — overdue means "past this month's due day and still unpaid"
  // (daysUntilPayday always looks forward to the *next* occurrence, so it alone can't tell us that).
  const todayDayOfMonth = new Date(today + 'T00:00:00').getDate();
  const expensesWithStatus = sortedExpenses.map((e) => {
    const paidThisMonth = e.history.some((h) => isSameMonth(h.date));
    return { ...e, paidThisMonth, isOverdue: !paidThisMonth && todayDayOfMonth > e.dueDay };
  });
  const paidCount = expensesWithStatus.filter((e) => e.paidThisMonth).length;
  const pendingCount = expenses.length - paidCount;
  const paidPct = expenses.length > 0 ? Math.round((paidCount / expenses.length) * 100) : 0;
  // Three distinct, real readings of the same month's bills — how many are checked off,
  // how much of the money is actually covered (a paid big bill moves this more than a
  // paid small one), and how much of it is overdue. Not the same metric three times.
  const paidAmount = expensesWithStatus.filter((e) => e.paidThisMonth).reduce((a, e) => a + e.amount, 0);
  const paidAmountPct = totalExpenses > 0 ? Math.round((paidAmount / totalExpenses) * 100) : 0;
  const overdueCount = expensesWithStatus.filter((e) => e.isOverdue).length;
  const overduePct = expenses.length > 0 ? Math.round((overdueCount / expenses.length) * 100) : 0;
  const nextDueId = expensesWithStatus.find((e) => !e.paidThisMonth && !e.isOverdue)?.id;

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm());
  const [confirmDeleteExpenseId, setConfirmDeleteExpenseId] = useState(null);

  const openNewExpenseModal = () => {
    setEditingExpenseId(null);
    setExpenseForm(emptyExpenseForm());
    setExpenseModalOpen(true);
  };
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
    setData((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingCardId, setPayingCardId] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', note: '' });

  const openNewModal = () => {
    setEditingCardId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };
  const openEditModal = (c) => {
    setEditingCardId(c.id);
    setForm({
      tipo: c.tipo || 'Tarjeta de crédito',
      name: c.name,
      balance: String(c.balance),
      nextPayment: c.nextPayment,
      minPayment: String(c.minPayment),
      interestRate: c.interestRate ? String(c.interestRate) : '',
      startDate: c.startDate || '',
    });
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const saveCard = () => {
    if (!form.name || !form.balance) return;
    setData((s) => {
      if (editingCardId) {
        return {
          ...s,
          cards: s.cards.map((c) =>
            c.id === editingCardId
              ? {
                  ...c,
                  name: form.name,
                  balance: Number(form.balance),
                  nextPayment: form.nextPayment || c.nextPayment,
                  minPayment: Number(form.minPayment) || 0,
                  interestRate: Number(form.interestRate) || 0,
                  tipo: form.tipo,
                  startDate: form.startDate || null,
                }
              : c,
          ),
        };
      }
      return {
        ...s,
        cards: [
          ...s.cards,
          {
            id: uid(),
            name: form.name,
            balance: Number(form.balance),
            nextPayment: form.nextPayment || today,
            minPayment: Number(form.minPayment) || 0,
            interestRate: Number(form.interestRate) || 0,
            tipo: form.tipo,
            startDate: form.startDate || null,
            history: [],
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
      cards: s.cards.filter((c) => c.id !== id),
      // Fall back linked expenses to efectivo so they don't keep pointing at a card
      // that no longer exists (they'd silently stop showing its name/tasa otherwise).
      expenses: s.expenses.map((e) => (e.medioPago === id ? { ...e, medioPago: 'efectivo' } : e)),
    }));
    setConfirmDeleteId(null);
  };

  const openPayModal = (id) => {
    setPayingCardId(id);
    setPayForm({ amount: '', note: '', date: today });
    setPayModalOpen(true);
  };
  const closePayModal = () => setPayModalOpen(false);
  const confirmPay = () => {
    const amount = Number(payForm.amount) || 0;
    if (amount <= 0) return;
    setData((s) => ({
      ...s,
      cards: s.cards.map((c) =>
        c.id === payingCardId
          ? { ...c, balance: Math.max(0, c.balance - amount), history: [...c.history, { date: payForm.date || today, amount, note: payForm.note }] }
          : c,
      ),
    }));
    setPayModalOpen(false);
  };

  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [deleteHistoryTarget, setDeleteHistoryTarget] = useState(null);
  const deleteHistoryEntry = (cardId, index) => {
    setData((s) => ({
      ...s,
      cards: s.cards.map((c) => {
        if (c.id !== cardId) return c;
        const entry = c.history[index];
        return { ...c, balance: c.balance + entry.amount, history: c.history.filter((_, i) => i !== index) };
      }),
    }));
    setDeleteHistoryTarget(null);
  };

  // Which categories actually show up as budget rows — chosen by the person (see
  // "Elegir categorías" below), not every preset at once. Logging a gasto still
  // offers the full preset list plus any custom category, even before it's tracked.
  const trackedCategories = data.user.gastoVariableCategorias || [];
  const allAvailableCategories = [...new Set([...VARIABLE_CATEGORIES, ...trackedCategories])];

  // Budget-vs-actual per category, for the current calendar month only — matches
  // how the rest of the app (gastos fijos, deudas) always reasons in "this month" terms.
  const categoryTotals = monthlyCategoryTotals(gastosVariables, trackedCategories, currentYear, currentMonth);
  const thisMonthVariables = [...gastosVariables]
    .filter((g) => {
      const d = new Date(g.date + 'T00:00:00');
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  // Sums every gasto this month, tracked category or not — the itemized list below
  // shows all of them too, so this total shouldn't silently exclude an untracked one.
  const totalVariableMonth = thisMonthVariables.reduce((a, g) => a + g.amount, 0);

  const variableMonthly = monthlyVariableTotals(gastosVariables, 6);
  const maxVariableMonthly = Math.max(1, ...variableMonthly.map((m) => m.total));
  const variableMonthlyLabel = `Gastado por mes: ${variableMonthly.map((m) => `${m.label} ${fmt(m.total, currency)}`).join(', ')}`;

  const setPresupuestoCategoria = (categoria, value) => {
    setData((s) => ({
      ...s,
      user: { ...s.user, presupuestoVariable: { ...s.user.presupuestoVariable, [categoria]: Number(value) || 0 } },
    }));
  };

  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [customCategoryText, setCustomCategoryText] = useState('');
  const toggleTrackedCategory = (categoria) => {
    setData((s) => {
      const list = s.user.gastoVariableCategorias || [];
      const next = list.includes(categoria) ? list.filter((c) => c !== categoria) : [...list, categoria];
      return { ...s, user: { ...s.user, gastoVariableCategorias: next } };
    });
  };
  const addCustomCategory = () => {
    const name = customCategoryText.trim();
    if (!name) return;
    setData((s) => {
      const list = s.user.gastoVariableCategorias || [];
      if (list.includes(name)) return s;
      return { ...s, user: { ...s.user, gastoVariableCategorias: [...list, name] } };
    });
    setCustomCategoryText('');
  };

  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [editingVariableId, setEditingVariableId] = useState(null);
  const [variableForm, setVariableForm] = useState(emptyVariableForm(today, trackedCategories[0] || VARIABLE_CATEGORIES[0]));
  const [confirmDeleteVariableId, setConfirmDeleteVariableId] = useState(null);

  const openNewVariableModal = () => {
    setEditingVariableId(null);
    setVariableForm(emptyVariableForm(today, trackedCategories[0] || VARIABLE_CATEGORIES[0]));
    setVariableModalOpen(true);
  };
  const openEditVariableModal = (g) => {
    setEditingVariableId(g.id);
    setVariableForm({ name: g.name || '', categoria: g.categoria, amount: String(g.amount), date: g.date });
    setVariableModalOpen(true);
  };
  const closeVariableModal = () => setVariableModalOpen(false);
  const setVariableField = (key) => (e) => setVariableForm((f) => ({ ...f, [key]: e.target.value }));

  const saveVariable = () => {
    if (!variableForm.amount) return;
    setData((s) => {
      const list = s.gastosVariables || [];
      if (editingVariableId) {
        return {
          ...s,
          gastosVariables: list.map((g) =>
            g.id === editingVariableId
              ? { ...g, name: variableForm.name, categoria: variableForm.categoria, amount: Number(variableForm.amount), date: variableForm.date || today }
              : g,
          ),
        };
      }
      return {
        ...s,
        gastosVariables: [
          ...list,
          { id: uid(), name: variableForm.name, categoria: variableForm.categoria, amount: Number(variableForm.amount), date: variableForm.date || today },
        ],
      };
    });
    setVariableModalOpen(false);
  };

  const askDeleteVariable = (id) => setConfirmDeleteVariableId(id);
  const cancelDeleteVariable = () => setConfirmDeleteVariableId(null);
  const confirmDeleteVariable = (id) => {
    setData((s) => ({ ...s, gastosVariables: (s.gastosVariables || []).filter((g) => g.id !== id) }));
    setConfirmDeleteVariableId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 88px)' }}>
      <FixedHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>Deudas</div>
            <button
              type="button"
              onClick={section === 'deudas' ? openNewModal : section === 'gastos' ? openNewExpenseModal : openNewVariableModal}
              aria-label={section === 'deudas' ? 'Nueva deuda' : section === 'gastos' ? 'Nuevo gasto' : 'Nuevo gasto variable'}
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
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'deudas', label: 'Deudas' },
              { key: 'gastos', label: 'Gastos fijos' },
              { key: 'variables', label: 'Variables' },
            ].map((s) => {
              const active = section === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  style={{
                    flex: 1,
                    padding: '9px 0',
                    borderRadius: 20,
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    background: active ? 'var(--text)' : 'var(--input-bg)',
                    color: active ? 'var(--page-bg)' : 'var(--text)',
                    border: 'none',
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </FixedHeader>

      {section === 'deudas' && cards.length > 0 && (
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: debtDonut, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{pctPaidGlobal}%</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>FALTA POR PAGAR</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>{fmt(totalBalance, currency)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>ABONADO EN TOTAL</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--accent-text)' }}>{fmt(totalPaidAllTime, currency)}</div>
            </div>
          </div>
        </div>
      )}

      {section === 'deudas' && cards.length > 0 && totalPaidAllTime > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 12 }}>ABONADO POR MES</div>
          <div role="img" aria-label={monthlyPaidLabel} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}>
            {monthlyPaid.map((m) => (
              <div key={`${m.year}-${m.month}`} aria-hidden="true" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 700 }}>{m.total > 0 ? fmt(m.total, currency) : ''}</div>
                <div
                  style={{
                    width: '100%',
                    borderRadius: 6,
                    height: Math.max(4, Math.round((m.total / maxMonthlyPaid) * 60)),
                    background: m.total > 0 ? 'var(--accent)' : 'var(--divider)',
                    transition: 'height 0.4s ease',
                  }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'deudas' && cards.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 10 }}>
            MÉTODO PARA SALIR DE DEUDAS
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {METHODS.map((m) => {
              const active = debtMethod === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setDebtMethod(m.key)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 14,
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    background: active ? 'var(--text)' : 'var(--input-bg)',
                    color: active ? 'var(--page-bg)' : 'var(--text)',
                    border: 'none',
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            {METHODS.find((m) => m.key === debtMethod)?.hint}
          </div>

          <div style={{ height: 1, background: 'var(--divider)', margin: '14px 0' }} />

          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 700 }}>
            EXTRA MENSUAL PARA DEUDAS (además de los pagos mínimos)
          </div>
          <NumberInput value={data.user.extraDeudaMensual || ''} onChange={setExtraMensual} placeholder="Ej: 100.000" style={textInputStyle()} />

          <div style={{ marginTop: 12 }}>
            {payoffPlan.perCard.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--accent-text)', fontWeight: 700 }}>Ya no tienes deudas pendientes.</div>
            ) : payoffPlan.stuck ? (
              <div style={{ fontSize: 12, color: 'var(--accent-text)' }}>
                Con los pagos mínimos actuales no alcanzas a cubrir el interés. Aumenta el extra mensual o los pagos mínimos.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  Terminarías de pagar todo en{' '}
                  <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{formatMonthsLabel(payoffPlan.monthsToPayoff)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {payoffPlan.perCard.map((c) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                        {c.payoffMonth === null ? '—' : `mes ${c.payoffMonth}`}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {section === 'deudas' && sortedCards.map((c) => {
        const paidToDate = c.history.reduce((a, h) => a + h.amount, 0);
        const pct = paidToDate + c.balance > 0 ? Math.round((paidToDate / (paidToDate + c.balance)) * 100) : 0;
        const isOverdue = c.nextPayment < today && c.balance > 0;

        return (
          <SwipeActions
            key={c.id}
            actions={[
              { label: 'Editar', bg: 'var(--text)', color: 'var(--page-bg)', icon: <PencilIcon color="var(--page-bg)" accent="var(--page-bg)" />, onClick: () => openEditModal(c) },
              { label: 'Eliminar', bg: 'var(--danger)', icon: <span style={{ fontSize: 20, fontWeight: 700 }}>×</span>, onClick: () => askDelete(c.id) },
            ]}
          >
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{c.name}</div>
              {c.id === priorityId && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'white',
                    background: 'var(--accent)',
                    padding: '3px 8px',
                    borderRadius: 10,
                    letterSpacing: '0.03em',
                  }}
                >
                  PRIORIDAD
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, marginTop: 2 }}>
              {c.tipo || 'Tarjeta de crédito'}
              {c.interestRate > 0 && ` · ${c.interestRate}% E.A.`}
            </div>
            <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)', marginTop: 4 }}>{fmt(c.balance, currency)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Próximo pago: {formatShortDate(c.nextPayment)}
              {isOverdue && <span style={{ color: 'var(--danger-text)', fontWeight: 700 }}> · Vencido</span>}
            </div>
            <div style={{ height: 7, background: 'var(--divider)', borderRadius: 6, overflow: 'hidden', marginTop: 10 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 6, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              Abonado: {fmt(paidToDate, currency)} · {pct}%
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => openPayModal(c.id)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 20,
                  background: 'var(--text)',
                  color: 'var(--page-bg)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                Registrar pago
              </button>
              <button
                type="button"
                onClick={() => onViewDetail(c.id)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 20,
                  background: 'var(--input-bg)',
                  color: 'var(--text)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                Ver detalle
              </button>
            </div>

            {c.history.length > 0 && (
              <button
                type="button"
                onClick={() => setExpandedHistoryId(expandedHistoryId === c.id ? null : c.id)}
                style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer', marginTop: 10, display: 'block' }}
              >
                {expandedHistoryId === c.id ? 'Ocultar historial de pagos' : `Ver historial de pagos (${c.history.length})`}
              </button>
            )}

            {expandedHistoryId === c.id && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {[...c.history]
                  .map((h, i) => ({ ...h, i }))
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((h) => (
                    <div key={h.i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, background: 'var(--input-bg)', borderRadius: 10, padding: '8px 10px' }}>
                        <div style={{ color: 'var(--text-secondary)' }}>{formatShortDate(h.date)}{h.note ? ` · ${h.note}` : ''}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(h.amount, currency)}</div>
                          <button
                            type="button"
                            onClick={() => setDeleteHistoryTarget({ cardId: c.id, index: h.i })}
                            aria-label="Eliminar pago"
                            style={{ color: 'var(--danger-text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      {deleteHistoryTarget?.cardId === c.id && deleteHistoryTarget?.index === h.i && (
                        <InlineConfirm
                          message="¿Eliminar este pago? El monto vuelve al saldo pendiente."
                          onConfirm={() => deleteHistoryEntry(c.id, h.i)}
                          onCancel={() => setDeleteHistoryTarget(null)}
                        />
                      )}
                    </div>
                  ))}
              </div>
            )}

            {confirmDeleteId === c.id && (
              <InlineConfirm message="¿Eliminar esta deuda?" onConfirm={() => confirmDelete(c.id)} onCancel={cancelDelete} />
            )}
          </div>
          </SwipeActions>
        );
      })}

      {modalOpen && (
        <BottomSheet onClose={closeModal}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{editingCardId ? 'Editar deuda' : 'Nueva deuda'}</div>
          <select value={form.tipo} onChange={setField('tipo')} style={textInputStyle()}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t === 'Otro' ? 'Otro crédito' : t}
              </option>
            ))}
          </select>
          <input type="text" value={form.name} onChange={setField('name')} placeholder="Nombre (ej: Visa Roja, Préstamo banco X)" style={textInputStyle()} />
          <NumberInput value={form.balance} onChange={setField('balance')} placeholder="Saldo pendiente" style={textInputStyle()} />
          <input type="date" value={form.nextPayment} onChange={setField('nextPayment')} style={textInputStyle()} />
          <NumberInput value={form.minPayment} onChange={setField('minPayment')} placeholder="Pago mínimo (opcional)" style={textInputStyle()} />
          <input
            type="text"
            inputMode="decimal"
            value={form.interestRate}
            onChange={(e) => setForm((f) => ({ ...f, interestRate: sanitizeDecimal(e.target.value) }))}
            placeholder="Tasa de interés % E.A. (opcional)"
            style={textInputStyle()}
          />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 700 }}>
              ¿CUÁNDO LA ADQUIRISTE? (OPCIONAL — PARA SABER CUÁNTOS MESES LLEVAS)
            </div>
            <input type="date" value={form.startDate} onChange={setField('startDate')} style={textInputStyle()} />
          </div>
          <button type="button" onClick={saveCard} style={{ ...primaryButtonStyle(), height: 50, borderRadius: 25 }}>
            Guardar
          </button>
        </BottomSheet>
      )}

      {payModalOpen && (
        <BottomSheet onClose={closePayModal}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Registrar pago</div>
          <NumberInput
            value={payForm.amount}
            onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="Monto a pagar"
            style={textInputStyle()}
          />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 700 }}>FECHA DEL ABONO</div>
            <input
              type="date"
              value={payForm.date}
              max={today}
              onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))}
              style={textInputStyle()}
            />
          </div>
          <input
            type="text"
            value={payForm.note}
            onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Nota (opcional)"
            style={textInputStyle()}
          />
          <button
            type="button"
            onClick={confirmPay}
            style={{ height: 50, borderRadius: 25, background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: 'none' }}
          >
            Confirmar pago
          </button>
        </BottomSheet>
      )}

      {section === 'gastos' && (
        <>
          {expenses.length > 0 && (
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

          {expensesWithStatus.map((e) => {
            const daysLeft = daysUntilPayday(e.dueDay);
            const linkedCard = e.medioPago !== 'efectivo' ? cards.find((c) => c.id === e.medioPago) : null;
            const highlighted = e.isOverdue || e.id === nextDueId;
            const bg = e.isOverdue ? 'var(--danger)' : e.id === nextDueId ? 'var(--accent)' : 'var(--card-bg)';
            const fg = highlighted ? 'white' : 'var(--text)';
            const fgSoft = highlighted ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)';
            const chipBg = highlighted ? 'rgba(255,255,255,0.25)' : 'var(--input-bg)';

            return (
              <SwipeActions
                key={e.id}
                actions={[
                  { label: 'Editar', bg: 'var(--text)', color: 'var(--page-bg)', icon: <PencilIcon color="var(--page-bg)" accent="var(--page-bg)" />, onClick: () => openEditExpenseModal(e) },
                  { label: 'Eliminar', bg: 'var(--danger)', icon: <span style={{ fontSize: 20, fontWeight: 700 }}>×</span>, onClick: () => askDeleteExpense(e.id) },
                ]}
              >
              <div style={{ ...cardStyle, padding: 16, background: bg }}>
                {highlighted && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: fgSoft, letterSpacing: '0.06em', marginBottom: 2 }}>
                    {e.isOverdue ? 'VENCIDO' : 'PRÓXIMO A VENCER'}
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: 15, color: fg }}>{e.name}</div>
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
              </SwipeActions>
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
      )}

      {section === 'variables' && (
        <>
          {gastosVariables.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 12 }}>GASTADO POR MES</div>
              <div role="img" aria-label={variableMonthlyLabel} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}>
                {variableMonthly.map((m) => (
                  <div key={`${m.year}-${m.month}`} aria-hidden="true" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 700 }}>{m.total > 0 ? fmt(m.total, currency) : ''}</div>
                    <div
                      style={{
                        width: '100%',
                        borderRadius: 6,
                        height: Math.max(4, Math.round((m.total / maxVariableMonthly) * 60)),
                        background: m.total > 0 ? 'var(--accent)' : 'var(--divider)',
                        transition: 'height 0.4s ease',
                      }}
                    />
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={cardStyle}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>GASTADO ESTE MES</div>
            <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.02em' }}>{fmt(totalVariableMonth, currency)}</div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
                PRESUPUESTO POR CATEGORÍA (ESTE MES)
              </div>
              <button
                type="button"
                onClick={() => setCategoryPickerOpen(true)}
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}
              >
                Elegir categorías
              </button>
            </div>

            {trackedCategories.length === 0 ? (
              <button
                type="button"
                onClick={() => setCategoryPickerOpen(true)}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '10px 0', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}
              >
                Aún no elegiste categorías para seguir. Toca "Elegir categorías" para escoger las que quieras.
              </button>
            ) : (
              categoryTotals.map(({ categoria, total }) => {
                const budget = Number(data.user.presupuestoVariable?.[categoria]) || 0;
                const pct = budget > 0 ? Math.min(100, Math.round((total / budget) * 100)) : 0;
                const overBudget = budget > 0 && total > budget;
                const diff = budget - total;
                return (
                  <div key={categoria} style={{ padding: '12px 0', borderTop: '1px solid var(--divider)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{categoria}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: overBudget ? 'var(--danger-text)' : 'var(--text)' }}>{fmt(total, currency)}</div>
                        <button
                          type="button"
                          onClick={() => toggleTrackedCategory(categoria)}
                          aria-label={`Quitar ${categoria}`}
                          style={{ color: 'var(--danger-text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', lineHeight: 1, border: 'none', background: 'none', padding: 0 }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {budget > 0 && (
                      <div style={{ height: 5, background: 'var(--divider)', borderRadius: 6, overflow: 'hidden', marginTop: 8 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: overBudget ? 'var(--danger)' : 'var(--accent)', borderRadius: 6, transition: 'width 0.5s ease' }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Presupuesto:</div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={data.user.presupuestoVariable?.[categoria] ?? ''}
                          onChange={(e) => setPresupuestoCategoria(categoria, sanitizeMoneyDecimal(e.target.value))}
                          placeholder="0"
                          style={{ width: 84, padding: '5px 8px', borderRadius: 8, border: 'none', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 12, fontWeight: 700 }}
                        />
                      </div>
                      {budget > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: overBudget ? 'var(--danger-text)' : 'var(--text-secondary)' }}>
                          {overBudget ? `Excedido por ${fmt(-diff, currency)}` : `Quedan ${fmt(diff, currency)}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {categoryTotals.some((c) => c.total > 0) && (
            <div style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 10 }}>
                GASTO POR CATEGORÍA (ESTE MES)
              </div>
              {[...categoryTotals]
                .filter((c) => c.total > 0)
                .sort((a, b) => b.total - a.total)
                .map(({ categoria, total }) => {
                  const max = Math.max(...categoryTotals.map((c) => c.total), 1);
                  const pct = Math.round((total / max) * 100);
                  return (
                    <div key={categoria} style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{categoria}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(total, currency)}</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--divider)', borderRadius: 6, overflow: 'hidden', marginTop: 4 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 6, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          <div style={cardStyle}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 4 }}>ESTE MES</div>
            {thisMonthVariables.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8 }}>Sin gastos variables registrados este mes.</div>
            ) : (
              thisMonthVariables.map((g) => (
                <SwipeActions
                  key={g.id}
                  borderRadius={0}
                  background="var(--card-bg)"
                  actions={[
                    { label: 'Editar', bg: 'var(--text)', color: 'var(--page-bg)', icon: <PencilIcon color="var(--page-bg)" accent="var(--page-bg)" />, onClick: () => openEditVariableModal(g) },
                    { label: 'Eliminar', bg: 'var(--danger)', icon: <span style={{ fontSize: 20, fontWeight: 700 }}>×</span>, onClick: () => askDeleteVariable(g.id) },
                  ]}
                >
                  <div style={{ padding: '11px 0', borderTop: '1px solid var(--divider)', background: 'var(--card-bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{g.name || g.categoria}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {g.categoria} · {formatShortDate(g.date)}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', flexShrink: 0 }}>{fmt(g.amount, currency)}</div>
                    </div>
                    {confirmDeleteVariableId === g.id && (
                      <InlineConfirm message="¿Eliminar este gasto?" onConfirm={() => confirmDeleteVariable(g.id)} onCancel={cancelDeleteVariable} />
                    )}
                  </div>
                </SwipeActions>
              ))
            )}
          </div>

          {variableModalOpen && (
            <BottomSheet onClose={closeVariableModal}>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{editingVariableId ? 'Editar gasto' : 'Nuevo gasto variable'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {allAvailableCategories.map((c) => {
                  const active = variableForm.categoria === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setVariableForm((f) => ({ ...f, categoria: c }))}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '4px 2px', border: 'none', background: 'none', cursor: 'pointer' }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: active ? 'var(--text)' : 'var(--input-bg)',
                          color: active ? 'var(--page-bg)' : 'var(--text)',
                        }}
                      >
                        <CategoryIcon categoria={c} />
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', textAlign: 'center', lineHeight: 1.2 }}>{c}</div>
                    </button>
                  );
                })}
              </div>
              <input type="text" value={variableForm.name} onChange={setVariableField('name')} placeholder="Nombre (opcional, ej: Carne, Cine)" style={textInputStyle()} />
              <input
                type="text"
                inputMode="decimal"
                value={variableForm.amount}
                onChange={(e) => setVariableForm((f) => ({ ...f, amount: sanitizeMoneyDecimal(e.target.value) }))}
                placeholder="Monto"
                style={textInputStyle()}
              />
              <input type="date" value={variableForm.date} max={today} onChange={setVariableField('date')} style={textInputStyle()} />
              <button type="button" onClick={saveVariable} style={{ ...primaryButtonStyle(), height: 50, borderRadius: 25 }}>
                Guardar
              </button>
            </BottomSheet>
          )}

          {categoryPickerOpen && (
            <BottomSheet onClose={() => setCategoryPickerOpen(false)}>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Elegir categorías</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -8 }}>
                Toca las que quieras seguir. Puedes agregar una propia abajo.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[...new Set([...VARIABLE_CATEGORIES, ...trackedCategories])].map((c) => {
                  const active = trackedCategories.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleTrackedCategory(c)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '4px 2px', border: 'none', background: 'none', cursor: 'pointer' }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: active ? 'var(--text)' : 'var(--input-bg)',
                          color: active ? 'var(--page-bg)' : 'var(--text)',
                        }}
                      >
                        <CategoryIcon categoria={c} />
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', textAlign: 'center', lineHeight: 1.2 }}>{c}</div>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={customCategoryText}
                  onChange={(e) => setCustomCategoryText(e.target.value)}
                  placeholder="Otra categoría (ej: Streaming)"
                  style={{ ...textInputStyle(), flex: 1 }}
                />
                <button
                  type="button"
                  onClick={addCustomCategory}
                  disabled={!customCategoryText.trim()}
                  style={{
                    padding: '0 16px',
                    borderRadius: 14,
                    background: 'var(--input-bg)',
                    color: 'var(--text)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: customCategoryText.trim() ? 'pointer' : 'default',
                    opacity: customCategoryText.trim() ? 1 : 0.5,
                    border: 'none',
                  }}
                >
                  Agregar
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCategoryPickerOpen(false)}
                style={{ ...primaryButtonStyle(), height: 50, borderRadius: 25 }}
              >
                Listo
              </button>
            </BottomSheet>
          )}
        </>
      )}
    </div>
  );
}
