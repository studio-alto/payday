import { useRegisterSW } from 'virtual:pwa-register/react';

// Since registerType is 'prompt' (not 'autoUpdate'), a new deployed version
// installs in the background but waits here instead of silently taking over —
// this is what surfaces it, so people don't need to uninstall/reinstall the
// PWA to see changes.
export default function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(16px, env(safe-area-inset-top))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: 400,
        zIndex: 300,
        background: 'var(--text)',
        color: 'var(--page-bg)',
        borderRadius: 18,
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.24)',
      }}
    >
      <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>Hay una versión nueva de Payday</div>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        style={{ padding: '8px 14px', borderRadius: 14, background: 'var(--accent)', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', flexShrink: 0 }}
      >
        Actualizar
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        aria-label="Cerrar"
        style={{ color: 'var(--page-bg)', opacity: 0.6, fontSize: 16, fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
}
