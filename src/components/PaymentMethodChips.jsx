import { PAYMENT_METHODS } from '../lib/paymentMethods';
import { fieldLabelStyle } from '../lib/styles';
import PaymentMethodIcon from './PaymentMethodIcon';

// Optional "método de pago" picker — circle icons like the category picker. One tap
// selects, tapping the selected one again clears it, so leaving it empty never needs
// an extra "ninguno" option.
export default function PaymentMethodChips({ value, onChange, label = 'MÉTODO DE PAGO (OPCIONAL)' }) {
  return (
    <div>
      <div style={fieldLabelStyle}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {PAYMENT_METHODS.map((m) => {
          const active = value === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(active ? '' : m)}
              aria-pressed={active}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '4px 0', border: 'none', background: 'none', cursor: 'pointer', minWidth: 0 }}
            >
              <PaymentMethodIcon metodo={m} size={48} active={active} />
              <span style={{ fontSize: 10, fontWeight: active ? 800 : 700, color: active ? 'var(--text)' : 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.15, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {m}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
