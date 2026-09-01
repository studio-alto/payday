// Google Drive upload — the "middle ground" version of accounts: no backend, no
// user database, no passwords to manage. Google Identity Services hands the app a
// short-lived access token scoped to `drive.file` (the app can only see/manage
// files it creates itself, never the rest of the person's Drive), entirely from
// the browser. See the project setup notes for how to create VITE_GOOGLE_CLIENT_ID.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

export const driveConfigured = !!CLIENT_ID;

let gisLoadPromise = null;
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services.'));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

// Not persisted across reloads on purpose — this is an occasional, user-initiated
// action (not a background sync), so a fresh consent prompt each session is fine
// and avoids the complexity of storing/refreshing long-lived tokens client-side.
let cachedToken = null;

async function requestAccessToken() {
  if (!driveConfigured) throw new Error('Google Drive no está configurado todavía (falta VITE_GOOGLE_CLIENT_ID).');
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) return cachedToken.accessToken;

  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(resp.error));
          return;
        }
        cachedToken = { accessToken: resp.access_token, expiresAt: Date.now() + (resp.expires_in || 3600) * 1000 };
        resolve(resp.access_token);
      },
      error_callback: (err) => reject(new Error(err?.message || 'No se pudo conectar con Google.')),
    });
    client.requestAccessToken();
  });
}

export function disconnectDrive() {
  if (cachedToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(cachedToken.accessToken, () => {});
  }
  cachedToken = null;
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
// open to view it.
export async function uploadReportToDrive(blob, filename) {
  const accessToken = await requestAccessToken();
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
