export default function Welcome({ onFinish }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        background: 'var(--page-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 24,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 30, color: 'var(--text)', letterSpacing: '-0.02em' }}>¡Bienvenido a Payday!</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 300 }}>
          Registra lo que ganas cada día, separa para tus metas y deudas, y lleva el control de tus gastos fijos, todo en un
          solo lugar.
        </div>
      </div>

      <button
        type="button"
        onClick={onFinish}
        style={{
          width: '100%',
          maxWidth: 320,
          height: 52,
          borderRadius: 26,
          background: 'var(--text)',
          color: 'var(--page-bg)',
          fontWeight: 700,
          fontSize: 15,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Comenzar
      </button>
    </div>
  );
}
