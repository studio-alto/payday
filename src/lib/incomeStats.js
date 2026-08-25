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
