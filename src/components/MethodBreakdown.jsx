import { fmt } from '../lib/format';
import { totalsByMethod } from '../lib/paymentMethods';
import { cardStyle } from '../lib/styles';
import PaymentMethodIcon from './PaymentMethodIcon';

// "Por método de pago" — how the visible money splits across Efectivo/Nequi/etc.
// Renders nothing until at least one record actually has a method, so someone who
// never uses the field never sees an empty "Sin método" block.
export default function MethodBreakdown({ records, currency, title = 'POR MÉTODO DE PAGO', card = false }) {
  const totals = totalsByMethod(records);
  if (!totals.some((t) => t.method !== 'Sin método')) return null;
  return (
    <div
      style={
        card
          ? { ...cardStyle, display: 'flex', flexDirection: 'column', gap: 6 }
          : { background: 'var(--input-bg)', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }
      }
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>{title}</div>
      {totals.map((t) => (
        <div key={t.method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: t.method === 'Sin método' ? 'var(--text-secondary)' : 'var(--text)', fontWeight: 700 }}>
            {t.method !== 'Sin método' && <PaymentMethodIcon metodo={t.method} size={22} />}
            {t.method}
          </span>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(t.total, currency)}</span>
        </div>
      ))}
    </div>
  );
}
