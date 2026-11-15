import { ApiClientError } from '@wehdathub/shared';
import type { Lang } from '@wehdathub/shared';
import { t } from './i18n';

/** A plain-language message for any failed call (never a raw code). */
export function errorText(err: unknown, lang: Lang): string {
  if (err instanceof ApiClientError) {
    if (err.status === 0) return t(lang, 'offline');
    if (err.status === 429) return t(lang, 'tooMany');
    if (err.code === 'invalid_code') return t(lang, 'wrongCode');
    if (err.status === 422) return t(lang, 'notHeard');
    if (err.status === 402 || err.status === 503) return t(lang, 'voiceOff');
    if (err.status === 404) return t(lang, 'unitMissing');
  }
  return t(lang, 'serverError');
}
