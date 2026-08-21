export const METHODS = [
  { key: 'bola_nieve', label: 'Bola de nieve', hint: 'Prioriza el saldo más pequeño primero' },
  { key: 'avalancha', label: 'Avalancha', hint: 'Prioriza la tasa de interés más alta primero' },
];

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
