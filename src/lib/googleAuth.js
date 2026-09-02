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

export function disconnectGoogle() {
  sessionStorage.removeItem(TOKEN_KEY);
}

// Call once when the app boots (before anything reads getAccessToken) — picks the
// access token out of the URL fragment Google appends after redirecting back, and
// strips it from the visible URL.
export function consumeGoogleRedirect() {
  if (!window.location.hash.includes('access_token=')) return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');
  if (accessToken) saveToken(accessToken, expiresIn);
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

// Navigates the whole page to Google's consent screen — never returns (the app
// reloads fresh when Google redirects back). Call hasValidToken() first; only
// call this when it's false.
export function connectGoogle() {
  if (!googleConfigured) throw new Error('Google no está configurado todavía (falta VITE_GOOGLE_CLIENT_ID).');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('include_granted_scopes', 'true');
  window.location.href = url.toString();
}
