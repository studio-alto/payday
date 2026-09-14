// Lets a section page back through past months (and forward again up to the
// current one) instead of only ever showing "now" — used by Gastos fijos,
// Variables and Todos, all driven by the same `viewMonth` state in Deudas.jsx.
export default function MonthSwitcher({ label, isCurrentMonth, onPrev, onNext }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button
        type="button"
        onClick={onPrev}
        aria-label="Mes anterior"
        style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--input-bg)', color: 'var(--text)', fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer' }}
      >
        ‹
      </button>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{label}</div>
      <button
        type="button"
        onClick={onNext}
        disabled={isCurrentMonth}
        aria-label="Mes siguiente"
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          background: 'var(--input-bg)',
          color: 'var(--text)',
          fontSize: 16,
          fontWeight: 700,
          border: 'none',
          cursor: isCurrentMonth ? 'default' : 'pointer',
          opacity: isCurrentMonth ? 0.3 : 1,
        }}
      >
        ›
      </button>
    </div>
  );
}
