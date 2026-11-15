/** Formats an amount in Egyptian pounds with thousands separators, e.g. 3180590 -> "3,180,590". */
export function formatEgp(amount: number): string {
  return Math.round(amount).toLocaleString('en-US');
}

/** "5m", "250k", "5,000,000" (also Arabic digits) as a number, or null. The same reading as the website's Map budget boxes. */
export function parseMoney(text: string): number | null {
  const m = String(text || '')
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,\s]/g, '')
    .match(/^(\d+(?:\.\d+)?)([mk]?)$/);
  if (!m) return null;
  return Number(m[1]) * (m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1);
}
