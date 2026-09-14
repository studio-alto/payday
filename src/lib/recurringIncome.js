import { uid } from './id';
import { daysUntilPayday, isoOffset, isSameMonth } from './dates';

// Next occurrence of a recurring salary's payday — this month's if it hasn't
// passed yet, otherwise next month's (same lookahead daysUntilPayday already
// does for gastos fijos and the "Próximo pago" card on Inicio).
export function nextOccurrenceDate(payDayOfMonth) {
  return isoOffset(daysUntilPayday(payDayOfMonth));
}

// Sueldos fijos are recurring *definitions* (name, amount, payday, reparto por
// defecto) — same shape as gastos fijos. But unlike a gasto fijo (which just gets
// checked live against `history` for "paid this month"), an income needs a real
// entry in `incomes` to flow through everything that already exists: the
// "ingresos por confirmar" card, applyIncomeEffects on confirm, monthlyRecap, Excel
// export. This makes sure exactly one `proyectado` income exists per sueldo fijo
// for its current pay cycle, tagged with `recurringId` so it isn't duplicated on
// the next check. Returns the same `data` reference untouched if nothing's missing,
// so calling this on every load is cheap and safe to feed straight into setData.
export function ensureRecurringIncomes(data) {
  const sueldosFijos = data.sueldosFijos || [];
  if (sueldosFijos.length === 0) return data;

  let incomes = data.incomes;
  let changed = false;

  sueldosFijos.forEach((sf) => {
    const targetDate = nextOccurrenceDate(sf.payDayOfMonth);
    const alreadyExists = incomes.some((i) => i.recurringId === sf.id && isSameMonth(i.date, new Date(targetDate + 'T00:00:00')));
    if (alreadyExists) return;
    changed = true;
    const ahorro = Math.round(sf.amount * ((sf.ahorroPct || 0) / 100));
    const tarjeta = Math.round(sf.amount * ((sf.tarjetaPct || 0) / 100));
    incomes = [
      ...incomes,
      {
        id: uid(),
        name: sf.name,
        amount: sf.amount,
        date: targetDate,
        type: 'mensual',
        note: '',
        estado: 'proyectado',
        recurringId: sf.id,
        distribution: { ahorro, tarjeta, goalId: sf.goalId || null, debtAllocations: [] },
      },
    ];
  });

  return changed ? { ...data, incomes } : data;
}
