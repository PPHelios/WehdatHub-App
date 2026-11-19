/** Formats an amount in Egyptian pounds with thousands separators, e.g. 3180590 -> "3,180,590". */
export function formatEgp(amount: number): string {
  return Math.round(amount).toLocaleString('en-US');
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
