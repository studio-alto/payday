import { useState } from 'react';
import { fmt } from '../lib/format';
import { formatShortDate, todayISO } from '../lib/dates';
import { uid } from '../lib/id';
import { cardStyle, textInputStyle, primaryButtonStyle } from '../lib/styles';
import BottomSheet from '../components/BottomSheet';
import InlineConfirm from '../components/InlineConfirm';
import NumberInput from '../components/NumberInput';
import PencilIcon from '../components/PencilIcon';
import FixedHeader from '../components/FixedHeader';

const TIPOS = ['Tarjeta de crédito', 'Préstamo', 'Otro'];
const METHODS = [
  { key: 'bola_nieve', label: 'Bola de nieve', hint: 'Prioriza el saldo más pequeño primero' },
  { key: 'avalancha', label: 'Avalancha', hint: 'Prioriza la tasa de interés más alta primero' },
];

function emptyForm() {
  return { tipo: 'Tarjeta de crédito', name: '', balance: '', nextPayment: '', minPayment: '', interestRate: '' };
}

export default function Deudas({ data, setData }) {
  const { cards } = data;
  const { currency } = data.user;
  const debtMethod = data.user.debtMethod || 'bola_nieve';
  const today = todayISO();

  const setDebtMethod = (key) => setData((s) => ({ ...s, user: { ...s.user, debtMethod: key } }));

  const sortedCards = [...cards].sort((a, b) => {
    if (debtMethod === 'avalancha') return (b.interestRate || 0) - (a.interestRate || 0);
    return a.balance - b.balance;
  });
  const priorityId = sortedCards.find((c) => c.balance > 0)?.id;

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
    setData((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) }));
    setConfirmDeleteId(null);
  };

  const openPayModal = (id) => {
    setPayingCardId(id);
    setPayForm({ amount: '', note: '' });
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
          ? { ...c, balance: Math.max(0, c.balance - amount), history: [...c.history, { date: today, amount, note: payForm.note }] }
          : c,
      ),
    }));
    setPayModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 88px)' }}>
      <FixedHeader>
        <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>Deudas</div>
      </FixedHeader>

      {cards.length > 0 && (
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
        </div>
      )}

      {sortedCards.map((c) => {
        const paidToDate = c.history.reduce((a, h) => a + h.amount, 0);
        const pct = paidToDate + c.balance > 0 ? Math.round((paidToDate / (paidToDate + c.balance)) * 100) : 0;
        const isOverdue = c.nextPayment < today && c.balance > 0;

        return (
          <div key={c.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => openEditModal(c)}
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
                  onClick={() => askDelete(c.id)}
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
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, marginTop: 2 }}>
              {c.tipo || 'Tarjeta de crédito'}
              {c.interestRate > 0 && ` · ${c.interestRate}% E.A.`}
            </div>
            <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)', marginTop: 4 }}>{fmt(c.balance, currency)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Próximo pago: {formatShortDate(c.nextPayment)}
              {isOverdue && <span style={{ color: 'var(--accent)', fontWeight: 700 }}> · Vencido</span>}
            </div>
            <div style={{ height: 7, background: 'var(--divider)', borderRadius: 6, overflow: 'hidden', marginTop: 10 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 6, transition: 'width 0.5s ease' }} />
            </div>
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
                display: 'inline-block',
                marginTop: 10,
              }}
            >
              Registrar pago
            </button>

            {confirmDeleteId === c.id && (
              <InlineConfirm message="¿Eliminar esta deuda?" onConfirm={() => confirmDelete(c.id)} onCancel={cancelDelete} />
            )}
          </div>
        );
      })}

      <button type="button" onClick={openNewModal} style={primaryButtonStyle()}>
        + Nueva deuda
      </button>

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
            inputMode="numeric"
            value={form.interestRate}
            onChange={(e) => setForm((f) => ({ ...f, interestRate: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
            placeholder="Tasa de interés % E.A. (opcional)"
            style={textInputStyle()}
          />
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
    </div>
  );
}
