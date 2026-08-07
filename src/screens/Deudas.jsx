import { useState } from 'react';
import { fmt } from '../lib/format';
import { formatShortDate, todayISO } from '../lib/dates';
import { uid } from '../lib/id';
import { cardStyle, textInputStyle, primaryButtonStyle, stickyHeaderStyle } from '../lib/styles';
import BottomSheet from '../components/BottomSheet';
import InlineConfirm from '../components/InlineConfirm';
import NumberInput from '../components/NumberInput';
import PencilIcon from '../components/PencilIcon';

const TIPOS = ['Tarjeta de crédito', 'Préstamo', 'Otro'];

function emptyForm() {
  return { tipo: 'Tarjeta de crédito', name: '', balance: '', nextPayment: '', minPayment: '' };
}

export default function Deudas({ data, setData }) {
  const { cards } = data;
  const { currency } = data.user;
  const today = todayISO();

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
    setForm({ tipo: c.tipo || 'Tarjeta de crédito', name: c.name, balance: String(c.balance), nextPayment: c.nextPayment, minPayment: String(c.minPayment) });
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
              ? { ...c, name: form.name, balance: Number(form.balance), nextPayment: form.nextPayment || c.nextPayment, minPayment: Number(form.minPayment) || 0, tipo: form.tipo }
              : c,
          ),
        };
      }
      return {
        ...s,
        cards: [
          ...s.cards,
          { id: uid(), name: form.name, balance: Number(form.balance), nextPayment: form.nextPayment || today, minPayment: Number(form.minPayment) || 0, tipo: form.tipo, history: [] },
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...stickyHeaderStyle, fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>Deudas</div>

      {cards.map((c) => {
        const paidToDate = c.history.reduce((a, h) => a + h.amount, 0);
        const pct = paidToDate + c.balance > 0 ? Math.round((paidToDate / (paidToDate + c.balance)) * 100) : 0;
        const isOverdue = c.nextPayment < today && c.balance > 0;

        return (
          <div key={c.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{c.name}</div>
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
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, marginTop: 2 }}>{c.tipo || 'Tarjeta de crédito'}</div>
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
