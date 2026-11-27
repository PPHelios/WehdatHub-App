import type { Lang } from './api';

/** Formats an amount in Egyptian pounds with thousands separators, e.g. 3180590 -> "3,180,590". */
export function formatEgp(amount: number): string {
  return Math.round(amount).toLocaleString('en-US');
}

/** Localized currency label for listing prices ("EGP"/"جنيه", "USD"/"دولار", "EUR"/"يورو"). */
export function currencyLabel(currency?: string | null, lang: Lang = 'ar'): string {
  const code = String(currency || 'EGP').trim().toUpperCase() || 'EGP';
  if (lang === 'en') return code;
  if (code === 'EGP') return 'جنيه';
  if (code === 'USD') return 'دولار';
  if (code === 'EUR') return 'يورو';
  return code;
}

/** Formats a listing price with its currency (EGP default) and optional rent period. */
export function formatUnitPrice(
  amount: number | null,
  {
    currency = 'EGP',
    lang = 'ar',
    dealType,
    rentPeriod,
    fallbackText = null,
  }: {
    currency?: string | null;
    lang?: Lang;
    dealType?: string | null;
    rentPeriod?: string | null;
    fallbackText?: string | null;
  } = {},
): string | null {
  if (amount === null || !Number.isFinite(amount)) return fallbackText;
  const base = `${formatEgp(amount)} ${currencyLabel(currency, lang)}`;
  if (dealType !== 'rent' || !rentPeriod) return base;
  const yearly = rentPeriod === 'yearly';
  return `${base} ${lang === 'en' ? (yearly ? '/ year' : '/ month') : yearly ? 'سنوياً' : 'شهرياً'}`;
}

/** "5m", "250k", "5,000,000", "3 مليون", "٢٥٠ ألف" (also Arabic digits and ٬) as a number, or null. The same reading as the website's Map budget boxes. */
export function parseMoney(text: string): number | null {
  const m = String(text || '')
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,\s٬]/g, '')
    .match(/^(\d+(?:\.\d+)?)(m|k|مليون|الف|ألف)?$/);
  if (!m) return null;
  const unit = m[2];
  return Number(m[1]) * (unit === 'm' || unit === 'مليون' ? 1e6 : unit === 'k' || unit === 'الف' || unit === 'ألف' ? 1e3 : 1);
}
