import type { Lang } from '@wehdathub/shared';

const formats: Partial<Record<Lang, Intl.DateTimeFormat>> = {};

/** A date and time for a list row ("12 Nov 2026, 10:30"). The formatter is built once per language: building one per row is slow. */
export function rowDate(lang: Lang, value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 'Invalid Date';
  const f = (formats[lang] ??= new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }));
  return f.format(d);
}
