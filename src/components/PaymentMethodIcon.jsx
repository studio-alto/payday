import { normalizeMethod } from '../lib/paymentMethods';
import nequiLogo from '../assets/payment/nequi.png';
import daviplataLogo from '../assets/payment/daviplata.png';
import brebLogo from '../assets/payment/breb.png';

// Each method's circle: the app's logo for Nequi, Daviplata and Bre-b (already laid out
// square on the brand color), and a drawn glyph on a brand-ish color for Efectivo and
// Transferencia, which have no logo of their own.
const STYLES = {
  Efectivo: { color: '#1f9d62', glyph: 'cash' },
  Nequi: { color: '#ece7f5', logo: nequiLogo },
  Daviplata: { color: '#ec1d27', logo: daviplataLogo },
  Transferencia: { color: '#476bff', glyph: 'bank' },
  'Bre-b': { color: '#2c1158', logo: brebLogo },
};

function Glyph({ kind, size }) {
  const s = Math.round(size * 0.52);
  if (kind === 'cash') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.6" />
        <path d="M6 9.5v.01M18 14.5v.01" />
      </svg>
    );
  }
  if (kind === 'bank') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10l9-6 9 6" />
        <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" />
        <path d="M3 20h18" />
      </svg>
    );
  }
  return <span style={{ fontWeight: 900, fontSize: Math.round(size * 0.46), lineHeight: 1 }}>{kind}</span>;
}

// Circle icon for a payment method. `active` fills it with the brand color (white glyph);
// otherwise a soft circle with the glyph in the brand color, same idea as the category
// picker. Logos can't be recolored, so inactive ones are shown greyed out instead.
export default function PaymentMethodIcon({ metodo, size = 48, active = true }) {
  const method = normalizeMethod(metodo);
  if (!method) return null;
  const { color, glyph, logo } = STYLES[method];
  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: color, opacity: active ? 1 : 0.5, filter: active ? 'none' : 'grayscale(1)' }}
      />
    );
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: active ? color : 'var(--input-bg)',
        color: active ? 'white' : color,
      }}
    >
      <Glyph kind={glyph} size={size} />
    </span>
  );
}

// " · [icon] Nequi" — the inline version used inside the small grey detail lines of lists.
export function MethodTag({ metodo, lead = true }) {
  const method = normalizeMethod(metodo);
  if (!method) return null;
  return (
    <>
      {lead && ' · '}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>
        <PaymentMethodIcon metodo={method} size={14} />
        {method}
      </span>
    </>
  );
}
