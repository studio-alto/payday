export const METHODS = [
  { key: 'bola_nieve', label: 'Bola de nieve', hint: 'Prioriza el saldo más pequeño primero' },
  { key: 'avalancha', label: 'Avalancha', hint: 'Prioriza la tasa de interés más alta primero' },
];

const MONTH_LABELS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Total abonado (sum of every card's payment history) per month, for the last
// `monthsBack` months ending this month — used to chart the recent payment trend.
export function monthlyPaidTotals(cards, monthsBack = 6, ref = new Date()) {
  const months = Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(ref.getFullYear(), ref.getMonth() - (monthsBack - 1 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: MONTH_LABELS_SHORT[d.getMonth()], total: 0 };
  });
  cards.forEach((c) => {
    c.history.forEach((h) => {
      const d = new Date(h.date + 'T00:00:00');
      const bucket = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth());
      if (bucket) bucket.total += h.amount;
    });
  });
  return months;
}

export function sortDebtsByPriority(cards, method) {
  return [...cards].sort((a, b) => {
    if (method === 'avalancha') return (b.interestRate || 0) - (a.interestRate || 0);
    return a.balance - b.balance;
  });
}

// Waterfall: all of `amount` goes to the top-priority debt until it's paid off,
// then the overflow rolls to the next one — how snowball/avalanche actually work for a lump sum.
export function computeDebtWaterfall(cards, method, amount) {
  const sorted = sortDebtsByPriority(cards, method).filter((c) => c.balance > 0);
  let remaining = amount;
  const allocations = [];
  for (const c of sorted) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, c.balance);
    if (applied > 0) {
      allocations.push({ cardId: c.id, name: c.name, amount: applied });
      remaining -= applied;
    }
  }
  return { allocations, leftover: remaining };
}

// Simulates paying off all debts month by month: interest accrues, minimum payments
// keep every card current, and `extraMonthly` rolls down the priority order (paying
// off the top debt first, then spilling onto the next one), same as the waterfall
// above but repeated over time instead of for a single lump sum.
export function simulatePayoffPlan(cards, method, extraMonthly) {
  const MAX_MONTHS = 360;
  const working = cards
    .filter((c) => c.balance > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      balance: c.balance,
      minPayment: c.minPayment || 0,
      interestRate: c.interestRate || 0,
      monthlyRate: c.interestRate > 0 ? Math.pow(1 + c.interestRate / 100, 1 / 12) - 1 : 0,
      payoffMonth: null,
    }));

  if (working.length === 0) {
    return { monthsToPayoff: 0, stuck: false, perCard: [] };
  }

  let month = 0;
  while (working.some((c) => c.balance > 0.01) && month < MAX_MONTHS) {
    month++;
    working.forEach((c) => {
      if (c.balance > 0) c.balance += c.balance * c.monthlyRate;
    });
    working.forEach((c) => {
      if (c.balance > 0) c.balance -= Math.min(c.minPayment, c.balance);
    });
    let extra = extraMonthly;
    const open = working
      .filter((c) => c.balance > 0.01)
      .sort((a, b) => (method === 'avalancha' ? b.interestRate - a.interestRate : a.balance - b.balance));
    for (const c of open) {
      if (extra <= 0) break;
      const pay = Math.min(extra, c.balance);
      c.balance -= pay;
      extra -= pay;
    }
    working.forEach((c) => {
      if (c.balance <= 0.01 && c.payoffMonth === null) c.payoffMonth = month;
    });
  }

  const stuck = working.some((c) => c.balance > 0.01);
  return {
    monthsToPayoff: stuck ? null : month,
    stuck,
    perCard: [...working].sort((a, b) => (a.payoffMonth ?? Infinity) - (b.payoffMonth ?? Infinity)).map((c) => ({ id: c.id, name: c.name, payoffMonth: c.payoffMonth })),
  };
}

// Interest accruing on the balance right now, per month, at the card's rate — a concrete
// "carrying this debt costs you about $X every month" figure, independent of any plan.
export function monthlyInterestCost(card) {
  if (!(card.balance > 0) || !(card.interestRate > 0)) return 0;
  const monthlyRate = Math.pow(1 + card.interestRate / 100, 1 / 12) - 1;
  return Math.round(card.balance * monthlyRate);
}

// Simulates one card being paid off in isolation — same monthly-compounding mechanics as
// simulatePayoffPlan (interest accrues, then the minimum payment, then any extra), but
// tracks how much of everything paid ends up being interest instead of just the payoff month.
export function simulateCardPayoff(card, extraMonthly = 0) {
  if (!(card.balance > 0)) return { monthsToPayoff: 0, totalInterest: 0, stuck: false };
  const MAX_MONTHS = 360;
  const monthlyRate = card.interestRate > 0 ? Math.pow(1 + card.interestRate / 100, 1 / 12) - 1 : 0;
  let balance = card.balance;
  let month = 0;
  let totalInterest = 0;
  while (balance > 0.01 && month < MAX_MONTHS) {
    month++;
    const interest = balance * monthlyRate;
    balance += interest;
    totalInterest += interest;
    balance -= Math.min(card.minPayment || 0, balance);
    balance -= Math.min(extraMonthly, balance);
  }
  const stuck = balance > 0.01;
  return { monthsToPayoff: stuck ? null : month, totalInterest: Math.round(totalInterest), stuck };
}

export function formatMonthsLabel(months) {
  if (months === 0) return 'Ya no tienes deudas';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const y = years > 0 ? `${years} ${years === 1 ? 'año' : 'años'}` : '';
  const m = rem > 0 ? `${rem} ${rem === 1 ? 'mes' : 'meses'}` : '';
  return [y, m].filter(Boolean).join(' y ');
}

// Undoes what applyIncomeEffects did for this income: gives the ahorro back
// off its goal, and gives each debt allocation back onto its card's balance.
export function reverseIncomeEffects(income, goals, cards) {
  const { ahorro, goalId, debtAllocations } = income.distribution;
  let newGoals = goals;
  let newCards = cards;

  if (goalId && ahorro) {
    newGoals = goals.map((g) => (g.id === goalId ? { ...g, current: g.current - ahorro } : g));
  }
  if (debtAllocations && debtAllocations.length) {
    newCards = cards.map((c) => {
      const alloc = debtAllocations.find((a) => a.cardId === c.id);
      if (!alloc) return c;
      return { ...c, balance: c.balance + alloc.amount, history: c.history.filter((h) => h.incomeId !== income.id) };
    });
  }
  return { goals: newGoals, cards: newCards };
}

// Adds the ahorro amount onto its chosen goal, and runs the debt waterfall against
// `cards`, applying each allocation as a tagged payment. Returns the debtAllocations
// actually applied so the caller can store them on the income for a future reversal.
export function applyIncomeEffects(income, goals, cards, debtMethod) {
  const { ahorro, tarjeta, goalId } = income.distribution;

  const newGoals = goalId && ahorro > 0 ? goals.map((g) => (g.id === goalId ? { ...g, current: g.current + ahorro } : g)) : goals;

  const { allocations } = computeDebtWaterfall(cards, debtMethod, tarjeta);
  const newCards = cards.map((c) => {
    const alloc = allocations.find((a) => a.cardId === c.id);
    if (!alloc) return c;
    return {
      ...c,
      balance: Math.max(0, c.balance - alloc.amount),
      history: [...c.history, { date: income.date, amount: alloc.amount, note: `Automático · ${income.name || 'Ingreso'}`, incomeId: income.id }],
    };
  });

  return { goals: newGoals, cards: newCards, debtAllocations: allocations.map(({ cardId, amount }) => ({ cardId, amount })) };
}
