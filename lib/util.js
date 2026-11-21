// Masa Malaysia (UTC+8), tanpa bergantung pada jam peranti
export function klNow() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  const date = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  return {
    date,
    month: date.slice(0, 7),
    time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
    dow: d.getUTCDay(), // 0 = Ahad, 6 = Sabtu
  };
}

export const shortId = () => crypto.randomUUID().slice(0, 8);

export function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
