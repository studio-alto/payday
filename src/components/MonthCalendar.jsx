const WEEKDAY_HEADERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

// A month grid — days with income are green (a soft tint behind the number plus a dot),
// days with an expense payment get a red dot (a day can show both), and today gets a
// filled accent circle. Income uses the "good" green rather than the brand orange so it
// can't be mistaken for the red expense dot. Tapping a day selects it (ring outline) so
// the caller can filter the list below to just that day.
export default function MonthCalendar({ year, month, incomeDays, expenseDays, today, selectedDay, onSelectDay, maxDate, showLegend = false }) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
        {WEEKDAY_HEADERS.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDay;
          const hasIncome = incomeDays.has(dateStr);
          const hasExpense = expenseDays.has(dateStr);
          const disabled = maxDate ? dateStr > maxDate : false;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDay(dateStr)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '4px 0',
                background: 'none',
                border: 'none',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.3 : 1,
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  background: isToday ? 'var(--accent)' : hasIncome ? 'var(--good-soft-bg)' : 'transparent',
                  color: isToday ? 'white' : hasIncome ? 'var(--good-text)' : 'var(--text)',
                  boxShadow: isSelected && !isToday ? 'inset 0 0 0 2px var(--text)' : 'none',
                }}
              >
                {d}
              </div>
              <div style={{ display: 'flex', gap: 3, height: 5 }}>
                {hasIncome && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--good)' }} />}
                {hasExpense && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--danger)' }} />}
              </div>
            </button>
          );
        })}
      </div>
      {showLegend && (
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--good)' }} />
            Ingreso
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)' }} />
            Gasto pagado
          </span>
        </div>
      )}
    </div>
  );
}
