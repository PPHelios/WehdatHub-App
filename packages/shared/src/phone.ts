// Phone display helpers, mirroring the server's domain/phone.js displayPhone.

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function toAsciiDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (c) => {
    const i = AR_DIGITS.indexOf(c);
    return String(i >= 0 ? i : FA_DIGITS.indexOf(c));
  });
}

const EG_MOBILE = /^201[0125]\d{8}$/;
const EG_LANDLINE = /^20[2-9]\d{8}$/;

/** Any written phone to international digits ("201012345678"), or null when it is not a phone. */
export function normalizePhoneDigits(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = toAsciiDigits(String(raw)).replace(/@.*$/, '').trim();
  if (!s) return null;
  if (/[^\d\s+\-().‎‏‪-‮]/.test(s)) return null;
  const plus = /^\s*[‎‏‪-‮]*\+/.test(s);
  let d = s.replace(/\D/g, '');
  if (!d) return null;
  let intl = plus;
  if (!plus && d.startsWith('00')) {
    d = d.slice(2);
    intl = true;
  }
  if (!intl) {
    if (/^01[0125]\d{8}$/.test(d)) return `2${d}`;
    if (/^0[2-9]\d{8}$/.test(d)) return `20${d.slice(1)}`;
    if (/^1[0125]\d{8}$/.test(d)) return `20${d}`;
    if (EG_MOBILE.test(d) || EG_LANDLINE.test(d)) return d;
    if (d.startsWith('0')) return null;
  }
  if (d.startsWith('20')) {
    if (/^200[1-9]/.test(d)) d = `20${d.slice(3)}`;
    return EG_MOBILE.test(d) || EG_LANDLINE.test(d) ? d : null;
  }
  return d.length >= 8 && d.length <= 15 && !d.startsWith('0') ? d : null;
}

/** Human form in Latin digits: 0101 234 5678 · 02 1234 5678 · +966 512345678. Non-phones come back unchanged. */
export function displayPhone(raw: string): string {
  const d = normalizePhoneDigits(raw);
  if (!d) return String(raw ?? '');
  if (EG_MOBILE.test(d)) {
    const n = `0${d.slice(2)}`;
    return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
  }
  if (EG_LANDLINE.test(d)) {
    const n = `0${d.slice(2)}`;
    return n.startsWith('02') ? `${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}` : `${n.slice(0, 3)} ${n.slice(3)}`;
  }
  return `+${d}`;
}

/** Wrap in left-to-right embedding so digit groups keep their order inside RTL text. */
export function ltr(s: string): string {
  return `‪${s}‬`;
}

/** At least 8 digits and nothing but digits, spaces, + - ( ). */
export function looksLikePhone(s: string): boolean {
  const t = toAsciiDigits(String(s ?? ''));
  return /^[\d\s+\-().]+$/.test(t) && (t.match(/\d/g) || []).length >= 8;
}
