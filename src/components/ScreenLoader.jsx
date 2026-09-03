// Suspense fallback shown for the brief moment a lazily-loaded screen's own
// chunk is still fetching. Reuses the splash screen's 3-dot motif (see
// Splash.jsx) instead of plain "Cargando…" text, so this still feels like part
// of the same app rather than a generic loading state.
export default function ScreenLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'screen-loader-pulse 1s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
