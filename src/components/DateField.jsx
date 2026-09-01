import { useState } from 'react';
import MonthCalendar from './MonthCalendar';
import { formatFullDate, todayISO } from '../lib/dates';

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const NO_DAYS = new Set();

// Replaces the native <input type="date"> inside our BottomSheets — Chrome's
// own date picker doesn't reliably flip upward when the input sits near the
// bottom of the viewport (which it always does here, since sheets slide up
// from the bottom edge), so it renders half cut off. This opens inline
// instead, pushing the rest of the sheet down, so it can never be clipped.
export default function DateField({ value, onChange, max, style }) {
  const [open, setOpen] = useState(false);
  const base = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const select = (dateStr) => {
    if (max && dateStr > max) return;
    onChange({ target: { value: dateStr } });
    setOpen(false);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ ...style, textAlign: 'left', cursor: 'pointer', color: value ? style?.color || 'var(--text)' : 'var(--text-secondary)' }}
      >
        {value ? formatFullDate(value) : 'Seleccionar fecha'}
      </button>

      {open && (
        <div style={{ marginTop: 8, padding: 14, borderRadius: 16, background: 'var(--input-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 10 }}>
            <button
              type="button"
              onClick={goPrevMonth}
              aria-label="Mes anterior"
              style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 14, background: 'none', border: 'none' }}
            >
              ‹
            </button>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
              {MONTH_LABELS[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={goNextMonth}
              aria-label="Mes siguiente"
              style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 14, background: 'none', border: 'none' }}
            >
              ›
            </button>
          </div>
          <MonthCalendar
            year={viewYear}
            month={viewMonth}
            incomeDays={NO_DAYS}
            expenseDays={NO_DAYS}
            today={todayISO()}
            selectedDay={value}
            onSelectDay={select}
            maxDate={max}
          />
        </div>
      )}
    </div>
  );
}
