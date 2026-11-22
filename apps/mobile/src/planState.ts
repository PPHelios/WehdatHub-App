import { useQuery } from '@tanstack/react-query';
import { UNIT_WARN_PCT, UNLIMITED_UNITS, isPlanLapsed, perMonthPrice, planPeriods } from '@wehdathub/shared';
import type { Lang, PlanAllowance, PlanDef } from '@wehdathub/shared';
import { usageOptions } from './queries';
import { useAuth } from './auth';
import { usePlanLock } from './planLock';
import { planT } from './planText';
import { useRights } from './rights';

export type PlanPhase = 'none' | 'grace' | 'readonly' | 'blocked';
const DAY = 86_400_000;

/** Whole days from `now` to the ISO date, never below 0 (a date part-way through a day counts as a day left). */
export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.ceil((t - now.getTime()) / DAY)) : null;
}

/** The ladder step and the days left in it: grace counts to read-only, read-only counts to blocked, blocked has no count. */
export function planPhase(a: Pick<PlanAllowance, 'source' | 'ladder'> | null | undefined, now: Date = new Date()): { phase: PlanPhase; daysLeft: number | null } {
  if (!a || !isPlanLapsed(a.source)) return { phase: 'none', daysLeft: null };
  if (a.source === 'grace') return { phase: 'grace', daysLeft: daysUntil(a.ladder?.readonlyStarts, now) };
  if (a.source === 'readonly') return { phase: 'readonly', daysLeft: daysUntil(a.ladder?.blockedStarts, now) };
  return { phase: 'blocked', daysLeft: null };
}

/** The banner line for a phase. A broker (not a manager) gets "ask your manager" and never a price or a payment link. */
export function bannerText(lang: Lang, phase: PlanPhase, daysLeft: number | null, manager: boolean): string | null {
  if (phase === 'none') return null;
  const key = phase === 'grace' ? 'bannerGrace' : phase === 'readonly' ? 'bannerReadonly' : 'bannerBlocked';
  const line = planT(lang, key, daysLeft ?? 0);
  return manager ? line : `${line} ${planT(lang, 'askManager')}`;
}

export interface PreEndStatus {
  source: 'paid' | 'trial';
  daysLeft: number;
}

const cairoDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });

function cairoDay(date: Date): number {
  const parts = Object.fromEntries(cairoDate.formatToParts(date).map(({ type, value }) => [type, value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

/** Pre-expiration countdown warning in Cairo calendar days. */
export function preEndStatus(a: Pick<PlanAllowance, 'source' | 'until'> | null | undefined, now: Date = new Date()): PreEndStatus | null {
  if (!a || !a.until) return null;
  if (a.source !== 'paid' && a.source !== 'trial') return null;
  const until = new Date(a.until);
  if (!Number.isFinite(until.getTime()) || until <= now) return null;
  const days = (cairoDay(until) - cairoDay(now)) / DAY;
  const maxDays = a.source === 'paid' ? 7 : 3;
  if (days >= 0 && days <= maxDays) {
    return { source: a.source, daysLeft: days };
  }
  return null;
}

/** The unit meter's soft warning: the share used when it is 85% or more of a real cap (not unlimited), else null. */
export function unitWarnPct(units: { used: number; limit: number } | null | undefined): number | null {
  if (!units || !(units.limit > 0) || units.limit >= UNLIMITED_UNITS) return null;
  const pct = Math.floor((units.used / units.limit) * 100);
  return pct >= UNIT_WARN_PCT ? Math.min(pct, 100) : null;
}

/** One row per period the plan is sold for: the price and its per-month equivalent (a monthly row has no equivalent). */
export function priceRows(plan: Pick<PlanDef, 'prices'> | null | undefined): { months: number; price: number; perMonth: number | null }[] {
  return planPeriods(plan).map((months) => {
    const price = Number(plan!.prices[String(months)]);
    return { months, price, perMonth: months > 1 ? perMonthPrice(price, months) : null };
  });
}

/** Where the signed-in agency is on the ladder (from GET /usage, open to everyone) and whether this person is a manager. */
export function usePlanState() {
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const rights = useRights();
  const lockPhase = usePlanLock((s) => s.error?.phase ?? null);
  const q = useQuery(usageOptions(signedIn));
  const fromServer = planPhase(q.data?.allowance);
  // A 402 just seen is believed until the usage answer says otherwise.
  const phase: PlanPhase = fromServer.phase !== 'none' ? fromServer.phase : !q.data && lockPhase ? lockPhase : 'none';
  return { phase, daysLeft: fromServer.daysLeft, manager: rights.manager || rights.agencyOwner, allowance: q.data?.allowance };
}
