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
