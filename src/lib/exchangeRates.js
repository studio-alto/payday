// Free, no-key exchange-rate API (daily-updated, ECB/central-bank sourced).
// Base is USD, so rates.COP is directly the usdRate; eurRate is derived via the
// USD->EUR cross rate since the API doesn't give COP-per-EUR directly.
export async function fetchLiveExchangeRates() {
  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  const json = await res.json();
  if (json.result !== 'success' || !json.rates?.COP || !json.rates?.EUR) {
    throw new Error('No se pudo obtener la tasa de cambio');
  }
  return {
    usdRate: Math.round(json.rates.COP),
    eurRate: Math.round(json.rates.COP / json.rates.EUR),
  };
}
