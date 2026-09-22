import { useImperativeHandle, useState } from 'react';
import { fmt } from '../../lib/format';
import { formatShortDate, todayISO, advanceDueDate } from '../../lib/dates';
import { uid } from '../../lib/id';
import { cardStyle, textInputStyle, primaryButtonStyle } from '../../lib/styles';
import BottomSheet from '../../components/BottomSheet';
import InlineConfirm from '../../components/InlineConfirm';
import NumberInput from '../../components/NumberInput';
import DateField from '../../components/DateField';
import CardMenu from '../../components/CardMenu';
import ProgressRing from '../../components/ProgressRing';
import { sortDebtsByPriority, debtPriorityRank, simulatePayoffPlan, formatMonthsLabel, monthlyPaidTotals, METHODS } from '../../lib/debt';

const TIPOS = ['Tarjeta de crédito', 'Préstamo', 'Otro'];

// Keeps digits and at most one decimal point (up to 2 decimal places) — interest rates
// like "2.5% E.A." need the point; plain digit-stripping was silently eating it.
function sanitizeDecimal(raw) {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  if (rest.length === 0) return whole.slice(0, 3);
  return `${whole.slice(0, 3)}.${rest.join('').slice(0, 2)}`;
}

function emptyForm() {
  return { tipo: 'Tarjeta de crédito', name: '', balance: '', originalAmount: '', nextPayment: '', minPayment: '', interestRate: '', startDate: '' };
}

// "Deudas" tab — tarjetas/préstamos, el simulador de pago y el historial de abonos.
export default function CardsTab({ data, setData, onViewDetail, onEditIncome, addRef }) {
  const { cards } = data;
  const { currency } = data.user;
  const debtMethod = data.user.debtMethod || 'bola_nieve';
  const today = todayISO();

  // "Eliminar" archives a card that has payment history instead of removing it
  // outright (see confirmDelete below) — otherwise past months' totals
  // (monthlyPaidTotals, monthlyRecap, the "mes pasado" views in the other tabs)
  // would shrink retroactively every time someone pays off a debt and deletes it.
  const activeCards = cards.filter((c) => !c.archived);

  const setDebtMethod = (key) => setData((s) => ({ ...s, user: { ...s.user, debtMethod: key } }));
  const extraMensual = Number(data.user.extraDeudaMensual) || 0;
  const setExtraMensual = (e) => setData((s) => ({ ...s, user: { ...s.user, extraDeudaMensual: Number(e.target.value) || 0 } }));

  const sortedCards = sortDebtsByPriority(activeCards, debtMethod);
  const payoffPlan = simulatePayoffPlan(activeCards, debtMethod, extraMensual);
  // Same plan with no extra, to say what the extra actually changes — only worth
  // computing separately when an extra is set (otherwise it's the plan above).
  const minimumsOnlyPlan = extraMensual > 0 ? simulatePayoffPlan(activeCards, debtMethod, 0) : payoffPlan;
  // What goes toward debt every month while any is open: every minimum plus the extra.
  // With the snowball rollover this total stays constant until the very last debt clears.
  const monthlyDebtBudget = activeCards.filter((c) => c.balance > 0).reduce((a, c) => a + (c.minPayment || 0), 0) + extraMensual;
  const monthsSavedByExtra =
    extraMensual > 0 && !payoffPlan.stuck && !minimumsOnlyPlan.stuck ? minimumsOnlyPlan.monthsToPayoff - payoffPlan.monthsToPayoff : 0;

  const totalBalance = activeCards.reduce((a, c) => a + c.balance, 0);
  const totalPaidAllTime = activeCards.reduce((a, c) => a + c.history.reduce((h, x) => h + x.amount, 0), 0);
  const pctPaidGlobal = totalPaidAllTime + totalBalance > 0 ? Math.round((totalPaidAllTime / (totalPaidAllTime + totalBalance)) * 100) : 0;
  // Full `cards` (not activeCards) — an archived debt's past abonos should still show
  // up in the month they actually happened, same reasoning as the comment above.
  const monthlyPaid = monthlyPaidTotals(cards, 6);
  const maxMonthlyPaid = Math.max(1, ...monthlyPaid.map((m) => m.total));
  const monthlyPaidLabel = `Abonado por mes: ${monthlyPaid.map((m) => `${m.label} ${fmt(m.total, currency)}`).join(', ')}`;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingCardId, setPayingCardId] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', note: '' });
  const [editingHistoryTarget, setEditingHistoryTarget] = useState(null);

  const openNewModal = () => {
    setEditingCardId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };
  useImperativeHandle(addRef, () => ({ openNew: openNewModal }));

  const openEditModal = (c) => {
    setEditingCardId(c.id);
    setForm({
      tipo: c.tipo || 'Tarjeta de crédito',
      name: c.name,
      balance: String(c.balance),
      originalAmount: c.originalAmount ? String(c.originalAmount) : '',
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
                  originalAmount: Number(form.originalAmount) || 0,
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
            originalAmount: Number(form.originalAmount) || 0,
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
  // Archives instead of removing once there's payment history to lose — same
  // reasoning as confirmDeleteExpense in GastosFijosTab, so paying off (or writing
  // off) a debt and deleting it doesn't erase its abonos from monthlyPaidTotals/monthlyRecap.
  const confirmDelete = (id) => {
    setData((s) => ({
      ...s,
      cards: s.cards
        .map((c) => (c.id === id && c.history.length > 0 ? { ...c, archived: true } : c))
        .filter((c) => c.id !== id || c.archived),
      // Fall back linked expenses to efectivo so they don't keep pointing at a card
      // that no longer exists (they'd silently stop showing its name/tasa otherwise).
      expenses: s.expenses.map((e) => (e.medioPago === id ? { ...e, medioPago: 'efectivo' } : e)),
    }));
    setConfirmDeleteId(null);
  };

  const openPayModal = (id) => {
    setPayingCardId(id);
    setEditingHistoryTarget(null);
    setPayForm({ amount: '', note: '', date: today });
    setPayModalOpen(true);
  };
  const openEditHistoryModal = (cardId, index) => {
    const entry = cards.find((c) => c.id === cardId)?.history[index];
    if (!entry) return;
    setPayingCardId(cardId);
    setEditingHistoryTarget({ cardId, index });
    setPayForm({ amount: String(entry.amount), note: entry.note || '', date: entry.date });
    setPayModalOpen(true);
  };
  const closePayModal = () => {
    setPayModalOpen(false);
    setEditingHistoryTarget(null);
  };
  const confirmPay = () => {
    const amount = Number(payForm.amount) || 0;
    if (amount <= 0) return;
    setData((s) => ({
      ...s,
      cards: s.cards.map((c) => {
        if (c.id !== payingCardId) return c;
        if (editingHistoryTarget && editingHistoryTarget.cardId === payingCardId) {
          const { index } = editingHistoryTarget;
          const oldAmount = c.history[index].amount;
          const history = c.history.map((h, i) => (i === index ? { date: payForm.date || today, amount, note: payForm.note } : h));
          return { ...c, balance: Math.max(0, c.balance + oldAmount - amount), history };
        }
        const paidOn = payForm.date || today;
        return {
          ...c,
          balance: Math.max(0, c.balance - amount),
          nextPayment: advanceDueDate(c.nextPayment, paidOn),
          history: [...c.history, { date: paidOn, amount, note: payForm.note }],
        };
      }),
    }));
    setPayModalOpen(false);
    setEditingHistoryTarget(null);
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

  return (
    <>
      {activeCards.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Aún no tienes deudas registradas</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            Agrega una tarjeta o préstamo para hacerle seguimiento a cuánto debes y cuánto ya pagaste.
          </div>
          <button
            type="button"
            onClick={openNewModal}
            style={{ ...primaryButtonStyle(), marginTop: 14, padding: '10px 20px', borderRadius: 20, display: 'inline-block', width: 'auto' }}
          >
            + Nueva deuda
          </button>
        </div>
      )}

      {activeCards.length > 0 && (
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 20 }}>
          <ProgressRing pct={pctPaidGlobal} size={88}>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{pctPaidGlobal}%</div>
          </ProgressRing>
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

      {activeCards.length > 0 && totalPaidAllTime > 0 && (
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

      {activeCards.length > 0 && (
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
                {payoffPlan.stuckInfo?.worstCards.length > 0 ? (
                  <>
                    El interés mensual de {payoffPlan.stuckInfo.worstCards.join(', ')} ({fmt(payoffPlan.stuckInfo.totalMonthlyInterest, currency)}) supera {extraMensual > 0 ? 'tus pagos mínimos + extra' : 'tus pagos mínimos'} ({fmt(payoffPlan.stuckInfo.totalMinPayments + extraMensual, currency)}). Te faltan {fmt(payoffPlan.stuckInfo.gap, currency)} más al mes para empezar a bajar el saldo.
                  </>
                ) : (
                  'Con los pagos mínimos actuales no alcanzas a cubrir el interés. Aumenta el extra mensual o los pagos mínimos.'
                )}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  {extraMensual > 0 ? `Pagando los mínimos + ${fmt(extraMensual, currency)} extra al mes, terminarías de pagar todo en` : 'Pagando solo los mínimos, terminarías de pagar todo en'}{' '}
                  <span style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{formatMonthsLabel(payoffPlan.monthsToPayoff)}</span>
                </div>
                {extraMensual === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Escribe un extra mensual arriba para ver cuánto se acorta.
                  </div>
                )}
                {extraMensual > 0 && minimumsOnlyPlan.stuck && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Solo con los mínimos no terminarías nunca de pagar: el extra es lo que lo hace posible.
                  </div>
                )}
                {monthsSavedByExtra > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Solo con los mínimos serían {formatMonthsLabel(minimumsOnlyPlan.monthsToPayoff)}. Con el extra terminas{' '}
                    {monthsSavedByExtra} {monthsSavedByExtra === 1 ? 'mes' : 'meses'} antes.
                  </div>
                )}
                {monthlyDebtBudget > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--accent-text)', marginTop: 4 }}>
                    Cada vez que termines una deuda, su cuota pasa a la siguiente, así que pagas {fmt(monthlyDebtBudget, currency)} al mes en total hasta el final. Cuando termines (mes {payoffPlan.monthsToPayoff}), ese dinero queda libre para tus metas o ahorro.
                  </div>
                )}
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

      {sortedCards.map((c) => {
        const paidToDate = c.history.reduce((a, h) => a + h.amount, 0);
        const pct = paidToDate + c.balance > 0 ? Math.round((paidToDate / (paidToDate + c.balance)) * 100) : 0;
        const isOverdue = c.nextPayment < today && c.balance > 0;
        const numAbonos = c.history.length;
        const { rank, total: totalOpen } = debtPriorityRank(activeCards, debtMethod, c.id);

        return (
          <CardMenu
            key={c.id}
            actions={[
              { label: 'Editar', onClick: () => openEditModal(c) },
              { label: 'Eliminar', destructive: true, onClick: () => askDelete(c.id) },
            ]}
          >
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingRight: 34 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{c.name}</div>
              {rank !== null && totalOpen > 1 && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: rank === 1 ? 'white' : 'var(--text-secondary)',
                    background: rank === 1 ? 'var(--accent)' : 'var(--input-bg)',
                    padding: '3px 8px',
                    borderRadius: 10,
                    letterSpacing: '0.03em',
                  }}
                >
                  {rank === 1 ? 'PRIORIDAD' : `#${rank} DE ${totalOpen}`}
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
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Cuota: {c.minPayment > 0 ? fmt(c.minPayment, currency) : 'No configurada'}
              {c.interesMensual > 0 && ` · Interés: ${fmt(c.interesMensual, currency)}/mes`}
            </div>
            <div style={{ height: 7, background: 'var(--divider)', borderRadius: 6, overflow: 'hidden', marginTop: 10 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 6, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              Abonado: {fmt(paidToDate, currency)} · {pct}%{numAbonos > 0 && ` · ${numAbonos} ${numAbonos === 1 ? 'abono' : 'abonos'}`}
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
                  .map((h) => {
                    const linkedIncome = h.incomeId ? data.incomes.find((inc) => inc.id === h.incomeId) : null;
                    return (
                      <div key={h.i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, background: 'var(--input-bg)', borderRadius: 10, padding: '8px 10px' }}>
                          <div style={{ color: 'var(--text-secondary)' }}>
                            {formatShortDate(h.date)}
                            {h.note ? ` · ${h.note}` : ''}
                            {h.incomeId ? ' · Desde un ingreso' : ''}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(h.amount, currency)}</div>
                            {linkedIncome ? (
                              <button
                                type="button"
                                onClick={() => onEditIncome(linkedIncome)}
                                style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer', border: 'none', background: 'none', padding: 0, flexShrink: 0 }}
                              >
                                Editar ingreso
                              </button>
                            ) : (
                              <CardMenu
                                inline
                                triggerBg="transparent"
                                actions={[
                                  { label: 'Editar', onClick: () => openEditHistoryModal(c.id, h.i) },
                                  { label: 'Eliminar', destructive: true, onClick: () => setDeleteHistoryTarget({ cardId: c.id, index: h.i }) },
                                ]}
                              />
                            )}
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
                    );
                  })}
              </div>
            )}

            {confirmDeleteId === c.id && (
              <InlineConfirm message="¿Eliminar esta deuda?" onConfirm={() => confirmDelete(c.id)} onCancel={cancelDelete} />
            )}
          </div>
          </CardMenu>
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
          <NumberInput value={form.originalAmount} onChange={setField('originalAmount')} placeholder="Monto total original (opcional)" style={textInputStyle()} />
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -6 }}>
            Cuánto pediste prestado en un inicio. Es solo de referencia, no afecta ningún cálculo — déjalo vacío si no lo recuerdas.
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 700 }}>PRÓXIMO PAGO</div>
            <DateField value={form.nextPayment} onChange={setField('nextPayment')} style={textInputStyle()} />
          </div>
          <NumberInput value={form.minPayment} onChange={setField('minPayment')} placeholder="Pago mínimo (opcional)" style={textInputStyle()} />
          <input
            type="text"
            inputMode="decimal"
            value={form.interestRate}
            onChange={(e) => setForm((f) => ({ ...f, interestRate: sanitizeDecimal(e.target.value) }))}
            placeholder="Tasa de interés % E.A. (opcional)"
            style={textInputStyle()}
          />
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -6 }}>
            E.A. = Efectivo Anual, la tasa de interés por un año completo. Aparece en tu extracto o contrato. Déjalo vacío si no la conoces.
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 700 }}>
              ¿CUÁNDO LA ADQUIRISTE? (OPCIONAL: PARA SABER CUÁNTOS MESES LLEVAS)
            </div>
            <DateField value={form.startDate} onChange={setField('startDate')} style={textInputStyle()} />
          </div>
          <button type="button" onClick={saveCard} style={{ ...primaryButtonStyle(), height: 50, borderRadius: 25 }}>
            Guardar
          </button>
        </BottomSheet>
      )}

      {payModalOpen && (
        <BottomSheet onClose={closePayModal}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{editingHistoryTarget ? 'Editar abono' : 'Registrar pago'}</div>
          <NumberInput
            value={payForm.amount}
            onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="Monto a pagar"
            style={textInputStyle()}
          />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 700 }}>FECHA DEL ABONO</div>
            <DateField
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
            {editingHistoryTarget ? 'Guardar cambios' : 'Confirmar pago'}
          </button>
        </BottomSheet>
      )}
    </>
  );
}
