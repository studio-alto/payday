import { useEffect, useRef, useState } from 'react';

// Kebab ("⋮") menu — always-visible alternative to swipe-to-reveal for a card's
// Editar/Eliminar actions. Discoverable without a hidden gesture: tap the dots,
// pick an option. `children` is the card content; pass `inline` (no children) to
// place the trigger directly inside a row's own layout instead of overlaying a corner.
export default function CardMenu({ actions, children, inline = false, triggerBg = 'var(--input-bg)', triggerColor = 'var(--text-secondary)' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const trigger = (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Más opciones"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: triggerBg,
          color: triggerColor,
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="2.5" r="1.6" />
          <circle cx="8" cy="8" r="1.6" />
          <circle cx="8" cy="13.5" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 150,
            background: 'var(--card-bg)',
            borderRadius: 14,
            boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
            padding: 6,
            // Above the floating bottom nav (zIndex 15) — a menu opened on the last
            // row in a list would otherwise render partly behind it.
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                color: a.destructive ? 'var(--danger-text)' : 'var(--text)',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (inline) return trigger;

  return (
    <div style={{ position: 'relative' }}>
      {children}
      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>{trigger}</div>
    </div>
  );
}
