const MONTH_LABELS_FULL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// `throughDay` (optional) caps the range to the 1st through that day-of-month —
// used to compare a month-in-progress against the *same* stretch of an earlier
// month, instead of against that month's full total (which makes any partial
// month look artificially worse on income and worse on spending alike).
function inMonth(dateStr, year, month, throughDay = null) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  if (d.getFullYear() !== year || d.getMonth() !== month) return false;
  return throughDay == null || d.getDate() <= throughDay;
}

export function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function previousMonth(year, month) {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}

// Everything that happened in one calendar month, pulled straight from each
// feature's own history log (income dates, goal/card/expense `history` entries) —
// no separate ledger to keep in sync, so it's always consistent with what those
// screens themselves show.
export function computeMonthlyRecap(data, year, month, throughDay = null) {
  const { incomes, goals, cards, expenses, gastosVariables } = data;
  const within = (dateStr) => inMonth(dateStr, year, month, throughDay);

  const monthIncomes = incomes.filter((i) => i.estado !== 'proyectado' && within(i.date));
  const totalIncome = monthIncomes.reduce((a, i) => a + i.amount, 0);

  const fixedPaid = expenses.flatMap((e) => (e.history || []).filter((h) => within(h.date)));
  const totalFixed = fixedPaid.reduce((a, h) => a + h.amount, 0);

  const monthVariables = (gastosVariables || []).filter((g) => within(g.date));
  const totalVariables = monthVariables.reduce((a, g) => a + g.amount, 0);
  const categoryTotals = {};
  monthVariables.forEach((g) => {
    categoryTotals[g.categoria] = (categoryTotals[g.categoria] || 0) + g.amount;
  });
  const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const topCategory = topCategoryEntry ? { name: topCategoryEntry[0], total: topCategoryEntry[1] } : null;

  const goalContribs = goals.flatMap((g) => (g.history || []).filter((h) => within(h.date)));
  const totalSavedToGoals = goalContribs.reduce((a, h) => a + h.amount, 0);
  // Ahorro from an income never assigned to a goal doesn't show up in any goal's
  // history — count it here too, same treatment as the dashboard gives it.
  const unassignedAhorro = monthIncomes.reduce((a, i) => a + (!i.distribution?.goalId ? i.distribution?.ahorro || 0 : 0), 0);
  const totalAhorro = totalSavedToGoals + unassignedAhorro;

  const debtPayments = cards.flatMap((c) => (c.history || []).filter((h) => within(h.date)));
  const totalDebtPaid = debtPayments.reduce((a, h) => a + h.amount, 0);

  const goalsCompleted = goals
    .filter((g) => g.current >= g.target && (g.history || []).some((h) => within(h.date)))
    .map((g) => g.name);
  const debtsCleared = cards
    .filter((c) => c.balance <= 0 && (c.history || []).some((h) => within(h.date)))
    .map((c) => c.name);

  const netBalance = totalIncome - totalFixed - totalVariables - totalAhorro - totalDebtPaid;
  const hasActivity = totalIncome > 0 || totalFixed > 0 || totalVariables > 0 || totalAhorro > 0 || totalDebtPaid > 0;

  return {
    year,
    month,
    label: `${MONTH_LABELS_FULL[month]} ${year}`,
    totalIncome,
    incomeCount: monthIncomes.length,
    totalFixed,
    totalVariables,
    topCategory,
    totalAhorro,
    totalDebtPaid,
    netBalance,
    goalsCompleted,
    debtsCleared,
    hasActivity,
  };
}
