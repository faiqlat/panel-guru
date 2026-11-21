export const text = (t) => ({ text: t });
export const image = (b64, mime) => ({ inline_data: { mime_type: mime, data: b64 } });

export async function gemini(env, parts, { json = false } = {}) {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: json ? { responseMimeType: "application/json" } : {},
      }),
    }
  );
  const j = await r.json();
  if (!r.ok) throw new Error("Gemini: " + JSON.stringify(j));
  return j.candidates[0].content.parts.map((p) => p.text || "").join("");
}
