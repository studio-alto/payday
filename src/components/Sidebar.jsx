// Desktop navigation: a dark, rounded panel on the left (shown from 1024px up, see
// index.css — phones and tablets keep the floating BottomNav instead).

function Icon({ name }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  switch (name) {
    case 'inicio':
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
        </svg>
      );
    case 'registrar':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case 'ingresos':
      return (
        <svg {...common}>
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        </svg>
      );
    case 'metas':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      );
    case 'gastos':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="13" rx="3" />
          <path d="M3 10.5h18M7 15h3" />
        </svg>
      );
    case 'ajustes':
      return (
        <svg {...common}>
          <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="8" cy="17" r="2" />
        </svg>
      );
    default:
      return null;
  }
}

const GENERAL = [
  { key: 'dashboard', label: 'Inicio', icon: 'inicio' },
  { key: 'registrar', label: 'Registrar', icon: 'registrar' },
  { key: 'ingresos', label: 'Ingresos', icon: 'ingresos' },
  { key: 'metas', label: 'Metas', icon: 'metas' },
  { key: 'tarjetas', label: 'Gastos y deudas', icon: 'gastos' },
];
const TOOLS = [{ key: 'config', label: 'Ajustes', icon: 'ajustes' }];

// Detail/secondary screens keep their parent section highlighted.
const PARENT = { 'meta-detalle': 'metas', 'deuda-detalle': 'tarjetas', restaurar: 'config' };

function NavItem({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '11px 14px',
        borderRadius: 14,
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 14,
        fontWeight: active ? 800 : 600,
        background: active ? 'var(--sidebar-active)' : 'transparent',
        color: active ? 'var(--sidebar-text)' : 'var(--sidebar-muted)',
      }}
    >
      <Icon name={item.icon} />
      {item.label}
    </button>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sidebar-muted)', letterSpacing: '0.08em', padding: '0 14px', marginBottom: 6, textTransform: 'uppercase' }}>{children}</div>;
}

export default function Sidebar({ activeTab, onChange }) {
  const current = PARENT[activeTab] || activeTab;
  return (
    <nav
      className="app-sidebar"
      aria-label="Navegación principal"
      style={{
        position: 'fixed',
        top: 'var(--sidebar-gap)',
        bottom: 'var(--sidebar-gap)',
        left: 'var(--sidebar-gap)',
        width: 'var(--sidebar-w)',
        background: 'var(--sidebar-bg)',
        borderRadius: 28,
        padding: '26px 14px 22px',
        flexDirection: 'column',
        gap: 24,
        zIndex: 12,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ padding: '0 14px', fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em', color: 'var(--sidebar-text)' }}>
        Pay<span style={{ color: 'var(--accent)' }}>day</span>
      </div>

      <div>
        <SectionLabel>General</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {GENERAL.map((item) => (
            <NavItem key={item.key} item={item} active={current === item.key} onClick={() => onChange(item.key)} />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Herramientas</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TOOLS.map((item) => (
            <NavItem key={item.key} item={item} active={current === item.key} onClick={() => onChange(item.key)} />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange('registrar')}
        style={{
          marginTop: 'auto',
          height: 48,
          borderRadius: 24,
          background: 'var(--accent)',
          color: 'white',
          fontWeight: 800,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        + Registrar ingreso
      </button>
    </nav>
  );
}
