import { useEffect } from 'react';

// A brief, auto-dismissing confirmation banner — for "this big thing you just did
// worked", not for anything that needs a response (that's InlineConfirm/BottomSheet).
// `variant` defaults to the brand accent (existing behavior, e.g. RestaurarDatos'
// restore confirmations) — pass 'success'/'error' where a real green/red signal
// matters more than brand consistency, like a backup actually succeeding or failing.
const VARIANT_BG = { brand: 'var(--accent)', success: 'var(--good)', error: 'var(--danger)' };

export default function Toast({ message, onClose, duration = 4000, variant = 'brand' }) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

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
        background: VARIANT_BG[variant] || VARIANT_BG.brand,
        color: 'white',
        borderRadius: 18,
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.24)',
      }}
    >
      <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{message}</div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        style={{ color: 'white', opacity: 0.75, fontSize: 16, fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
}
