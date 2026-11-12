/** Reads a typed price or phone back in words, so a wrong zero or digit is seen before saving. */
const AR = '٠١٢٣٤٥٦٧٨٩';
const digits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR.indexOf(d))).replace(/[٬,\s]/g, '');

export function readPrice(raw: string, lang: 'ar' | 'en'): string {
  const m = /^(\d+(?:\.\d+)?)\s*([kmكم]?)$/i.exec(digits(raw));
  if (!m) return '';
  const mult = /m|م/i.test(m[2]) ? 1e6 : /k|ك/i.test(m[2]) ? 1e3 : 1;
  const n = Number(m[1]) * mult;
  if (!n) return '';
  const f = (v: number) => String(Math.round(v * 100) / 100);
  if (n >= 1e6) return lang === 'ar' ? `${f(n / 1e6)} مليون` : `${f(n / 1e6)} million`;
  if (n >= 1e3) return lang === 'ar' ? `${f(n / 1e3)} ألف` : `${f(n / 1e3)} thousand`;
  return String(n);
}

export function readPhone(raw: string): string {
  const d = digits(raw).replace(/^\+?20/, '0');
  return /^01[0125]\d{8}$/.test(d) ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : '';
}
