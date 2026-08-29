import { useRef, useState } from 'react';

const SLOT_WIDTH = 68;
const BUTTON_SIZE = 44;

// Swipe-left-to-reveal actions (iOS Mail/Reminders style) — wraps a card's content;
// dragging it left uncovers one or more floating circular action buttons pinned
// behind it, on `background` (the surface behind the card, so it reads as depth
// rather than a flush-cut rectangle). Replaces a row of always-visible icon buttons
// with the native gesture people already know.
export default function SwipeActions({ children, actions, borderRadius = 24, background = 'var(--page-bg)' }) {
  const [dragX, setDragX] = useState(0);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(null);
  const startedOpen = useRef(false);
  const maxReveal = actions.length * SLOT_WIDTH;

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
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius, background }}>
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 12, paddingRight: 16 }}>
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
              width: BUTTON_SIZE,
              height: BUTTON_SIZE,
              borderRadius: '50%',
              background: a.bg,
              color: a.color || 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 3px 10px rgba(0,0,0,0.16)',
            }}
          >
            {a.icon}
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
          transition: dragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
