// Guna refresh token akaun Google awak (Drive awak sendiri)
export async function accessToken(env) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("Token Google gagal: " + JSON.stringify(j));
  return j.access_token;
}

async function api(env, path, opts = {}) {
  const t = await accessToken(env);
  const r = await fetch("https://www.googleapis.com" + path, {
    ...opts,
    headers: { Authorization: `Bearer ${t}`, ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`Drive ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function ensureFolder(env, name, parentId) {
  const safe = name.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `name='${safe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const found = await api(env, `/drive/v3/files?q=${q}&fields=files(id)&supportsAllDrives=true`);
  if (found.files?.length) return found.files[0].id;

  const created = await api(env, `/drive/v3/files?supportsAllDrives=true&fields=id`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  return created.id;
}

// ensurePath(env, ["Gambar", "2026-11"]) → cipta folder jika belum ada
export async function ensurePath(env, parts) {
  let id = env.DRIVE_ROOT_ID;
  for (const p of parts) id = await ensureFolder(env, p, id);
  return id;
}

export async function findByPrefix(env, prefix, parentId) {
  const safe = prefix.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `name contains '${safe}' and '${parentId}' in parents and trashed=false`
  );
  const r = await api(env, `/drive/v3/files?q=${q}&fields=files(id,name)&supportsAllDrives=true`);
  return r.files?.[0] || null;
}

export async function uploadFile(env, { name, mime, bytes, parentId }) {
  const boundary = "b" + crypto.randomUUID();
  const meta = JSON.stringify({ name, parents: [parentId] });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
    bytes,
    `\r\n--${boundary}--`,
  ]);
  return api(
    env,
    `/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`,
    { method: "POST", headers: { "content-type": `multipart/related; boundary=${boundary}` }, body }
  );
}
