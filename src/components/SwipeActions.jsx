import { useRef, useState } from 'react';

const BUTTON_WIDTH = 84;

// Swipe-left-to-reveal actions (iOS Mail/Reminders style) — wraps a card's content;
// dragging it left uncovers one or more action buttons pinned behind it. Replaces a
// row of always-visible icon buttons with the native gesture people already know.
export default function SwipeActions({ children, actions, borderRadius = 24 }) {
  const [dragX, setDragX] = useState(0);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(null);
  const startedOpen = useRef(false);
  const maxReveal = actions.length * BUTTON_WIDTH;

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX.current = e.clientX;
    startedOpen.current = open;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (startX.current === null) return;
    const delta = e.clientX - startX.current;
    const base = startedOpen.current ? -maxReveal : 0;
    setDragX(Math.max(-maxReveal, Math.min(0, base + delta)));
  };
  const endDrag = () => {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);
    const shouldOpen = dragX < -maxReveal / 2;
    setOpen(shouldOpen);
    setDragX(shouldOpen ? -maxReveal : 0);
  };
  const close = () => {
    setOpen(false);
    setDragX(0);
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius }}>
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, display: 'flex' }}>
        {actions.map((a, i) => (
          <button
            key={i}
            type="button"
            aria-label={a.label}
            onClick={() => {
              close();
              a.onClick();
            }}
            style={{
              width: BUTTON_WIDTH,
              background: a.bg,
              color: a.color || 'white',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {a.icon}
            <span style={{ fontSize: 11, fontWeight: 700 }}>{a.label}</span>
          </button>
        ))}
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={(e) => {
          if (open) {
            e.stopPropagation();
            close();
          }
        }}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 0.2s ease',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
