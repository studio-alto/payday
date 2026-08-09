import { useLayoutEffect, useRef } from 'react';

// position:fixed (not sticky) because Safari has long-standing bugs sticking
// elements nested inside multiple flex containers. Height is measured and
// published as --header-h so the scrollable content can reserve space below it.
export default function FixedHeader({ children }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const setHeight = () => {
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
    };
    setHeight();
    const ro = new ResizeObserver(setHeight);
    ro.observe(el);
    return () => ro.disconnect();
  });

  return (
    <div
      ref={ref}
      className="app-hpad"
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 640,
        background: 'var(--page-bg)',
        zIndex: 10,
        paddingTop: 28,
        paddingBottom: 14,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
}
