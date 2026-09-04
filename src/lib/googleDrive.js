import { todayISO } from './dates';
import { buildBackupPayload } from './backup';

// Drive-specific half of the Google integration — see googleAuth.js for the
// shared sign-in (redirect flow, token storage) both this and googleCalendar.js
// build on.
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
// open to view it. Takes an already-fetched access token (see googleAuth.js).
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

// Builds the same Excel summary as the manual export and uploads it to Drive —
// shared by every "respaldar a Drive" entry point (Ajustes and the Home status
// card) so they all produce the exact same file instead of drifting apart.
export async function backupSummaryToDrive(accessToken, data) {
  // ExcelJS is a heavy library (~250KB gzipped) only this action needs — loaded on
  // demand so it doesn't bloat every screen's own chunk for a visit that never backs up.
  const { buildSummaryWorkbook } = await import('./exportExcel');
  const blob = await buildSummaryWorkbook(data);
  return uploadReportToDrive(accessToken, blob, `payday-resumen-${todayISO()}.xlsx`);
}

// The Excel report above is for a person to read, not for the app to read back —
// this is the machine-readable twin: the exact JSON restore shape, uploaded
// alongside it so "Restaurar datos" has something real to list and reapply.
export async function backupJsonToDrive(accessToken, data) {
  const folderId = await findOrCreatePaydayFolder(accessToken);
  const payload = buildBackupPayload(data);
  const filename = `payday-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const metadata = { name: filename, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!uploadRes.ok) throw new Error('No se pudo subir el respaldo a Drive.');
}

// Newest-first, capped at `limit` — just the file metadata (id/name/createdTime),
// not their contents (see downloadJsonBackupFromDrive for that, done lazily per file).
export async function listJsonBackupsInDrive(accessToken, limit = 3) {
  const folderId = await findOrCreatePaydayFolder(accessToken);
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType='application/json' and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=${limit}&fields=files(id,name,createdTime)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error('No se pudieron ver los respaldos en Drive.');
  const data = await res.json();
  return data.files || [];
}

// Fetches one backup's actual JSON content, for the pre-restore preview and for
// the restore itself — same file, so what you saw before confirming is what applies.
export async function downloadJsonBackupFromDrive(accessToken, fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('No se pudo descargar ese respaldo.');
  return res.json();
}
