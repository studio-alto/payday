// Single-value progress ring (percentage filled vs. remaining) with rounded
// end caps on the filled arc — an SVG stroke, not the old conic-gradient div,
// since only a real stroke can round its own ends. The ring's hole is
// transparent by nature (an SVG stroke has no fill), so whatever sits behind
// it — the card's own background — shows through without needing a
// second, color-matched inner circle like the old div-based version did.
export default function ProgressRing({ pct, size = 120, strokeWidth, color = 'var(--accent)', trackColor = 'var(--divider)', children, style }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const width = strokeWidth ?? size * 0.18;
  const radius = size / 2 - width / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (clamped / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, ...style }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={width} />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={width}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${Math.max(circumference - filled, 0)}`}
          />
        )}
      </svg>
      {children && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </div>
      )}
    </div>
  );
}
