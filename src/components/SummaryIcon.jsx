const SHARED = { viewBox: '0 0 24 24', fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

// Simple line-icon glyphs, one per row of the Dashboard's "Resumen general" —
// mirrors the hand-drawn style already used by CategoryIcon (no icon library).
const GLYPHS = {
  ahorro: (
    <>
      <ellipse cx="9.5" cy="12" rx="3" ry="2" />
      <ellipse cx="13.5" cy="10.5" rx="3.6" ry="2.4" />
      <ellipse cx="15" cy="14.5" rx="4.2" ry="2.8" />
    </>
  ),
  deudas: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="2.2" />
      <path d="M3.5 10h17" />
      <path d="M7 14.5h4" />
    </>
  ),
  gastosFijos: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 9.5h16" />
      <path d="M8 3.5v3.5M16 3.5v3.5" />
      <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  gastosVariables: (
    <>
      <path d="M6.5 8h11l-1 11.5h-9L6.5 8z" />
      <path d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2" />
    </>
  ),
  disponible: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9z" />
      <path d="M4 10h16" />
      <circle cx="16.5" cy="14" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
};

export default function SummaryIcon({ name, size = 18, color = 'currentColor' }) {
  return (
    <svg {...SHARED} width={size} height={size} stroke={color} style={{ flexShrink: 0 }}>
      {GLYPHS[name]}
    </svg>
  );
}
