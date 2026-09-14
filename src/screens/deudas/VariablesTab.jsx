import { useImperativeHandle, useState } from 'react';
import { fmt } from '../../lib/format';
import { formatShortDate, todayISO } from '../../lib/dates';
import { uid } from '../../lib/id';
import { cardStyle, textInputStyle, primaryButtonStyle } from '../../lib/styles';
import BottomSheet from '../../components/BottomSheet';
import InlineConfirm from '../../components/InlineConfirm';
import MoneyInput from '../../components/MoneyInput';
import DateField from '../../components/DateField';
import CardMenu from '../../components/CardMenu';
import CategoryIcon from '../../components/CategoryIcon';
import { VARIABLE_CATEGORIES, monthlyCategoryTotals, monthlyVariableTotals } from '../../lib/variableExpenses';
import { CHART_COLORS as CATEGORY_CHART_COLORS } from '../../lib/colors';
import MonthSwitcher from './MonthSwitcher';

// Qualitative palette for the category donut — cycles if there are more tracked
// categories than colors. Distinct enough from each other and from --divider/--card-bg
// in both themes since these are chart fills, not text.
// Ring geometry for the category donut — separated, rounded-cap arcs (not a solid
// touching pie) per the reference design. viewBox is 0-100 so RADIUS/STROKE are in
// those units; the svg itself is rotated -90deg so arcs start at 12 o'clock.
const DONUT_RADIUS = 40;
const DONUT_STROKE = 14;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function categoryDonutArcs(slices) {
  const gapLen = slices.length > 1 ? (6 / 360) * DONUT_CIRCUMFERENCE : 0;
  let cumulative = 0;
  return slices.map((s, i) => {
    const segLen = (s.pct / 100) * DONUT_CIRCUMFERENCE;
    const visibleLen = Math.max(segLen - gapLen, 0);
    const offset = -cumulative;
    cumulative += segLen;
    return { ...s, visibleLen, offset, color: CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length] };
  });
}

function emptyVariableForm(today, defaultCategoria) {
  return { name: '', categoria: defaultCategoria, amount: '', date: today };
}

// "Variables" tab — gastos sueltos categorizados, presupuesto por categoría y su
// dona de distribución, todo para el mes que `monthNav` esté mostrando.
export default function VariablesTab({ data, setData, monthNav, addRef }) {
  const gastosVariables = data.gastosVariables || [];
  const { currency } = data.user;
  const today = todayISO();

  // Which categories actually show up as budget rows — chosen by the person (see
  // "Elegir categorías" below), not every preset at once. Logging a gasto still
  // offers the full preset list plus any custom category, even before it's tracked.
  const trackedCategories = data.user.gastoVariableCategorias || [];
  const allAvailableCategories = [...new Set([...VARIABLE_CATEGORIES, ...trackedCategories])];

  // Budget-vs-actual per category, for whichever month `monthNav` is currently
  // showing (defaults to the current one, but the person can page back).
  const categoryTotals = monthlyCategoryTotals(gastosVariables, trackedCategories, monthNav.year, monthNav.month);
  const thisMonthVariables = [...gastosVariables].filter((g) => monthNav.inMonth(g.date)).sort((a, b) => b.date.localeCompare(a.date));
  // Sums every gasto in the viewed month, tracked category or not — the itemized list
  // below shows all of them too, so this total shouldn't silently exclude an untracked one.
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
  useImperativeHandle(addRef, () => ({ openNew: openNewVariableModal }));

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
    <>
      {gastosVariables.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Aún no tienes gastos variables</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            Registra tus compras del día a día (mercado, transporte, salidas) para ver en qué se te va la plata.
          </div>
          <button
            type="button"
            onClick={openNewVariableModal}
            style={{ ...primaryButtonStyle(), marginTop: 14, padding: '10px 20px', borderRadius: 20, display: 'inline-block', width: 'auto' }}
          >
            + Nuevo gasto variable
          </button>
        </div>
      )}

      {gastosVariables.length > 0 && (
        <>
          <MonthSwitcher label={monthNav.label} isCurrentMonth={monthNav.isCurrent} onPrev={monthNav.goPrev} onNext={monthNav.goNext} />

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

          <div style={cardStyle}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>GASTADO {monthNav.label.toUpperCase()}</div>
            <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.02em' }}>{fmt(totalVariableMonth, currency)}</div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
                PRESUPUESTO POR CATEGORÍA ({monthNav.label.toUpperCase()})
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
                        <MoneyInput
                          value={data.user.presupuestoVariable?.[categoria] ?? ''}
                          onChange={(e) => setPresupuestoCategoria(categoria, e.target.value)}
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

          {categoryTotals.some((c) => c.total > 0) && (() => {
            const spent = [...categoryTotals].filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
            const totalSpent = spent.reduce((a, c) => a + c.total, 0);
            const slices = spent.map((c) => ({ ...c, pct: totalSpent > 0 ? (c.total / totalSpent) * 100 : 0 }));
            const arcs = categoryDonutArcs(slices);
            return (
              <div style={cardStyle}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 14 }}>
                  GASTO POR CATEGORÍA ({monthNav.label.toUpperCase()})
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', width: 140, height: 140 }}>
                    <svg width={140} height={140} viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                      {arcs.map((a) => (
                        <circle
                          key={a.categoria}
                          cx={50}
                          cy={50}
                          r={DONUT_RADIUS}
                          fill="none"
                          stroke={a.color}
                          strokeWidth={DONUT_STROKE}
                          strokeLinecap="round"
                          strokeDasharray={`${a.visibleLen} ${DONUT_CIRCUMFERENCE - a.visibleLen}`}
                          strokeDashoffset={a.offset}
                        />
                      ))}
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>TOTAL</div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.02em' }}>{fmt(totalSpent, currency)}</div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {slices.map(({ categoria, total, pct }, i) => (
                    <div key={categoria} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{categoria}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{Math.round(pct)}%</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{fmt(total, currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div style={cardStyle}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 4 }}>{monthNav.label.toUpperCase()}</div>
            {thisMonthVariables.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8 }}>
                Sin gastos variables registrados {monthNav.isCurrent ? 'este mes' : `en ${monthNav.label.toLowerCase()}`}.
              </div>
            ) : (
              thisMonthVariables.map((g) => (
                <div key={g.id} style={{ padding: '11px 0', borderTop: '1px solid var(--divider)', background: 'var(--card-bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{g.name || g.categoria}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {g.categoria} · {formatShortDate(g.date)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{fmt(g.amount, currency)}</div>
                      <CardMenu
                        inline
                        actions={[
                          { label: 'Editar', onClick: () => openEditVariableModal(g) },
                          { label: 'Eliminar', destructive: true, onClick: () => askDeleteVariable(g.id) },
                        ]}
                      />
                    </div>
                  </div>
                  {confirmDeleteVariableId === g.id && (
                    <InlineConfirm message="¿Eliminar este gasto?" onConfirm={() => confirmDeleteVariable(g.id)} onCancel={cancelDeleteVariable} />
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

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
          <MoneyInput
            value={variableForm.amount}
            onChange={(e) => setVariableForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="Monto"
            style={textInputStyle()}
          />
          <DateField value={variableForm.date} max={today} onChange={setVariableField('date')} style={textInputStyle()} />
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
  );
}
