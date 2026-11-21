import { requireUser } from "../lib/auth.js";

// Laluan ini boleh dibuka tanpa log masuk
const TERBUKA = ["/api/login"];

// Semua laluan /api/* lain mesti ada sesi yang sah
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith("/api/") && !TERBUKA.includes(url.pathname)) {
    const user = await requireUser(context.request, context.env);
    if (!user) {
      return new Response(JSON.stringify({ error: "Sila log masuk dahulu." }), {
        status: 401,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
  }
  return context.next();
}
