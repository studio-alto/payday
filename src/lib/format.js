export function fmt(amount, currency) {
  const n = amount || 0;
  if (currency === 'USD') {
    return '$' + (n / 4000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (currency === 'EUR') {
    return '€' + (n / 4500).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + Math.round(n).toLocaleString('es-CO');
}
