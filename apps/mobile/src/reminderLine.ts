import type { Lang } from '@wehdathub/shared';
import { t } from './i18n';

const CAIRO = 'Africa/Cairo';

/** "Auto-reminded at 3:10" (Cairo time) for today, the date for older ones; null when there is no usable time. */
export function reminderLine(at: string | null | undefined, lang: Lang, now = new Date()): string | null {
  const d = at ? new Date(at) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const day = (x: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: CAIRO }).format(x);
  const today = day(d) === day(now);
  const x = today
    ? d.toLocaleTimeString(locale, { timeZone: CAIRO, hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(locale, { timeZone: CAIRO, day: 'numeric', month: 'short' });
  return t(lang, today ? 'ac_autoToday' : 'ac_autoDate').replace('{x}', x);
}
