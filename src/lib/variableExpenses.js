// Ad-hoc/discretionary spending, categorized — distinct from `expenses` (fixed
// recurring bills like rent or Netflix, tracked by due day). These are one-off
// purchases: groceries, a movie, a vet visit.
export const VARIABLE_CATEGORIES = [
  'Mercado',
  'Transporte',
  'Restaurante',
  'Entretenimiento',
  'Salud',
  'Cuidado personal',
  'Hogar',
  'Ropa',
  'Educación',
  'Vacaciones',
  'Mascotas',
  'Regalos',
  'Misceláneos',
];

// Total spent per category within a given month — one entry per category (0 if
// nothing was spent there), so a budget-vs-actual row can always be shown.
export function monthlyCategoryTotals(gastosVariables, categories, year, month) {
  return categories.map((categoria) => {
    const total = gastosVariables
      .filter((g) => g.categoria === categoria)
      .filter((g) => {
        const d = new Date(g.date + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((a, g) => a + g.amount, 0);
    return { categoria, total };
  });
}

const MONTH_LABELS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Total variable spending (every category combined) per month, for the last
// `monthsBack` months ending this month — same shape as debt.js's
// monthlyPaidTotals, so it renders with the same bar-chart pattern.
export function monthlyVariableTotals(gastosVariables, monthsBack = 6, ref = new Date()) {
  const months = Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(ref.getFullYear(), ref.getMonth() - (monthsBack - 1 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: MONTH_LABELS_SHORT[d.getMonth()], total: 0 };
  });
  gastosVariables.forEach((g) => {
    const d = new Date(g.date + 'T00:00:00');
    const bucket = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth());
    if (bucket) bucket.total += g.amount;
  });
  return months;
}
