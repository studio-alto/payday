// Shared Google sign-in for both Drive backup and Calendar reminders — the
// "middle ground" version of accounts: no backend, no user database, no
// passwords to manage. Uses a plain OAuth 2.0 implicit-flow redirect (not
// Google Identity Services' popup-based token client) because an
// installed/standalone PWA on iOS cannot open popup windows at all —
// window.open silently fails there, even on a direct tap. A full-page
// redirect to Google and back is just navigation, which standalone mode
// allows fine.
//
// One combined consent covers both scopes, each as narrow as Google allows:
// `drive.file` (only files this app creates, never the rest of Drive) and
// `calendar.events` (create/edit events, not read the rest of the calendar).
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/calendar.events'];
const TOKEN_KEY = 'payday_google_token';
// Survives across sessions (unlike the token itself) so a later reconnect knows
// it can try silently first instead of assuming this is a first-ever connect.
const CONNECTED_BEFORE_KEY = 'payday_google_connected_before';

export const googleConfigured = !!CLIENT_ID;

function redirectUri() {
  return window.location.origin + window.location.pathname;
}

function saveToken(accessToken, expiresIn) {
  const expiresAt = Date.now() + (Number(expiresIn) || 3600) * 1000;
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken, expiresAt }));
}

// A cached token is only good for the rest of this browser session (sessionStorage)
// and for its real ~1h lifetime — after that, connectGoogle() runs again.
export function getAccessToken() {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { accessToken, expiresAt } = JSON.parse(raw);
    return expiresAt > Date.now() + 30000 ? accessToken : null;
  } catch {
    return null;
  }
}

export function hasValidToken() {
  return !!getAccessToken();
}

// Actually revokes the grant with Google (not just forgetting the token locally) —
// otherwise hasConnectedBefore() would stay true and a later "Conectar" could
// silently reconnect via prompt=none without ever showing the consent screen again.
// Only possible while the ~1h access token is still valid, since the implicit flow
// never gives this app a refresh token to revoke with once that expires — in that
// case this still clears every local trace, it just can't reach Google to confirm.
export async function disconnectGoogle() {
  const accessToken = getAccessToken();
  if (accessToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch {
      // best-effort — even offline, still forget the connection below
    }
  }
  sessionStorage.removeItem(TOKEN_KEY);
  try {
    localStorage.removeItem(CONNECTED_BEFORE_KEY);
  } catch {
    // best-effort only
  }
}

// True once someone has ever completed the real (visible) consent screen on
// this device — lets a later reconnect (once the ~1h token expires) try a
// silent, invisible re-auth first instead of always showing Google's screen.
export function hasConnectedBefore() {
  try {
    return localStorage.getItem(CONNECTED_BEFORE_KEY) === '1';
  } catch {
    return false;
  }
}

// Call once when the app boots (before anything reads getAccessToken) — picks the
// access token out of the URL fragment Google appends after redirecting back, and
// strips it from the visible URL. Also records the outcome (for a silent attempt's
// caller to check after the page reload it causes) — see consumeRedirectResult().
export function consumeGoogleRedirect() {
  if (window.location.hash.includes('access_token=')) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');
    if (accessToken) {
      saveToken(accessToken, expiresIn);
      try {
        localStorage.setItem(CONNECTED_BEFORE_KEY, '1');
      } catch {
        // best-effort only — worst case, the next reconnect just isn't tried silently
      }
    }
    history.replaceState(null, '', window.location.pathname + window.location.search);
    try {
      sessionStorage.setItem('payday_google_redirect_result', 'connected');
    } catch {
      // best-effort
    }
  } else if (window.location.hash.includes('error=')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    try {
      sessionStorage.setItem('payday_google_redirect_result', 'error');
    } catch {
      // best-effort
    }
  }
}

// One-time read of what the most recent redirect round-trip produced — 'connected',
// 'error', or null (nothing pending). Consumes it so a later render doesn't act on
// a stale result.
export function consumeRedirectResult() {
  try {
    const value = sessionStorage.getItem('payday_google_redirect_result');
    if (value) sessionStorage.removeItem('payday_google_redirect_result');
    return value;
  } catch {
    return null;
  }
}

// Navigates the whole page to Google's consent screen — never returns (the app
// reloads fresh when Google redirects back). Call hasValidToken() first; only
// call this when it's false. Pass `silent: true` to try reconnecting invisibly
// (prompt=none) — works only if the browser's Google session and this app's
// prior grant are both still valid; otherwise Google redirects straight back
// with an error and no visible screen at all, so the caller should fall back
// to a normal (non-silent) connectGoogle() when consumeRedirectResult() is 'error'.
export function connectGoogle({ silent = false } = {}) {
  if (!googleConfigured) throw new Error('Google no está configurado todavía (falta VITE_GOOGLE_CLIENT_ID).');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('include_granted_scopes', 'true');
  if (silent) url.searchParams.set('prompt', 'none');
  window.location.href = url.toString();
}
