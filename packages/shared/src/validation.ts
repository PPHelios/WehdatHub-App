import { z } from 'zod';
import { normalizePhoneDigits } from './phone';

/** An Egyptian mobile as typed by a person (01012345678, +20 101 234 5678, 201012345678): 01 then 0, 1, 2 or 5, then 8 digits (11 digits with the leading 0). */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s\-()+]/g, ''))
  .pipe(z.string().regex(/^(?:20|0)?1[0125]\d{8}$/));

/** A client's or owner's number: Egyptian, or foreign with + / 00 and the country code. Sign-in keeps the Egyptian-only phoneSchema. */
export const contactPhoneSchema = z.string().refine((v) => normalizePhoneDigits(v) !== null);

/** The six-digit sign-in code. */
export const codeSchema = z.string().transform((v) => v.replace(/\s/g, '')).pipe(z.string().regex(/^\d{6}$/));

/** Self-serve trial signup input from the mobile app. */
export const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: phoneSchema,
  agency: z.string().trim().max(120).optional(),
  tier: z.enum(['solo', 'team']).default('solo'),
  channel: z.enum(['telegram', 'whatsapp']).default('telegram'),
  lang: z.enum(['ar', 'en']).optional(),
});

/** "1.2.3" → [1,2,3]; anything else → [0,0,0]. */
const parts = (v: string): number[] => (/^\d+\.\d+\.\d+$/.test(v) ? v.split('.').map(Number) : [0, 0, 0]);
/** True when the installed app is older than the lowest version the server supports. */
export function isOutdated(installed: string, minimum: string): boolean {
  const a = parts(installed);
  const b = parts(minimum);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}
