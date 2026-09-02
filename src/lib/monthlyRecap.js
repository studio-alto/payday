const MONTH_LABELS_FULL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function inMonth(dateStr, year, month) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  return d.getFullYear() === year && d.getMonth() === month;
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
export function computeMonthlyRecap(data, year, month) {
  const { incomes, goals, cards, expenses, gastosVariables } = data;

  const monthIncomes = incomes.filter((i) => i.estado !== 'proyectado' && inMonth(i.date, year, month));
  const totalIncome = monthIncomes.reduce((a, i) => a + i.amount, 0);

  const fixedPaid = expenses.flatMap((e) => (e.history || []).filter((h) => inMonth(h.date, year, month)));
  const totalFixed = fixedPaid.reduce((a, h) => a + h.amount, 0);

  const monthVariables = (gastosVariables || []).filter((g) => inMonth(g.date, year, month));
  const totalVariables = monthVariables.reduce((a, g) => a + g.amount, 0);
  const categoryTotals = {};
  monthVariables.forEach((g) => {
    categoryTotals[g.categoria] = (categoryTotals[g.categoria] || 0) + g.amount;
  });
  const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const topCategory = topCategoryEntry ? { name: topCategoryEntry[0], total: topCategoryEntry[1] } : null;

  const goalContribs = goals.flatMap((g) => (g.history || []).filter((h) => inMonth(h.date, year, month)));
  const totalSavedToGoals = goalContribs.reduce((a, h) => a + h.amount, 0);
  // Ahorro from an income never assigned to a goal doesn't show up in any goal's
  // history — count it here too, same treatment as the dashboard gives it.
  const unassignedAhorro = monthIncomes.reduce((a, i) => a + (!i.distribution?.goalId ? i.distribution?.ahorro || 0 : 0), 0);
  const totalAhorro = totalSavedToGoals + unassignedAhorro;

  const debtPayments = cards.flatMap((c) => (c.history || []).filter((h) => inMonth(h.date, year, month)));
  const totalDebtPaid = debtPayments.reduce((a, h) => a + h.amount, 0);

  const goalsCompleted = goals
    .filter((g) => g.current >= g.target && (g.history || []).some((h) => inMonth(h.date, year, month)))
    .map((g) => g.name);
  const debtsCleared = cards
    .filter((c) => c.balance <= 0 && (c.history || []).some((h) => inMonth(h.date, year, month)))
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
