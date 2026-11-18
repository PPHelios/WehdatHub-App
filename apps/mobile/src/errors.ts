import { ApiClientError, PlanLockedError, isPlanPayError } from '@wehdathub/shared';
import type { Lang } from '@wehdathub/shared';
import { t } from './i18n';
import { planT } from './planText';
import type { PlanTextKey } from './planText';

const PLAN_ERR: Record<string, PlanTextKey> = { same_plan: 'errSame', downgrade: 'errDowngrade', not_allowed: 'errDowngrade', period_switch: 'errPeriod', upgrade_required: 'errPeriod', upgrade_pending: 'errPending', upgrade_stale: 'errPending', lapsed: 'errLapsed', not_paid: 'errNotPaid', plan: 'errPlan', forbidden: 'errPlan', amount: 'errPlan', too_many: 'errPending' };

/** A plain-language message for any failed call (never a raw code). */
export function errorText(err: unknown, lang: Lang): string {
  // The plan guard (402) opens its own sheet; the text here is only for screens that still show a line.
  if (err instanceof PlanLockedError) return planT(lang, err.phase === 'blocked' ? 'bodyBlocked' : 'bodyReadonly');
  if (err instanceof ApiClientError) {
    if (err.status === 422 && isPlanPayError(err.code)) return planT(lang, PLAN_ERR[err.code] ?? 'errPlan');
    if (err.status === 0) return t(lang, 'offline');
    if (err.status === 429) return t(lang, 'tooMany');
    if (err.code === 'invalid_code') return t(lang, 'wrongCode');
    // The server's own sentence for the failure (it adds `message` to every error answer), before the generic lines below.
    const said = err.extra?.message;
    if (typeof said === 'string' && said.trim() && said.length <= 240) return said.trim();
    if (err.status === 422) return t(lang, 'notHeard');
    if (err.status === 402 || err.status === 503) return t(lang, 'voiceOff');
    if (err.status === 404) return t(lang, 'unitMissing');
  }
  return t(lang, 'serverError');
}
