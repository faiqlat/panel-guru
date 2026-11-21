import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const W = 595.28, H = 841.89, M = 50; // A4

export async function buildPdf({ title, subtitle, sections = [], image }) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([W, H]);
  let y = H - M;
  const newPage = () => { page = doc.addPage([W, H]); y = H - M; };

  const write = (str, size, f = font) => {
    for (const para of String(str ?? "").split("\n")) {
      let line = "";
      const draw = () => {
        if (y < M + size) newPage();
        page.drawText(line, { x: M, y, size, font: f, color: rgb(0, 0, 0) });
        y -= size * 1.5;
        line = "";
      };
      for (const word of para.split(" ")) {
        const test = line ? `${line} ${word}` : word;
        if (line && f.widthOfTextAtSize(test, size) > W - 2 * M) { draw(); line = word; }
        else line = test;
      }
      draw();
    }
  };

  write(title, 16, bold);
  if (subtitle) write(subtitle, 10);
  y -= 10;
  for (const s of sections) {
    write(s.heading, 12, bold);
    write(s.body, 10);
    y -= 8;
  }

  if (image && /^image\/(png|jpe?g)$/.test(image.mime)) {
    const img = image.mime === "image/png"
      ? await doc.embedPng(image.bytes)
      : await doc.embedJpg(image.bytes);
    const d = img.scaleToFit(180, 180);
    if (y - d.height < M) newPage();
    page.drawImage(img, { x: M, y: y - d.height, width: d.width, height: d.height });
  }

  return doc.save();
}
