import { fmt } from './format';
import { daysUntilPayday, isoOffset } from './dates';

// Calendar-specific half of the Google integration — see googleAuth.js for the
// shared sign-in this builds on.

// Google Calendar event IDs only allow lowercase base32hex characters (0-9, a-v),
// 5-1024 of them. A deterministic id per source record (debt, gasto fijo, or
// income) lets a re-sync update the same event instead of creating duplicates
// every time someone taps "Sincronizar". djb2's hash happens to be exactly the
// kind of number toString(32) renders in that same 0-9a-v alphabet.
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(32);
}

function eventId(type, sourceId) {
  return `pd${type}${djb2(`${type}:${sourceId}`)}`;
}

// All-day events need an exclusive end date (the day after start).
function addOneDay(dateISO) {
  return isoOffset(1, new Date(dateISO + 'T00:00:00'));
}

async function upsertEvent(accessToken, id, event) {
  const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const putRes = await fetch(`${base}/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (putRes.ok) return;
  if (putRes.status !== 404 && putRes.status !== 410) {
    throw new Error(`No se pudo actualizar el evento "${event.summary}" en Calendar.`);
  }
  const postRes = await fetch(base, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...event, id }),
  });
  if (!postRes.ok) throw new Error(`No se pudo crear el evento "${event.summary}" en Calendar.`);
}

export function buildEvents(data) {
  const currency = data.user.currency;
  const events = [];

  data.cards
    .filter((c) => c.balance > 0 && c.nextPayment)
    .forEach((c) => {
      events.push({
        id: eventId('d', c.id),
        summary: `Pago: ${c.name}`,
        description: `Cuota: ${fmt(c.minPayment || 0, currency)} · Saldo pendiente: ${fmt(c.balance, currency)} — desde Payday`,
        start: { date: c.nextPayment },
        end: { date: addOneDay(c.nextPayment) },
      });
    });

  data.expenses.forEach((e) => {
    const nextDate = isoOffset(daysUntilPayday(e.dueDay));
    events.push({
      id: eventId('e', e.id),
      summary: `Vence: ${e.name}`,
      description: `${e.categoria || 'Gasto fijo'} · ${fmt(e.amount, currency)} — desde Payday`,
      start: { date: nextDate },
      end: { date: addOneDay(nextDate) },
    });
  });

  data.incomes
    .filter((i) => i.estado === 'proyectado')
    .forEach((i) => {
      events.push({
        id: eventId('i', i.id),
        summary: `Ingreso esperado: ${i.name || 'Ingreso'}`,
        description: `${fmt(i.amount, currency)} — desde Payday`,
        start: { date: i.date },
        end: { date: addOneDay(i.date) },
      });
    });

  return events;
}

// Upserts one Calendar event per debt (next payment), gasto fijo (next due date),
// and proyectado income (expected date) — deterministic ids mean running this
// again just updates the same events instead of duplicating them. Returns how
// many were synced.
export async function syncFinancialEventsToCalendar(accessToken, data) {
  const events = buildEvents(data);
  for (const { id, ...event } of events) {
    await upsertEvent(accessToken, id, event);
  }
  return events.length;
}
