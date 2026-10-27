import { daysUntilPayday, isoOffset, isSameMonth } from './dates';

const dayDiff = (a, b) => Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400000);

// When a fixed expense falls due next, as an ISO date — or null if it's already been
// paid this month and its day is still ahead (nothing left to remind about this month).
function nextDueDate(expense, now) {
  const date = isoOffset(daysUntilPayday(expense.dueDay, now), now);
  const paidThisMonth = (expense.history || []).some((h) => isSameMonth(h.date, now));
  if (paidThisMonth && isSameMonth(date, now)) return null;
  return date;
}

// What's coming up, soonest first: incomes still "por recibir", fixed expenses about to
// fall due, and the next payment date of each open debt. Drives the dashboard timeline.
export function upcomingEvents(data, now = new Date(), horizonDays = 30) {
  const today = isoOffset(0, now);
  const events = [];

  (data.incomes || []).forEach((i) => {
    if (i.estado === 'proyectado' && i.date >= today) {
      events.push({ id: `i-${i.id}`, kind: 'ingreso', date: i.date, title: i.name || 'Ingreso', amount: i.amount, metodo: i.metodo });
    }
  });

  (data.expenses || [])
    .filter((e) => !e.archived)
    .forEach((e) => {
      const date = nextDueDate(e, now);
      if (date) events.push({ id: `e-${e.id}`, kind: 'gasto', date, title: e.name, amount: e.amount, detail: 'Vence' });
    });

  (data.cards || [])
    .filter((c) => !c.archived && c.balance > 0 && c.nextPayment && c.nextPayment >= today)
    .forEach((c) => {
      events.push({ id: `c-${c.id}`, kind: 'deuda', date: c.nextPayment, title: c.name, amount: c.minPayment || 0, detail: 'Pago de deuda' });
    });

  return events
    .map((ev) => ({ ...ev, days: dayDiff(ev.date, today) }))
    .filter((ev) => ev.days <= horizonDays)
    .sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}

// Everything that happens on one specific day: money that came in, payments made, and
// (for today onward) what's due — what the calendar shows when a day is tapped.
export function eventsForDay(data, date, now = new Date()) {
  const today = isoOffset(0, now);
  const events = [];

  (data.incomes || []).forEach((i) => {
    if (i.date === date) {
      events.push({ id: `i-${i.id}`, kind: 'ingreso', date, title: i.name || 'Ingreso', amount: i.amount, metodo: i.metodo, detail: i.estado === 'proyectado' ? 'Por recibir' : 'Recibido' });
    }
  });

  (data.expenses || []).forEach((e) => {
    (e.history || []).forEach((h, idx) => {
      if (h.date === date) events.push({ id: `ep-${e.id}-${idx}`, kind: 'gasto', date, title: e.name, amount: h.amount, metodo: h.metodo, detail: 'Pagado' });
    });
  });

  (data.gastosVariables || []).forEach((g) => {
    if (g.date === date) events.push({ id: `v-${g.id}`, kind: 'gasto', date, title: g.name || g.categoria, amount: g.amount, metodo: g.metodo, detail: g.categoria });
  });

  (data.cards || []).forEach((c) => {
    (c.history || []).forEach((h, idx) => {
      if (h.date === date) events.push({ id: `cp-${c.id}-${idx}`, kind: 'deuda', date, title: c.name, amount: h.amount, metodo: h.metodo, detail: 'Abono' });
    });
  });

  if (date >= today) {
    (data.expenses || [])
      .filter((e) => !e.archived)
      .forEach((e) => {
        const due = nextDueDate(e, now);
        if (due === date) events.push({ id: `ed-${e.id}`, kind: 'gasto', date, title: e.name, amount: e.amount, detail: 'Vence' });
      });
    (data.cards || [])
      .filter((c) => !c.archived && c.balance > 0 && c.nextPayment === date)
      .forEach((c) => events.push({ id: `cd-${c.id}`, kind: 'deuda', date, title: c.name, amount: c.minPayment || 0, detail: 'Pago de deuda' }));
  }

  return events;
}
