import dayjs from "dayjs";

// TR month names
const months = {
  "ocak": 1, "şubat": 2, "subat": 2, "mart": 3, "nisan": 4, "mayıs": 5, "mayis": 5,
  "haziran": 6, "temmuz": 7, "ağustos": 8, "agustos": 8, "eylül": 9, "eylul": 9,
  "ekim": 10, "kasım": 11, "kasim": 11, "aralık": 12, "aralik": 12
};

export function extractFirstDateTime(text) {
  // 12.01.2026 or 12/01/2026
  const m1 = text.match(/\b(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{4})\b/);
  if (m1) {
    const [_, dd, mm, yyyy] = m1;
    // time near date: 14:30
    const t = text.slice(Math.max(0, m1.index - 40), m1.index + 80).match(/\b([01]?\d|2[0-3])[:\.]([0-5]\d)\b/);
    const hh = t ? t[1] : "10";
    const min = t ? t[2] : "00";
    const d = dayjs(`${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}T${String(hh).padStart(2,"0")}:${min}:00Z`);
    return d.isValid() ? d.toDate() : null;
  }

  // 12 Ocak 2026
  const m2 = text.toLowerCase().match(/\b(\d{1,2})\s+(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)\s+(\d{4})\b/);
  if (m2) {
    const dd = m2[1];
    const mm = months[m2[2]];
    const yyyy = m2[3];
    const t = text.slice(Math.max(0, m2.index - 40), m2.index + 80).match(/\b([01]?\d|2[0-3])[:\.]([0-5]\d)\b/);
    const hh = t ? t[1] : "10";
    const min = t ? t[2] : "00";
    const d = dayjs(`${yyyy}-${String(mm).padStart(2,"0")}-${dd.padStart(2,"0")}T${String(hh).padStart(2,"0")}:${min}:00Z`);
    return d.isValid() ? d.toDate() : null;
  }

  return null;
}
