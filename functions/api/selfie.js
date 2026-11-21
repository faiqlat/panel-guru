import { requireUser } from "../../lib/auth.js";
import { ensurePath, findByPrefix, uploadFile } from "../../lib/google.js";
import { gemini, text, image } from "../../lib/gemini.js";
import { buildPdf } from "../../lib/pdf.js";
import { klNow, shortId, toBase64, json } from "../../lib/util.js";

const START = "07:20", END = "08:00";

// Semak nametag dan muka sahaja. Pakaian tidak disemak.
async function checkSelfie(env, b64, mime) {
  const prompt = `Anda membantu semakan kehadiran guru di sekolah di Malaysia.
Pakaian TIDAK perlu disemak. Semak HANYA dua perkara:
- tag_nama: adakah nametag kelihatan di dada? Nametag mesti segi empat tepat, latar hitam, ada jata Malaysia (lambang berwarna) di sebelah kiri, dan nama ditulis dengan warna putih.
- muka_jelas: adakah wajah kelihatan jelas dan tidak ditutup?
Balas JSON sahaja: {"tag_nama": boolean, "muka_jelas": boolean, "catatan": "ayat ringkas dalam Bahasa Melayu"}`;
  const r = JSON.parse(await gemini(env, [text(prompt), image(b64, mime)], { json: true }));
  const lulus = r.tag_nama && r.muka_jelas;
  return { ...r, status: lulus ? "lulus" : "semak_manual" };
}

export async function onRequestPost({ request, env }) {
  const user = await requireUser(request, env);
  if (!user) return json({ error: "Tidak dibenarkan" }, 401);

  const form = await request.formData();
  const file = form.get("selfie");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return json({ error: "Sila ambil gambar selfie." }, 400);
  }
  if (file.size > 10 * 1024 * 1024) return json({ error: "Saiz gambar terlalu besar." }, 400);

  // Sekatan masa dan hari di server
  const now = klNow();
  if (now.dow === 0 || now.dow === 6) return json({ error: "Hari ini bukan hari bekerja." }, 400);
  const holidays = (env.HOLIDAYS || "").split(",").map((s) => s.trim());
  if (holidays.includes(now.date)) return json({ error: "Hari ini cuti." }, 400);
  if (now.time < START || now.time > END) {
    return json({ error: `Di luar masa (${START}–${END}). Masa semasa: ${now.time}` }, 400);
  }

  // Satu selfie sehari sahaja
  const imgFolder = await ensurePath(env, ["Gambar", now.month]);
  if (await findByPrefix(env, `${now.date}_selfie`, imgFolder)) {
    return json({ error: "Selfie hari ini sudah dihantar." }, 409);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ai = await checkSelfie(env, toBase64(bytes), file.type);

  const id = shortId();
  const stamp = `${now.date}_${now.time.replace(":", "")}`;
  const ext = file.type === "image/png" ? "png" : "jpg";
  const img = await uploadFile(env, {
    name: `${stamp}_selfie_${id}.${ext}`, mime: file.type, bytes, parentId: imgFolder,
  });

  const pdfBytes = await buildPdf({
    title: "Laporan Kehadiran Harian",
    subtitle: `Tarikh: ${now.date}    Masa: ${now.time}`,
    sections: [
      {
        heading: "Keputusan semakan",
        body: ai.status === "lulus"
          ? "LULUS: nametag kelihatan dan wajah jelas."
          : `SEMAK MANUAL: ${ai.catatan}`,
      },
      { heading: "Tag nama", body: ai.tag_nama ? "Ya" : "Tidak" },
      { heading: "Muka jelas", body: ai.muka_jelas ? "Ya" : "Tidak" },
      { heading: "Nota", body: "Semakan AI. Gambar asal boleh disemak semula dalam Drive." },
    ],
    image: { bytes, mime: file.type },
  });

  const pdfFolder = await ensurePath(env, ["PDF", "Kehadiran", now.month]);
  const pdf = await uploadFile(env, {
    name: `${stamp}_laporan-kehadiran_${id}.pdf`,
    mime: "application/pdf", bytes: pdfBytes, parentId: pdfFolder,
  });

  return json({
    ok: true, status: ai.status, catatan: ai.catatan,
    imageLink: img.webViewLink, pdfLink: pdf.webViewLink,
  });
}
