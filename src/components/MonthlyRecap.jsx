import { fmt } from '../lib/format';
import { primaryButtonStyle } from '../lib/styles';

const ROW_COLORS = { ahorro: '#00c45b', deudas: '#476bff', gastosFijos: '#ff7500', gastosVariables: '#2fa4ad' };

function Row({ label, value, color, currency }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--divider)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700 }}>{label}</div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{fmt(value, currency)}</div>
    </div>
  );
}

export default function MonthlyRecap({ recap, currency, onClose }) {
  const capitalizedLabel = recap.label.charAt(0).toUpperCase() + recap.label.slice(1);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        background: 'var(--page-bg)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', letterSpacing: '0.06em' }}>TU RESUMEN DE</div>
          <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>{capitalizedLabel}</div>
        </div>

        <div style={{ background: 'var(--card-bg)', borderRadius: 24, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>TE QUEDÓ LIBRE</div>
          <div style={{ fontWeight: 800, fontSize: 32, color: recap.netBalance >= 0 ? 'var(--accent-text)' : 'var(--danger-text)', marginTop: 8, letterSpacing: '-0.02em' }}>
            {fmt(recap.netBalance, currency)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            De {fmt(recap.totalIncome, currency)} que ingresaron{recap.incomeCount > 0 && ` en ${recap.incomeCount} ${recap.incomeCount === 1 ? 'registro' : 'registros'}`}
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', borderRadius: 24, padding: '4px 20px' }}>
          <Row label="Ahorro" value={recap.totalAhorro} color={ROW_COLORS.ahorro} currency={currency} />
          <Row label="Abonos a deudas" value={recap.totalDebtPaid} color={ROW_COLORS.deudas} currency={currency} />
          <Row label="Gastos fijos" value={recap.totalFixed} color={ROW_COLORS.gastosFijos} currency={currency} />
          <Row label="Gastos variables" value={recap.totalVariables} color={ROW_COLORS.gastosVariables} currency={currency} />
        </div>

        {recap.topCategory && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
            Lo que más gastaste fue en <b style={{ color: 'var(--text)' }}>{recap.topCategory.name}</b>, {fmt(recap.topCategory.total, currency)}
          </div>
        )}

        {(recap.goalsCompleted.length > 0 || recap.debtsCleared.length > 0) && (
          <div style={{ background: 'var(--accent-soft-bg)', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recap.goalsCompleted.map((name) => (
              <div key={name} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-text)' }}>🎉 Completaste la meta "{name}"</div>
            ))}
            {recap.debtsCleared.map((name) => (
              <div key={name} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-text)' }}>🎉 Terminaste de pagar "{name}"</div>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <button type="button" onClick={onClose} style={primaryButtonStyle()}>
          Listo
        </button>
      </div>
    </div>
  );
}
