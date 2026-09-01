const SHARED = { viewBox: '0 0 24 24', fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

// Simple line-icon glyphs, one per preset variable-expense category — a
// generic tag icon covers anything custom. Keeps the category picker
// scannable at a glance instead of just a wall of text labels.
const GLYPHS = {
  Mercado: (
    <>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  Transporte: (
    <>
      <path d="M4.5 15.5l1.3-4.6A2 2 0 0 1 7.7 9.5h8.6a2 2 0 0 1 1.9 1.4l1.3 4.6" />
      <rect x="3.5" y="15.5" width="17" height="3.2" rx="1.4" />
      <circle cx="7.5" cy="19.3" r="1.2" />
      <circle cx="16.5" cy="19.3" r="1.2" />
    </>
  ),
  Restaurante: (
    <>
      <path d="M7 3v6a1.5 1.5 0 0 0 3 0V3" />
      <path d="M8.5 3v18" />
      <path d="M16 3c-1.6 0-2.5 1.8-2.5 4s.9 4 2.5 4v11" />
    </>
  ),
  Entretenimiento: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <path d="M10.5 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
    </>
  ),
  Salud: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  'Cuidado personal': (
    <path d="M12 3.5c3 4 6 7.4 6 11a6 6 0 0 1-12 0c0-3.6 3-7 6-11z" />
  ),
  Hogar: (
    <>
      <path d="M4 11.5L12 4l8 7.5" />
      <path d="M6 10v9.5h12V10" />
      <path d="M10 19.5v-6h4v6" />
    </>
  ),
  Ropa: <path d="M9 3L4 7l2.5 3L8 9v12h8V9l1.5 1L20 7l-5-4-1.5 2h-3L9 3z" />,
  Educación: (
    <>
      <path d="M3 8.5L12 5l9 3.5-9 3.5-9-3.5z" />
      <path d="M7 10.3v4.4c0 1.4 2.2 2.8 5 2.8s5-1.4 5-2.8v-4.4" />
    </>
  ),
  Vacaciones: <path d="M3 13l7-1.5L14.5 3l2 1-3 8.5 6 1-1 2-6-.5-3 4-2-.5 1.5-4-6-.5v-1z" />,
  Mascotas: (
    <>
      <ellipse cx="12" cy="16.5" rx="4.3" ry="3.3" />
      <ellipse cx="6.2" cy="10" rx="1.6" ry="2" />
      <ellipse cx="10" cy="7" rx="1.6" ry="2" />
      <ellipse cx="14" cy="7" rx="1.6" ry="2" />
      <ellipse cx="17.8" cy="10" rx="1.6" ry="2" />
    </>
  ),
  Regalos: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="1.5" />
      <path d="M4 13.5h16" />
      <path d="M12 10v10" />
      <path d="M12 10c-1-3-6-3.5-6-1s3 1.5 6 1zM12 10c1-3 6-3.5 6-1s-3 1.5-6 1z" />
    </>
  ),
  Misceláneos: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
};

const FALLBACK = (
  <>
    <path d="M12.6 3.4l7 7a2 2 0 0 1 0 2.8l-6.4 6.4a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 11V5a2 2 0 0 1 2-2h6c.6 0 1.2.2 1.6.6z" />
    <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
  </>
);

export default function CategoryIcon({ categoria, size = 20, color = 'currentColor' }) {
  return (
    <svg {...SHARED} width={size} height={size} stroke={color} style={{ flexShrink: 0 }}>
      {GLYPHS[categoria] || FALLBACK}
    </svg>
  );
}
