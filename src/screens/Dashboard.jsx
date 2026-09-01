import { fmt } from '../lib/format';
import { WEEKDAY_LETTERS, dayTypeLabel, daysUntilPayday, formatShortDate, isSameMonth, last7Days, remainingDaysInMonth, todayISO } from '../lib/dates';
import { cardStyle, labelStyle } from '../lib/styles';
import { averageRecentIncome, getPendingConfirmations } from '../lib/incomeStats';
import { applyIncomeEffects } from '../lib/debt';
import FixedHeader from '../components/FixedHeader';

export default function Dashboard({ data, setData, onNavigate }) {
  const { user, incomes, goals, cards, expenses } = data;
  const today = todayISO();
  const week = last7Days();

  const confirmedIncomes = incomes.filter((i) => i.estado !== 'proyectado');
  const projectedIncomes = incomes.filter((i) => i.estado === 'proyectado');

  const incomesThisMonth = confirmedIncomes.filter((i) => isSameMonth(i.date));
  const totalMonth = incomesThisMonth.reduce((a, i) => a + i.amount, 0);
  const ahorroMonth = incomesThisMonth.reduce((a, i) => a + (i.distribution.ahorro || 0), 0);
  const tarjetaMonth = incomesThisMonth.reduce((a, i) => a + (i.distribution.tarjeta || 0), 0);
  const totalGastos = expenses.reduce((a, e) => a + e.amount, 0);
  const disponible = totalMonth - ahorroMonth - tarjetaMonth - totalGastos;
  const gastosPct = totalMonth > 0 ? Math.round((totalGastos / totalMonth) * 100) : 0;
  const budgetNecesidades = user.budgetNecesidades ?? 50;

  const weeklyTotal = confirmedIncomes.filter((i) => week.includes(i.date)).reduce((a, i) => a + i.amount, 0);
  const totalAhorro = goals.reduce((a, g) => a + g.current, 0);
  const totalDeuda = cards.reduce((a, c) => a + c.balance, 0);
  const totalProyectado = projectedIncomes.reduce((a, i) => a + i.amount, 0);

  const incomeByDate = {};
  confirmedIncomes.forEach((i) => {
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
    return { date: d, letter: WEEKDAY_LETTERS[dow], height, color, amt };
  });
  const weekBarsLabel = `Ingresos de los últimos 7 días: ${weekBars.map((wb) => `${wb.letter} ${fmt(wb.amt, user.currency)}`).join(', ')}`;

  const goalsWithPct = goals.map((g) => ({ ...g, pct: Math.min(100, Math.round((g.current / g.target) * 100)) }));
  const nextGoal = goalsWithPct.find((g) => g.pct < 100) || goalsWithPct[0] || { name: 'Sin metas', current: 0, target: 1, pct: 0 };
  const goalDonut = `conic-gradient(var(--accent) ${nextGoal.pct || 0}%, var(--divider) ${nextGoal.pct || 0}% 100%)`;

  const sortedIncomes = [...confirmedIncomes].sort((a, b) => b.date.localeCompare(a.date));
  const recentIncomes = sortedIncomes.slice(0, 4);

  const isUSD = user.currency === 'USD';
  const setCurrency = (currency) => setData((s) => ({ ...s, user: { ...s.user, currency } }));

  const avgDailyIncome = averageRecentIncome(incomes);
  // Projecting "avg daily x remaining days" only makes sense for variable/gig
  // income — a fixed monthly salary doesn't grow by more days passing, so the
  // month total is already whatever's been registered.
  const projectedTotal = user.incomeMode !== 'fijo' && avgDailyIncome > 0 ? totalMonth + avgDailyIncome * remainingDaysInMonth() : null;
  const paydayDays = daysUntilPayday(user.payDayOfMonth);
  const paydayLabel = paydayDays === 0 ? 'Hoy' : paydayDays === 1 ? 'En 1 día' : `En ${paydayDays} días`;

  const dueSoonLabel = (daysLeft) => (daysLeft < 0 ? 'vencido' : daysLeft === 0 ? 'vence hoy' : daysLeft === 1 ? 'vence en 1 día' : `vence en ${daysLeft} días`);

  const urgentExpenses = expenses
    .filter((e) => !e.history.some((h) => isSameMonth(h.date)))
    .map((e) => ({ id: e.id, name: e.name, daysLeft: daysUntilPayday(e.dueDay) }))
    .filter((e) => e.daysLeft <= 3);

  const urgentDebts = cards
    .filter((c) => c.balance > 0)
    .map((c) => ({ id: c.id, name: c.name, daysLeft: Math.round((new Date(c.nextPayment + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000) }))
    .filter((c) => c.daysLeft <= 3);

  const urgentItems = [...urgentDebts, ...urgentExpenses].sort((a, b) => a.daysLeft - b.daysLeft);

  const pendingConfirmations = getPendingConfirmations(incomes);
  const confirmIncome = (income) => {
    setData((s) => {
      const applied = applyIncomeEffects(income, s.goals, s.cards, s.user.debtMethod || 'bola_nieve');
      const updatedIncome = { ...income, estado: 'confirmado', distribution: { ...income.distribution, debtAllocations: applied.debtAllocations } };
      return { ...s, incomes: s.incomes.map((i) => (i.id === income.id ? updatedIncome : i)), goals: applied.goals, cards: applied.cards };
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--header-h, 150px)' }}>
      <FixedHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
          {weekStrip.map((wd) => (
            <div key={wd.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{wd.letter}</div>
              <div
                style={{
                  width: 34,
                  height: 34,
                  flexShrink: 0,
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
        </div>
      </FixedHeader>

      {urgentItems.length > 0 && (
        <div style={{ ...cardStyle, background: 'var(--danger-soft-bg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger-text)', letterSpacing: '0.06em' }}>PARA ESTAR PENDIENTE</div>
          {urgentItems.slice(0, 3).map((it) => (
            <div key={it.id} style={{ fontSize: 13, color: 'var(--text)' }}>
              <b>{it.name}</b> {dueSoonLabel(it.daysLeft)}
            </div>
          ))}
          {urgentItems.length > 3 && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>+{urgentItems.length - 3} más</div>
          )}
        </div>
      )}

      {pendingConfirmations.length > 0 && (
        <div
          style={{
            ...cardStyle,
            background: 'var(--accent)',
            boxShadow: '0 10px 28px -6px rgba(255, 90, 54, 0.55)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'white', letterSpacing: '0.06em' }}>
            {pendingConfirmations.length === 1 ? '1 INGRESO POR CONFIRMAR' : `${pendingConfirmations.length} INGRESOS POR CONFIRMAR`}
          </div>
          {pendingConfirmations.slice(0, 3).map((inc) => (
            <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {inc.name || dayTypeLabel(inc.type)}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                  {formatShortDate(inc.date)} · {fmt(inc.amount, user.currency)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => confirmIncome(inc)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 16,
                  background: 'white',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  border: 'none',
                  flexShrink: 0,
                }}
              >
                Confirmar
              </button>
            </div>
          ))}
          {pendingConfirmations.length > 3 && (
            <button
              type="button"
              onClick={() => onNavigate('ingresos')}
              style={{ fontSize: 12, fontWeight: 700, color: 'white', cursor: 'pointer', textAlign: 'left' }}
            >
              +{pendingConfirmations.length - 3} más — ver todos
            </button>
          )}
        </div>
      )}

      {/* Ganado este mes */}
      <button
        type="button"
        onClick={() => onNavigate('ingresos')}
        style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
      >
        <div>
          <div style={labelStyle}>GANADO ESTE MES</div>
          <div style={{ fontWeight: 800, fontSize: 32, color: 'var(--text)', marginTop: 6, letterSpacing: '-0.02em' }}>
            {fmt(totalMonth, user.currency)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 6 }}>
            Esta semana <span style={{ color: 'var(--accent-text)', fontWeight: 700 }}>{fmt(weeklyTotal, user.currency)} ↑</span>
          </div>
        </div>
        <div role="img" aria-label={weekBarsLabel} style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 70 }}>
          {weekBars.map((wb) => (
            <div key={wb.date} aria-hidden="true" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', borderRadius: 6, height: wb.height, background: wb.color, transition: 'height 0.4s ease' }} />
              <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 700 }}>{wb.letter}</div>
            </div>
          ))}
        </div>
      </button>

      {user.metaIngresoMensual > 0 && (
        <button
          type="button"
          onClick={() => onNavigate('ingresos')}
          style={{ ...cardStyle, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={labelStyle}>META DE INGRESO MENSUAL</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
              {fmt(totalMonth, user.currency)} / {fmt(user.metaIngresoMensual, user.currency)}
            </div>
          </div>
          <div style={{ height: 8, background: 'var(--divider)', borderRadius: 6, overflow: 'hidden', marginTop: 8 }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round((totalMonth / user.metaIngresoMensual) * 100))}%`,
                background: 'var(--accent)',
                borderRadius: 6,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </button>
      )}

      {/* Proyección del mes + Próximo pago */}
      <button
        type="button"
        onClick={() => onNavigate('ingresos')}
        style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
      >
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
      </button>

      {projectedIncomes.length > 0 && (
        <button
          type="button"
          onClick={() => onNavigate('ingresos')}
          style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
        >
          <div>
            <div style={labelStyle}>PRÓXIMOS A RECIBIR</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', marginTop: 3 }}>{fmt(totalProyectado, user.currency)}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {projectedIncomes.length === 1 ? '1 ingreso' : `${projectedIncomes.length} ingresos`}
          </div>
        </button>
      )}

      {/* Meta principal + Ahorro/Deudas/Disponible */}
      <div className="meta-ahorro-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <button
          type="button"
          onClick={() => onNavigate('metas')}
          style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, border: 'none', cursor: 'pointer', width: '100%' }}
        >
          <div style={{ ...labelStyle, alignSelf: 'flex-start' }}>META PRINCIPAL</div>
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: goalDonut, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
            <div style={{ width: 82, height: 82, borderRadius: '50%', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 21, color: 'var(--text)' }}>{nextGoal.pct || 0}%</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 12, fontWeight: 700, textAlign: 'center' }}>{nextGoal.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {fmt(nextGoal.current, user.currency)} / {fmt(nextGoal.target, user.currency)}
          </div>
        </button>

        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
          <button type="button" onClick={() => onNavigate('metas')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
            <div style={labelStyle}>AHORRO</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginTop: 3 }}>{fmt(totalAhorro, user.currency)}</div>
          </button>
          <div style={{ height: 1, background: 'var(--divider)' }} />
          <button type="button" onClick={() => onNavigate('tarjetas')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
            <div style={labelStyle}>DEUDAS</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginTop: 3 }}>{fmt(totalDeuda, user.currency)}</div>
          </button>
          {totalGastos > 0 && (
            <>
              <div style={{ height: 1, background: 'var(--divider)' }} />
              <button type="button" onClick={() => onNavigate('tarjetas')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
                <div style={labelStyle}>GASTOS FIJOS</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginTop: 3 }}>{fmt(totalGastos, user.currency)}</div>
                {totalMonth > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: gastosPct > budgetNecesidades ? 'var(--danger-text)' : 'var(--text-secondary)', marginTop: 2 }}>
                    {gastosPct}% de lo ganado · sugerido {budgetNecesidades}%
                  </div>
                )}
              </button>
            </>
          )}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>Ingresos</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Registra y distribuye</div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('ingresos')}
              style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer', flexShrink: 0 }}
            >
              Ver
            </button>
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
              style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer' }}
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
