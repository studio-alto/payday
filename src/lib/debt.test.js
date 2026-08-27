import { describe, it, expect } from 'vitest';
import {
  sortDebtsByPriority,
  computeDebtWaterfall,
  simulatePayoffPlan,
  formatMonthsLabel,
  monthlyPaidTotals,
  reverseIncomeEffects,
  applyIncomeEffects,
} from './debt';

const smallLow = { id: 'small_low', name: 'Chica, interés bajo', balance: 100, interestRate: 5 };
const bigHigh = { id: 'big_high', name: 'Grande, interés alto', balance: 500, interestRate: 30 };

describe('sortDebtsByPriority', () => {
  it('bola_nieve: smallest balance first', () => {
    const sorted = sortDebtsByPriority([bigHigh, smallLow], 'bola_nieve');
    expect(sorted.map((c) => c.id)).toEqual(['small_low', 'big_high']);
  });

  it('avalancha: highest interest rate first', () => {
    const sorted = sortDebtsByPriority([smallLow, bigHigh], 'avalancha');
    expect(sorted.map((c) => c.id)).toEqual(['big_high', 'small_low']);
  });
});

describe('computeDebtWaterfall', () => {
  const cards = [smallLow, bigHigh];

  it('a lump sum smaller than the priority debt goes entirely to it', () => {
    const { allocations, leftover } = computeDebtWaterfall(cards, 'bola_nieve', 50);
    expect(allocations).toEqual([{ cardId: 'small_low', name: 'Chica, interés bajo', amount: 50 }]);
    expect(leftover).toBe(0);
  });

  it('overflow rolls from the paid-off priority debt to the next one', () => {
    const { allocations, leftover } = computeDebtWaterfall(cards, 'bola_nieve', 150);
    expect(allocations).toEqual([
      { cardId: 'small_low', name: 'Chica, interés bajo', amount: 100 },
      { cardId: 'big_high', name: 'Grande, interés alto', amount: 50 },
    ]);
    expect(leftover).toBe(0);
  });

  it('reports leftover when the amount exceeds total debt', () => {
    const { allocations, leftover } = computeDebtWaterfall(cards, 'bola_nieve', 700);
    expect(allocations.reduce((a, x) => a + x.amount, 0)).toBe(600);
    expect(leftover).toBe(100);
  });

  it('avalancha attacks the highest interest rate first, not the smallest balance', () => {
    const { allocations } = computeDebtWaterfall(cards, 'avalancha', 50);
    expect(allocations).toEqual([{ cardId: 'big_high', name: 'Grande, interés alto', amount: 50 }]);
  });

  it('no debt left to pay: empty allocations, full leftover', () => {
    const { allocations, leftover } = computeDebtWaterfall([{ ...smallLow, balance: 0 }], 'bola_nieve', 100);
    expect(allocations).toEqual([]);
    expect(leftover).toBe(100);
  });
});

describe('simulatePayoffPlan', () => {
  it('no debt: pays off immediately, no simulation needed', () => {
    const plan = simulatePayoffPlan([{ ...smallLow, balance: 0 }], 'bola_nieve', 0);
    expect(plan).toEqual({ monthsToPayoff: 0, stuck: false, perCard: [] });
  });

  it('a minimum payment that exactly covers the balance pays it off in one month', () => {
    const plan = simulatePayoffPlan([{ id: 'a', name: 'A', balance: 1000, interestRate: 0, minPayment: 1000 }], 'bola_nieve', 0);
    expect(plan.monthsToPayoff).toBe(1);
    expect(plan.perCard).toEqual([{ id: 'a', name: 'A', payoffMonth: 1 }]);
  });

  it('no interest, fixed minimum payment: months = balance / minPayment', () => {
    const plan = simulatePayoffPlan([{ id: 'a', name: 'A', balance: 1000, interestRate: 0, minPayment: 100 }], 'bola_nieve', 0);
    expect(plan.monthsToPayoff).toBe(10);
    expect(plan.stuck).toBe(false);
  });

  it('an extra monthly payment shortens the payoff time', () => {
    const plan = simulatePayoffPlan([{ id: 'a', name: 'A', balance: 1000, interestRate: 0, minPayment: 100 }], 'bola_nieve', 100);
    expect(plan.monthsToPayoff).toBe(5);
  });

  it('gets stuck when the minimum payment never covers the interest', () => {
    const plan = simulatePayoffPlan([{ id: 'a', name: 'A', balance: 1000, interestRate: 1000, minPayment: 1 }], 'bola_nieve', 0);
    expect(plan.stuck).toBe(true);
    expect(plan.monthsToPayoff).toBeNull();
  });

  it('bola_nieve pays off the smaller debt first even if the extra could clear the bigger one faster', () => {
    const cards = [
      { id: 'small', name: 'Small', balance: 100, interestRate: 0, minPayment: 0 },
      { id: 'big', name: 'Big', balance: 1000, interestRate: 0, minPayment: 0 },
    ];
    const plan = simulatePayoffPlan(cards, 'bola_nieve', 100);
    const small = plan.perCard.find((c) => c.id === 'small');
    const big = plan.perCard.find((c) => c.id === 'big');
    expect(small.payoffMonth).toBeLessThan(big.payoffMonth);
  });
});

describe('formatMonthsLabel', () => {
  it.each([
    [0, 'Ya no tienes deudas'],
    [1, '1 mes'],
    [5, '5 meses'],
    [12, '1 año'],
    [14, '1 año y 2 meses'],
    [24, '2 años'],
  ])('formatMonthsLabel(%i) -> %s', (months, expected) => {
    expect(formatMonthsLabel(months)).toBe(expected);
  });
});

describe('monthlyPaidTotals', () => {
  it('buckets payment history by month within the window and ignores dates outside it', () => {
    const cards = [
      {
        history: [
          { date: '2026-05-01', amount: 999 }, // outside the 3-month window below
          { date: '2026-07-15', amount: 100 },
          { date: '2026-08-01', amount: 50 },
        ],
      },
    ];
    const result = monthlyPaidTotals(cards, 3, new Date(2026, 7, 27));
    expect(result.map((m) => m.total)).toEqual([0, 100, 50]);
    expect(result.map((m) => m.label)).toEqual(['Jun', 'Jul', 'Ago']);
  });
});

describe('applyIncomeEffects / reverseIncomeEffects round-trip', () => {
  it('reversing an applied income restores goals and cards to their original state', () => {
    const goals = [{ id: 'g1', current: 0, target: 1000 }];
    const cards = [{ id: 'c1', name: 'Tarjeta', balance: 500, interestRate: 0, minPayment: 0, history: [] }];
    const income = {
      id: 'i1',
      name: 'Test',
      date: '2026-08-01',
      distribution: { ahorro: 100, tarjeta: 200, goalId: 'g1' },
    };

    const applied = applyIncomeEffects(income, goals, cards, 'bola_nieve');
    expect(applied.goals[0].current).toBe(100);
    expect(applied.cards[0].balance).toBe(300);
    expect(applied.cards[0].history).toHaveLength(1);

    const appliedIncome = { ...income, distribution: { ...income.distribution, debtAllocations: applied.debtAllocations } };
    const reversed = reverseIncomeEffects(appliedIncome, applied.goals, applied.cards);

    expect(reversed.goals[0].current).toBe(0);
    expect(reversed.cards[0].balance).toBe(500);
    expect(reversed.cards[0].history).toEqual([]);
  });
});
