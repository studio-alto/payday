// Not meant to resist a determined attacker with access to the device's storage —
// there's no server to make that meaningful. The actual threat this defends against
// is someone else picking up an already-unlocked phone and opening the app; hashing
// just avoids leaving the PIN sitting in localStorage as plain text.
export async function hashPin(pin) {
  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
