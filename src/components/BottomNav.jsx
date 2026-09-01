const TABS = ['dashboard', 'registrar', 'metas', 'tarjetas'];

function navColors(activeTab, key) {
  const active = activeTab === key;
  return {
    bg: active ? 'var(--text)' : 'var(--input-bg)',
    color: active ? 'var(--page-bg)' : 'var(--text)',
    label: active ? 'var(--text)' : 'var(--text-secondary)',
  };
}

function NavButton({ bg, onClick, children, label, labelColor }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        flex: 1,
        height: '100%',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: labelColor, letterSpacing: '0.02em' }}>{label}</div>
    </button>
  );
}

export default function BottomNav({ activeTab, onChange }) {
  const dashboard = navColors(activeTab, 'dashboard');
  const registrar = navColors(activeTab, 'registrar');
  const metas = navColors(activeTab, 'metas');
  const tarjetas = navColors(activeTab, 'tarjetas');

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'var(--nav-offset)',
        width: 'min(calc(100% - 40px), 400px)',
        height: 76,
        background: 'var(--card-bg)',
        borderRadius: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 15,
        boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
        padding: '0 10px',
        boxSizing: 'border-box',
      }}
    >
      <NavButton label="Inicio" labelColor={dashboard.label} bg={dashboard.bg} onClick={() => onChange('dashboard')}>
        <div style={{ width: 14, height: 14, borderRadius: 4, background: dashboard.color }} />
      </NavButton>

      <NavButton label="Registrar" labelColor={registrar.label} bg={registrar.bg} onClick={() => onChange('registrar')}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${registrar.color}`, position: 'relative' }}>
          <div style={{ position: 'absolute', top: '50%', left: 2, right: 2, height: 2, background: registrar.color, transform: 'translateY(-50%)' }} />
          <div style={{ position: 'absolute', left: '50%', top: 2, bottom: 2, width: 2, background: registrar.color, transform: 'translateX(-50%)' }} />
        </div>
      </NavButton>

      <NavButton label="Metas" labelColor={metas.label} bg={metas.bg} onClick={() => onChange('metas')}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${metas.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: metas.color }} />
        </div>
      </NavButton>

      <NavButton label="Deudas" labelColor={tarjetas.label} bg={tarjetas.bg} onClick={() => onChange('tarjetas')}>
        <div style={{ width: 18, height: 12, borderRadius: 4, border: `2px solid ${tarjetas.color}`, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 2, left: 0, right: 0, height: 3, background: tarjetas.color }} />
        </div>
      </NavButton>
    </div>
  );
}

export { TABS };
