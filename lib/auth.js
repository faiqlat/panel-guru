// Sahkan JWT daripada Cloudflare Access. Jika gagal, pengguna ditolak.
let keyCache = { at: 0, keys: [] };

const b64u = (s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};

async function getKeys(env) {
  if (Date.now() - keyCache.at > 3600e3) {
    const r = await fetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
    keyCache = { at: Date.now(), keys: (await r.json()).keys };
  }
  return keyCache.keys;
}

export async function requireUser(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return null;
  try {
    const [h, p, s] = token.split(".");
    const header = JSON.parse(new TextDecoder().decode(b64u(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64u(p)));

    if (payload.exp * 1000 < Date.now()) return null;
    if (![].concat(payload.aud).includes(env.ACCESS_AUD)) return null;

    const allowed = (env.ALLOWED_EMAIL || "").split(",").map((x) => x.trim().toLowerCase());
    if (!allowed.includes((payload.email || "").toLowerCase())) return null;

    const jwk = (await getKeys(env)).find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, b64u(s), new TextEncoder().encode(`${h}.${p}`)
    );
    return ok ? payload : null;
  } catch {
    return null;
  }
}
