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
