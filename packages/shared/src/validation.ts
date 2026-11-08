import { z } from 'zod';

/** An Egyptian mobile as typed by a person (01012345678, +20 101 234 5678, 201012345678): digits only, 10 to 13 of them. */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s\-()+]/g, ''))
  .pipe(z.string().regex(/^\d{10,13}$/));

/** The six-digit sign-in code. */
export const codeSchema = z.string().transform((v) => v.replace(/\s/g, '')).pipe(z.string().regex(/^\d{6}$/));

/** "1.2.3" → [1,2,3]; anything else → [0,0,0]. */
const parts = (v: string): number[] => (/^\d+\.\d+\.\d+$/.test(v) ? v.split('.').map(Number) : [0, 0, 0]);
/** True when the installed app is older than the lowest version the server supports. */
export function isOutdated(installed: string, minimum: string): boolean {
  const a = parts(installed);
  const b = parts(minimum);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}
