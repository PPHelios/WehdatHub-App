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

/** Thousands separators as a number is typed: 9500000 shows as 9,500,000 (Arabic digits become Latin; the server reads commas). */
export function withCommas(raw: string): string {
  const d = digits(raw).replace(/[^\d.]/g, '');
  if (!d) return '';
  const [whole, ...rest] = d.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (rest.length ? `.${rest.join('')}` : '');
}

/** What is stored and sent: digits only (commas are for display). Arabic digits become Latin. */
export function plain(raw: string): string {
  return digits(raw).replace(/[^\d.]/g, '');
}

const numberOf = (raw: string): number => {
  const m = /^(\d+(?:\.\d+)?)$/.exec(digits(raw));
  return m ? Number(m[1]) : 0;
};

/** Under the area: a typo guard ("1500" for a 150 m² flat; not for land) and, once the price is filled too, the price per m². */
export function readArea(area: string, price: string, isLand: boolean, lang: 'ar' | 'en'): string {
  const a = numberOf(area);
  if (!a) return '';
  if (!isLand && a < 15) return lang === 'ar' ? '⚠️ صغيرة أوي: راجع المساحة' : '⚠️ Very small: check the area';
  if (!isLand && a > 3000) return lang === 'ar' ? '⚠️ كبيرة أوي: راجع المساحة' : '⚠️ Very large: check the area';
  const p = numberOf(price);
  return p >= 1000 ? `≈ ${Math.round(p / a).toLocaleString('en')} ${lang === 'ar' ? 'ج.م للمتر' : 'EGP per m²'}` : '';
}

/** Paid + remaining installments, added up: a plain sum for the person to see, never a check (the two are not always the price). */
export function readSum(paid: string, remaining: string, lang: 'ar' | 'en'): string {
  const a = numberOf(paid);
  const b = numberOf(remaining);
  return a && b ? `${lang === 'ar' ? 'المدفوع + المتبقي' : 'Paid + remaining'} = ${(a + b).toLocaleString('en')}` : '';
}
