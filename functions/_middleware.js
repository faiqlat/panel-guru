import { requireUser } from "../lib/auth.js";

// Semua laluan /api/* mesti lulus pengesahan Access
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith("/api/")) {
    const user = await requireUser(context.request, context.env);
    if (!user) return new Response("Tidak dibenarkan", { status: 401 });
  }
  return context.next();
}
