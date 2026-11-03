// Amounts can carry cents (see MoneyInput), and adding/subtracting them in plain
// floats leaves noise like 0.30000000000000004 — every write that does money math
// on a stored balance goes through this so what's saved is always a clean 2 decimals.
export const round2 = (n) => Math.round(n * 100) / 100;

// True when the amount carries a real cents part someone typed or saved (1850000.5,
// 120.25) — and not for ratios that merely happen to be fractional (14583.333…, a
// daily savings pace), which keep rounding to whole pesos when displayed.
export const hasCents = (n) => {
  const cents = n * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-6 && Math.abs(n - Math.round(n)) >= 0.005;
};
