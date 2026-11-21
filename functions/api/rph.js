import { requireUser } from "../../lib/auth.js";
import { ensurePath, uploadFile } from "../../lib/google.js";
import { gemini, text } from "../../lib/gemini.js";
import { buildPdf } from "../../lib/pdf.js";
import { shortId, json } from "../../lib/util.js";

const HARI = { ISNIN: 0, SELASA: 1, RABU: 2, KHAMIS: 3, JUMAAT: 4 };

// Tambah hari pada tarikh Isnin. Contoh: 2026-11-23 + 2 = 2026-11-25
function tambahHari(isnin, n) {
  const d = new Date(isnin + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function onRequestPost({ request, env }) {
  const user = await requireUser(request, env);
  if (!user) return json({ error: "Tidak dibenarkan" }, 401);

  const { minggu, refleksi, jadual, sampel } = await request.json();
  if (!minggu || !jadual) return json({ error: "Tarikh Isnin dan jadual diperlukan." }, 400);

  // Baca jadual: satu baris = satu kelas
  const kelas = [];
  for (const baris of jadual.split("\n").map((b) => b.trim()).filter(Boolean)) {
    const [hari, masa, kls, mp] = baris.split("|").map((s) => s.trim());
    const n = HARI[(hari || "").toUpperCase()];
    if (n === undefined || !masa || !kls || !mp) {
      return json({ error: `Baris tidak sah: "${baris}". Format: HARI | MASA | KELAS | MATA PELAJARAN` }, 400);
    }
    kelas.push({ tarikh: tambahHari(minggu, n), hari, masa, kelas: kls, mata_pelajaran: mp });
  }

  const prompt = `Anda pembantu penulisan RPH (Rancangan Pengajaran Harian) untuk guru di Malaysia.
Tulis satu entri RPH untuk setiap kelas berikut, ikut urutan yang sama. Gunakan Bahasa Melayu.

SENARAI KELAS:
${JSON.stringify(kelas, null, 1)}

REFLEKSI GURU (ambil kira dalam perancangan):
${refleksi || "-"}

CONTOH FORMAT RPH (ikut struktur dan gaya):
${sampel || "-"}

Balas JSON sahaja, dengan tepat ${kelas.length} item dalam susunan yang sama:
{"rph":[{"tajuk":"","objektif":"","aktiviti":"","bahan_bantu":"","penilaian":"","refleksi":""}]}`;

  let rph;
  try {
    rph = JSON.parse(await gemini(env, [text(prompt)], { json: true })).rph;
  } catch {
    return json({ error: "AI gagal menjana RPH. Cuba sekali lagi." }, 502);
  }
  if (!Array.isArray(rph) || rph.length !== kelas.length) {
    return json({ error: "Jumlah entri AI tidak sepadan. Cuba sekali lagi." }, 502);
  }

  const sections = kelas.map((k, i) => {
    const r = rph[i];
    return {
      heading: `${k.hari} ${k.tarikh} | ${k.masa} | ${k.kelas} | ${k.mata_pelajaran}`,
      body: `Tajuk: ${r.tajuk}\nObjektif: ${r.objektif}\nAktiviti: ${r.aktiviti}\nBahan bantu: ${r.bahan_bantu}\nPenilaian: ${r.penilaian}\nRefleksi: ${r.refleksi}`,
    };
  });

  const pdfBytes = await buildPdf({
    title: `Rancangan Pengajaran Harian: Minggu ${minggu}`,
    subtitle: `Guru: Mohd Faiq bin Ab. Latif | ${kelas.length} kelas`,
    sections,
  });

  const folder = await ensurePath(env, ["PDF", "RPH", minggu.slice(0, 7)]);
  const f = await uploadFile(env, {
    name: `RPH_${minggu}_${shortId()}.pdf`,
    mime: "application/pdf", bytes: pdfBytes, parentId: folder,
  });

  return json({ ok: true, jumlah: kelas.length, pdfLink: f.webViewLink });
}
