// How money was received or paid. Stored on each record as the plain label (`metodo`),
// empty/missing when the person didn't say — optional everywhere, so entries from
// before this existed (or restored from an older backup) keep working untouched.
export const PAYMENT_METHODS = ['Efectivo', 'Nequi', 'Daviplata', 'Transferencia', 'Bre-b'];

// Only ever returns a known method (or ''), so a hand-edited backup can't put an
// arbitrary string into a chip row, a summary or a filter.
export function normalizeMethod(value) {
  return PAYMENT_METHODS.includes(value) ? value : '';
}

// Total per payment method for a list of { amount, metodo } records, in the fixed
// method order, skipping methods with no money. Records with no method are grouped
// as "Sin método" at the end, so the breakdown always adds up to the full total.
export function totalsByMethod(records) {
  const totals = new Map();
  records.forEach((r) => {
    const key = normalizeMethod(r.metodo) || 'Sin método';
    totals.set(key, (totals.get(key) || 0) + (r.amount || 0));
  });
  const ordered = [...PAYMENT_METHODS, 'Sin método'];
  return ordered.filter((m) => totals.get(m) > 0).map((method) => ({ method, total: totals.get(method) }));
}
