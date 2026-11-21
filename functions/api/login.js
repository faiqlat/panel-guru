import { checkPassword, makeSession, sessionCookie, clearCookie } from "../../lib/auth.js";

// Terima kata laluan, kemudian beri cookie sesi
export async function onRequestPost({ request, env }) {
  const { password } = await request.json().catch(() => ({}));
  if (!checkPassword(password, env)) {
    return new Response(JSON.stringify({ error: "Kata laluan salah." }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  const session = await makeSession(env);
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookie(session),
    },
  });
}

// Log keluar: padam cookie sesi
export async function onRequestDelete() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": clearCookie(),
    },
  });
}
