export default function Splash({ fading }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--accent)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'auto',
        transition: 'opacity 0.6s ease',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 44, color: 'white', letterSpacing: '-0.02em' }}>Payday</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Tu dinero, cada día</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', opacity: 0.9 }} />
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', opacity: 0.6 }} />
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', opacity: 0.35 }} />
      </div>
    </div>
  );
}
