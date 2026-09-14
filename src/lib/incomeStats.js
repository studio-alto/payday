import { isoOffset } from './dates';

// Projected incomes worth nagging the person to confirm: any still-planned income whose
// date already passed (clearly overdue), plus today's once it's evening — giving the
// day a chance to actually happen before asking "did this come in?".
export function getPendingConfirmations(incomes, now = new Date()) {
  const today = isoOffset(0, now);
  return incomes.filter((i) => {
    if (i.estado !== 'proyectado') return false;
    if (i.date < today) return true;
    if (i.date === today) return now.getHours() >= 18;
    return false;
  });
}

// Rolling average of the person's recent confirmed income — used instead of a fixed
// "base pay" setting, since gig/variable income rarely repeats the same amount.
export function averageRecentIncome(incomes, count = 10) {
  const confirmed = [...incomes]
    .filter((i) => i.estado !== 'proyectado')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, count);
  if (confirmed.length === 0) return 0;
  return Math.round(confirmed.reduce((a, i) => a + i.amount, 0) / confirmed.length);
}

// The reference income figure shown while registering/reviewing income — an
// average of recent entries for variable/gig income, or the expected fixed salary
// for a "fijo" earner. With one or more sueldos fijos configured (see
// lib/recurringIncome.js), that's their combined amount — not just whatever income
// was registered most recently, which could've been a one-off extra (horas extra,
// viáticos) registered after the salary and would otherwise throw this off. Without
// a sueldo fijo template (mode picked by hand, no recurring definition), falls back
// to the last confirmed entry like before.
export function referenceIncome(incomes, mode = 'variable', sueldosFijos = []) {
  if (mode === 'fijo') {
    if (sueldosFijos.length > 0) return sueldosFijos.reduce((a, sf) => a + sf.amount, 0);
    const confirmed = [...incomes].filter((i) => i.estado !== 'proyectado').sort((a, b) => b.date.localeCompare(a.date));
    return confirmed[0]?.amount || 0;
  }
  return averageRecentIncome(incomes);
}

// Whether a person effectively behaves as "fijo" — either they configured a
// sueldo fijo recurrente (Ajustes → Finanzas), which makes the manual toggle moot,
// or they picked "Fijo" by hand with no template. Centralized here so Dashboard,
// Registrar and Ajustes never disagree about which mode is actually in effect.
export function effectiveIncomeMode(data) {
  if ((data.sueldosFijos || []).length > 0) return 'fijo';
  return data.user.incomeMode || 'variable';
}

// Per-month totals (ganado, ahorro, deudas) for a given year, January through December.
export function monthlyBreakdown(incomes, year) {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i, ganado: 0, ahorro: 0, deudas: 0 }));
  incomes
    .filter((inc) => inc.estado !== 'proyectado')
    .forEach((inc) => {
      const d = new Date(inc.date + 'T00:00:00');
      if (d.getFullYear() !== year) return;
      const m = months[d.getMonth()];
      m.ganado += inc.amount;
      m.ahorro += inc.distribution?.ahorro || 0;
      m.deudas += inc.distribution?.tarjeta || 0;
    });
  return months;
}
