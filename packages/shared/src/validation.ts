import { z } from 'zod';

/** An Egyptian mobile as typed by a person (01012345678, +20 101 234 5678, 201012345678): digits only, 10 to 13 of them. */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s\-()+]/g, ''))
  .pipe(z.string().regex(/^\d{10,13}$/));

/** The six-digit sign-in code. */
export const codeSchema = z.string().transform((v) => v.replace(/\s/g, '')).pipe(z.string().regex(/^\d{6}$/));
