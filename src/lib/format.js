// Kept as module-level config (rather than a param on every fmt() call) so the ~30
// call sites across the app don't all need to thread the current rates through.
// App.jsx sets this from data.user on every render, before any screen reads fmt().
let rates = { USD: 4000, EUR: 4500 };

export function setExchangeRates(next) {
  rates = { ...rates, ...next };
}

export function fmt(amount, currency) {
  const n = amount || 0;
  if (currency === 'USD') {
    return '$' + (n / rates.USD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (currency === 'EUR') {
    return '€' + (n / rates.EUR).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + Math.round(n).toLocaleString('es-CO');
}
