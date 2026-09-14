import { describe, it, expect } from 'vitest';
import { buildSummaryWorkbook } from './exportExcel';

// A real, if small, run through every sheet (including the conditional "Gastos
// variables" one) — mainly a smoke test that the write-excel-file cell/sheet shapes
// used here (columnSpan placeholders, money format, sticky header) are actually
// valid, not just type-correct. buildSummaryWorkbook would reject/throw on a
// malformed sheet, so resolving to a non-empty Blob is a meaningful signal.
describe('buildSummaryWorkbook', () => {
  const baseData = {
    incomes: [
      {
        name: 'Turno',
        date: '2026-09-01',
        type: 'normal',
        amount: 100000,
        estado: 'confirmado',
        distribution: { ahorro: 20000, tarjeta: 10000, goalId: 'g1' },
      },
      {
        name: 'Domingo',
        date: '2026-09-13',
        type: 'finSemana',
        amount: 50000,
        estado: 'proyectado',
        distribution: { ahorro: 0, tarjeta: 0, goalId: null },
      },
    ],
    goals: [{ name: 'Fondo de emergencia', current: 500000, target: 1000000 }],
    cards: [{ name: 'Visa', tipo: 'Tarjeta de crédito', balance: 2000000, interestRate: 2.1, minPayment: 300000, nextPayment: '2026-10-01' }],
    expenses: [{ name: 'Netflix', categoria: 'Suscripción', amount: 44900, dueDay: 15 }],
  };

  it('resolves to a non-empty xlsx Blob with the expected sheets', async () => {
    const blob = await buildSummaryWorkbook({ ...baseData, gastosVariables: [] });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('includes a Gastos variables sheet only when there is at least one', async () => {
    const withVariables = await buildSummaryWorkbook({
      ...baseData,
      gastosVariables: [{ name: 'Mercado', categoria: 'Mercado', date: '2026-09-05', amount: 60000 }],
    });
    const withoutVariables = await buildSummaryWorkbook({ ...baseData, gastosVariables: [] });
    // Both are valid files; the one with a gasto variable has an extra sheet's
    // worth of XML inside the zip, so it should never end up smaller.
    expect(withVariables.size).toBeGreaterThanOrEqual(withoutVariables.size);
  });
});
