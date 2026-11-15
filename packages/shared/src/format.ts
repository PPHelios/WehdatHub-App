/** Formats an amount in Egyptian pounds with thousands separators, e.g. 3180590 -> "3,180,590". */
export function formatEgp(amount: number): string {
  return Math.round(amount).toLocaleString('en-US');
}
