// Google Drive upload — the "middle ground" version of accounts: no backend, no
// user database, no passwords to manage. Uses a plain OAuth 2.0 implicit-flow
// redirect (not Google Identity Services' popup-based token client) because an
// installed/standalone PWA on iOS cannot open popup windows at all — window.open
// silently fails there, even on a direct tap. A full-page redirect to Google and
// back is just navigation, which standalone mode allows fine.
//
// Scope is `drive.file`: the app can only see/manage files it creates itself,
// never the rest of the person's Drive.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_KEY = 'payday_drive_token';

export const driveConfigured = !!CLIENT_ID;

function redirectUri() {
  return window.location.origin + window.location.pathname;
}

function saveToken(accessToken, expiresIn) {
  const expiresAt = Date.now() + (Number(expiresIn) || 3600) * 1000;
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken, expiresAt }));
}

// A cached token is only good for the rest of this browser session (sessionStorage)
// and for its real ~1h lifetime — after that, connectDrive() runs again.
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

export function disconnectDrive() {
  sessionStorage.removeItem(TOKEN_KEY);
}

// Call once when the app boots (before anything reads getAccessToken) — picks the
// access token out of the URL fragment Google appends after redirecting back, and
// strips it from the visible URL.
export function consumeDriveRedirect() {
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
export function connectDrive() {
  if (!driveConfigured) throw new Error('Google Drive no está configurado todavía (falta VITE_GOOGLE_CLIENT_ID).');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('include_granted_scopes', 'true');
  window.location.href = url.toString();
}

async function findOrCreatePaydayFolder(accessToken) {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and name='Payday' and trashed=false");
  const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) throw new Error('No se pudo buscar la carpeta de Payday en Drive.');
  const listData = await listRes.json();
  if (listData.files?.length > 0) return listData.files[0].id;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Payday', mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!createRes.ok) throw new Error('No se pudo crear la carpeta de Payday en Drive.');
  const createData = await createRes.json();
  return createData.id;
}

// Uploads the blob into the person's own "Payday" Drive folder (created on first
// use) and returns a link they (and only they — the file isn't made public) can
// open to view it. Takes an already-fetched access token (see getAccessToken).
export async function uploadReportToDrive(accessToken, blob, filename) {
  const folderId = await findOrCreatePaydayFolder(accessToken);

  const metadata = { name: filename, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form },
  );
  if (!uploadRes.ok) throw new Error('No se pudo subir el archivo a Drive.');
  const data = await uploadRes.json();
  return data.webViewLink;
}
