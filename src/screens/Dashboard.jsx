import { fmt } from '../lib/format';
import { WEEKDAY_LETTERS, dayTypeLabel, daysUntilPayday, formatShortDate, isSameMonth, last7Days, remainingDaysInMonth, todayISO } from '../lib/dates';
import { cardStyle, labelStyle } from '../lib/styles';

export default function Dashboard({ data, setData, onNavigate }) {
  const { user, incomes, goals, cards } = data;
  const today = todayISO();
  const week = last7Days();

  const incomesThisMonth = incomes.filter((i) => isSameMonth(i.date));
  const totalMonth = incomesThisMonth.reduce((a, i) => a + i.amount, 0);
  const ahorroMonth = incomesThisMonth.reduce((a, i) => a + (i.distribution.ahorro || 0), 0);
  const tarjetaMonth = incomesThisMonth.reduce((a, i) => a + (i.distribution.tarjeta || 0), 0);
  const disponible = totalMonth - ahorroMonth - tarjetaMonth;

  const weeklyTotal = incomes.filter((i) => week.includes(i.date)).reduce((a, i) => a + i.amount, 0);
  const totalAhorro = goals.reduce((a, g) => a + g.current, 0);
  const totalDeuda = cards.reduce((a, c) => a + c.balance, 0);

  const incomeByDate = {};
  incomes.forEach((i) => {
    incomeByDate[i.date] = i;
  });

  const weekStrip = week.map((d) => {
    const dow = new Date(d + 'T00:00:00').getDay();
    const isToday = d === today;
    const hasIncome = !!incomeByDate[d];
    let bg = 'var(--input-bg)';
    let color = 'var(--text-secondary)';
    if (hasIncome) {
      bg = 'var(--text)';
      color = 'var(--page-bg)';
    }
    if (isToday) {
      bg = 'var(--accent)';
      color = 'white';
    }
    return { date: d, letter: WEEKDAY_LETTERS[dow], day: String(Number(d.slice(8, 10))), bg, color };
  });

  const weekBars = week.map((d) => {
    const inc = incomeByDate[d];
    const dow = new Date(d + 'T00:00:00').getDay();
    const amt = inc ? inc.amount : 0;
    const isToday = d === today;
    const height = Math.max(6, Math.round((amt / 120000) * 70));
    const color = isToday ? 'var(--accent)' : amt > 0 ? 'var(--text)' : 'var(--divider)';
    return { date: d, letter: WEEKDAY_LETTERS[dow], height, color };
  });

  const goalsWithPct = goals.map((g) => ({ ...g, pct: Math.min(100, Math.round((g.current / g.target) * 100)) }));
  const nextGoal = goalsWithPct.find((g) => g.pct < 100) || goalsWithPct[0] || { name: 'Sin metas', current: 0, target: 1, pct: 0 };
  const goalDonut = `conic-gradient(var(--accent) ${nextGoal.pct || 0}%, var(--divider) ${nextGoal.pct || 0}% 100%)`;

  const sortedIncomes = [...incomes].sort((a, b) => b.date.localeCompare(a.date));
  const recentIncomes = sortedIncomes.slice(0, 4);

  const isUSD = user.currency === 'USD';
  const setCurrency = (currency) => setData((s) => ({ ...s, user: { ...s.user, currency } }));

  const projectedTotal = user.payBaseDay > 0 ? totalMonth + user.payBaseDay * remainingDaysInMonth() : null;
  const paydayDays = daysUntilPayday(user.payDayOfMonth);
  const paydayLabel = paydayDays === 0 ? 'Hoy' : paydayDays === 1 ? 'En 1 día' : `En ${paydayDays} días`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 30, color: 'var(--text)', letterSpacing: '-0.02em' }}>Inicio</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', background: 'var(--card-bg)', borderRadius: 20, padding: 4, gap: 2 }}>
            <button
              type="button"
              onClick={() => setCurrency('COP')}
              style={{
                padding: '6px 12px',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                background: isUSD ? 'transparent' : 'var(--text)',
                color: isUSD ? 'var(--text-secondary)' : 'var(--page-bg)',
              }}
            >
              COP
            </button>
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              style={{
                padding: '6px 12px',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                background: isUSD ? 'var(--text)' : 'transparent',
                color: isUSD ? 'var(--page-bg)' : 'var(--text-secondary)',
              }}
            >
              USD
            </button>
          </div>
          <button
            type="button"
            aria-label="Ajustes"
            onClick={() => onNavigate('config')}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--card-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 14 }}>
              <div style={{ height: 2, width: '100%', background: 'var(--text)', borderRadius: 2 }} />
              <div style={{ height: 2, width: '65%', background: 'var(--text)', borderRadius: 2 }} />
              <div style={{ height: 2, width: '85%', background: 'var(--text)', borderRadius: 2 }} />
            </div>
          </button>
        </div>
      </div>

      {/* Franja semanal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        {weekStrip.map((wd) => (
          <div key={wd.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{wd.letter}</div>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: wd.bg,
                color: wd.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {wd.day}
            </div>
          </div>
        ))}
      </div>

      {/* Ganado este mes */}
      <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center' }}>
        <div>
          <div style={labelStyle}>GANADO ESTE MES</div>
          <div style={{ fontWeight: 800, fontSize: 32, color: 'var(--text)', marginTop: 6, letterSpacing: '-0.02em' }}>
            {fmt(totalMonth, user.currency)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 6 }}>
            Esta semana <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmt(weeklyTotal, user.currency)} ↑</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 70 }}>
          {weekBars.map((wb) => (
            <div key={wb.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', borderRadius: 6, height: wb.height, background: wb.color, transition: 'height 0.4s ease' }} />
              <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 700 }}>{wb.letter}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Proyección del mes + Próximo pago */}
      <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        {projectedTotal !== null && (
          <div>
            <div style={labelStyle}>PROYECCIÓN DEL MES</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginTop: 3 }}>{fmt(projectedTotal, user.currency)}</div>
          </div>
        )}
        <div style={{ textAlign: projectedTotal !== null ? 'right' : 'left' }}>
          <div style={labelStyle}>PRÓXIMO PAGO</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginTop: 3 }}>{paydayLabel}</div>
        </div>
      </div>

      {/* Meta principal + Ahorro/Deudas/Disponible */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ ...labelStyle, alignSelf: 'flex-start' }}>META PRINCIPAL</div>
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: goalDonut, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
            <div style={{ width: 92, height: 92, borderRadius: '50%', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>{nextGoal.pct || 0}%</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 12, fontWeight: 700, textAlign: 'center' }}>{nextGoal.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {fmt(nextGoal.current, user.currency)} / {fmt(nextGoal.target, user.currency)}
          </div>
        </div>

        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={labelStyle}>AHORRO</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginTop: 3 }}>{fmt(totalAhorro, user.currency)}</div>
          </div>
          <div style={{ height: 1, background: 'var(--divider)' }} />
          <div>
            <div style={labelStyle}>DEUDAS</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginTop: 3 }}>{fmt(totalDeuda, user.currency)}</div>
          </div>
          <div style={{ height: 1, background: 'var(--divider)' }} />
          <div>
            <div style={labelStyle}>DISPONIBLE</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginTop: 3 }}>{fmt(disponible, user.currency)}</div>
          </div>
        </div>
      </div>

      {/* Accesos directos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>Ingresos</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Registra y distribuye</div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('registrar')}
            style={{
              height: 46,
              borderRadius: 23,
              background: 'var(--text)',
              color: 'var(--page-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Registrar
          </button>
        </div>
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>Deudas</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Tarjetas y préstamos</div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('tarjetas')}
            style={{
              height: 46,
              borderRadius: 23,
              background: 'var(--text)',
              color: 'var(--page-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Ver
          </button>
        </div>
      </div>

      {/* Últimos ingresos */}
      {incomes.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>Últimos ingresos</div>
            <button
              type="button"
              onClick={() => onNavigate('ingresos')}
              style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}
            >
              Ver todos
            </button>
          </div>
          {recentIncomes.map((inc, idx) => (
            <div
              key={inc.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '9px 0',
                borderBottom: idx === recentIncomes.length - 1 ? 'none' : '1px solid var(--divider)',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{inc.name || dayTypeLabel(inc.type)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {formatShortDate(inc.date)} · {dayTypeLabel(inc.type)}
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{fmt(inc.amount, user.currency)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
