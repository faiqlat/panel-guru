import { requireUser } from "../../lib/auth.js";
import { ensurePath, uploadFile } from "../../lib/google.js";
import { gemini, text } from "../../lib/gemini.js";
import { buildPdf } from "../../lib/pdf.js";
import { klNow, shortId, json } from "../../lib/util.js";

const FORMAT = {
  PLC: "Format PLC: 01 Objektif; 02 Aktiviti PLC; 03 Dapatan; 04 Impak kepada murid; 05 Tindakan susulan; 06 Refleksi.",
  OPR: "Format OPR satu halaman: Maklumat program (tarikh dan masa, tempat, anjuran, sasaran); 01 Objektif program; 02 Aktiviti; 03 Kekuatan dan impak; 04 Penambahbaikan; 05 Refleksi.",
};

export async function onRequestPost({ request, env }) {
  const user = await requireUser(request, env);
  if (!user) return json({ error: "Tidak dibenarkan" }, 401);

  const { jenis, maklumat, contoh } = await request.json();
  if (!FORMAT[jenis]) return json({ error: "Jenis mesti PLC atau OPR." }, 400);
  if (!maklumat) return json({ error: "Maklumat aktiviti diperlukan." }, 400);

  const prompt = `Anda membantu guru Pendidikan Muzik di Malaysia menulis laporan sekolah.
Tulis ${jenis} dalam Bahasa Melayu formal, ayat ringkas dan jelas. ${FORMAT[jenis]}

MAKLUMAT (gunakan fakta ini sahaja, jangan reka data atau angka):
${maklumat}

CONTOH GAYA (ikut nada dan ayat, bukan kandungan):
${contoh || "-"}

Balas JSON sahaja: {"tajuk":"...","seksyen":[{"heading":"...","body":"..."}]}`;

  let hasil;
  try {
    hasil = JSON.parse(await gemini(env, [text(prompt)], { json: true }));
  } catch {
    return json({ error: "AI gagal menjana dokumen. Cuba sekali lagi." }, 502);
  }
  const { tajuk, seksyen } = hasil;

  const pdfBytes = await buildPdf({ title: tajuk, subtitle: jenis, sections: seksyen });

  const month = klNow().month;
  const folder = await ensurePath(env, ["PDF", jenis, month]);
  const safeTitle = tajuk.replace(/[\\/:*?"<>|]/g, "").slice(0, 60);
  const f = await uploadFile(env, {
    name: `${jenis}_${safeTitle}_${shortId()}.pdf`,
    mime: "application/pdf", bytes: pdfBytes, parentId: folder,
  });

  return json({ ok: true, pdfLink: f.webViewLink });
}
