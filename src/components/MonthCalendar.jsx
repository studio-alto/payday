const WEEKDAY_HEADERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

// A month grid — days with income get an accent dot, days with an expense
// payment get a danger dot (a day can show both), and today gets a filled
// circle. Tapping a day selects it (ring outline) so the caller can filter
// the list below to just that day.
export default function MonthCalendar({ year, month, incomeDays, expenseDays, today, selectedDay, onSelectDay, maxDate }) {
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
                  background: isToday ? 'var(--accent)' : 'transparent',
                  color: isToday ? 'white' : 'var(--text)',
                  boxShadow: isSelected && !isToday ? 'inset 0 0 0 2px var(--text)' : 'none',
                }}
              >
                {d}
              </div>
              <div style={{ display: 'flex', gap: 3, height: 5 }}>
                {hasIncome && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />}
                {hasExpense && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--danger)' }} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
