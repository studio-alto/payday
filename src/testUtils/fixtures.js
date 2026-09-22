// Minimal valid `data` shape every screen expects (see lib/storage.js's
// seedData()) — component tests build on top of this instead of each hand-rolling
// the full object and risking a missing field crashing render for unrelated reasons.
export function makeData(overrides = {}) {
  return {
    user: {
      currency: 'COP',
      theme: 'light',
      debtMethod: 'bola_nieve',
      onboarded: true,
      incomeMode: 'variable',
      ...overrides.user,
    },
    incomes: overrides.incomes || [],
    goals: overrides.goals || [],
    cards: overrides.cards || [],
    expenses: overrides.expenses || [],
    gastosVariables: overrides.gastosVariables || [],
    sueldosFijos: overrides.sueldosFijos || [],
  };
}
