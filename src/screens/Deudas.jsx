import { useRef, useState } from 'react';
import { todayISO } from '../lib/dates';
import { monthLabel } from '../lib/monthlyRecap';
import FixedHeader from '../components/FixedHeader';
import PlusIcon from '../components/PlusIcon';
import CardsTab from './deudas/CardsTab';
import GastosFijosTab from './deudas/GastosFijosTab';
import VariablesTab from './deudas/VariablesTab';
import TodosTab from './deudas/TodosTab';

const SECTIONS = [
  { key: 'deudas', label: 'Deudas' },
  { key: 'gastos', label: 'Gastos fijos' },
  { key: 'variables', label: 'Variables' },
  { key: 'todos', label: 'Todos' },
];

const ADD_LABELS = { deudas: 'Nueva deuda', gastos: 'Nuevo gasto', variables: 'Nuevo gasto variable' };

// "Gastos" screen — four tabs (Deudas, Gastos fijos, Variables, Todos), each in its
// own file under screens/deudas/. This container just owns the tab switch, the
// shared "mes visto" navigation (Gastos fijos/Variables/Todos all page through the
// same month), and routes the shared "+" button to whichever tab is active.
export default function Deudas({ data, setData, onViewDetail, onEditIncome }) {
  const [section, setSection] = useState('deudas');

  const todayDate = new Date(todayISO() + 'T00:00:00');
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth();

  // Capped at the current month going forward since there's nothing to show past "now".
  const [viewMonth, setViewMonth] = useState({ year: currentYear, month: currentMonth });
  const isCurrentViewMonth = viewMonth.year === currentYear && viewMonth.month === currentMonth;
  const goPrevViewMonth = () => setViewMonth((s) => (s.month === 0 ? { year: s.year - 1, month: 11 } : { year: s.year, month: s.month - 1 }));
  const goNextViewMonth = () => setViewMonth((s) => (s.month === 11 ? { year: s.year + 1, month: 0 } : { year: s.year, month: s.month + 1 }));
  const inViewMonth = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getFullYear() === viewMonth.year && d.getMonth() === viewMonth.month;
  };
  const monthNav = {
    year: viewMonth.year,
    month: viewMonth.month,
    label: isCurrentViewMonth ? 'Este mes' : monthLabel(viewMonth.year, viewMonth.month),
    isCurrent: isCurrentViewMonth,
    goPrev: goPrevViewMonth,
    goNext: goNextViewMonth,
    inMonth: inViewMonth,
  };

  // Each tab exposes an imperative `openNew()` (via these refs) so the one shared
  // "+" button in the header can open the right modal for whichever tab is active —
  // "Todos" has no button since it's read-only.
  const cardsAddRef = useRef(null);
  const gastosAddRef = useRef(null);
  const variablesAddRef = useRef(null);
  const handleAddClick = () => {
    if (section === 'deudas') cardsAddRef.current?.openNew();
    else if (section === 'gastos') gastosAddRef.current?.openNew();
    else if (section === 'variables') variablesAddRef.current?.openNew();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 88px)' }}>
      <FixedHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>Gastos</div>
            {section !== 'todos' && (
              <button
                type="button"
                onClick={handleAddClick}
                aria-label={ADD_LABELS[section]}
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
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {SECTIONS.map((s) => {
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

      {section === 'deudas' && (
        <CardsTab data={data} setData={setData} onViewDetail={onViewDetail} onEditIncome={onEditIncome} addRef={cardsAddRef} />
      )}
      {section === 'gastos' && <GastosFijosTab data={data} setData={setData} monthNav={monthNav} addRef={gastosAddRef} />}
      {section === 'variables' && <VariablesTab data={data} setData={setData} monthNav={monthNav} addRef={variablesAddRef} />}
      {section === 'todos' && <TodosTab data={data} monthNav={monthNav} />}
    </div>
  );
}
