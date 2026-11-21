// Login dengan kata laluan + cookie sesi yang ditandatangani (HMAC)
const enc = new TextEncoder();
const COOKIE = "pg_session";
const MAX_AGE = 8 * 3600; // 8 jam

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

// Bandingkan dua teks dengan masa yang sama, supaya tak mudah diteka
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkPassword(input, env) {
  if (!env.APP_PASSWORD) return false;
  return safeEqual(String(input || ""), String(env.APP_PASSWORD));
}

export async function makeSession(env) {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET belum ditetapkan");
  const payload = String(Date.now() + MAX_AGE * 1000);
  const sig = toHex(await crypto.subtle.sign("HMAC", await hmacKey(env.SESSION_SECRET), enc.encode(payload)));
  return `${payload}.${sig}`;
}

export function sessionCookie(value) {
  return `${COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export async function requireUser(request, env) {
  if (!env.SESSION_SECRET) return null;
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig) return null;
  const expected = toHex(await crypto.subtle.sign("HMAC", await hmacKey(env.SESSION_SECRET), enc.encode(payload)));
  if (!safeEqual(sig, expected)) return null;
  if (Number(payload) < Date.now()) return null;
  return { user: "owner" };
}
