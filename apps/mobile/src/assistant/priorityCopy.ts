// Single source for Home priority wording: titles, chat prompts, row details and the all-clear next step.
import type { Lang, SearchHomePriority } from '@wehdathub/shared';
import type { IconName } from '../components/Icon';
import { t, type StringKey } from '../i18n';

interface Entry {
  testID: string;
  icon: IconName;
  title: StringKey;
  /** Chat prompt for "ask about this". */
  prompt?: StringKey;
  /** The primary button already sends the prompt to chat, so no second "ask" button is shown. */
  chatFirst?: boolean;
}

const ENTRIES: Record<string, Entry> = {
  unassigned: { testID: 'home-unassigned', icon: 'user-plus', title: 'pc_unassigned', prompt: 'pq_unassigned', chatFirst: true },
  'waiting-over-1h': { testID: 'home-waiting-1h', icon: 'pulse', title: 'pc_waiting', prompt: 'pq_waiting', chatFirst: true },
  'uncontacted-old': { testID: 'home-uncontacted', icon: 'pulse', title: 'pc_uncontactedOld', prompt: 'pq_uncontactedOld', chatFirst: true },
  overdue: { testID: 'home-late', icon: 'bell', title: 'pc_overdue', prompt: 'pq_overdue', chatFirst: true },
  intake: { testID: 'home-intake', icon: 'link', title: 'pc_intake' },
  approvals: { testID: 'home-approvals', icon: 'lock', title: 'pc_approvals' },
  'owner-names': { testID: 'home-owner-names', icon: 'owners', title: 'pc_ownerNames' },
  commissions: { testID: 'home-commissions', icon: 'money', title: 'pc_commissions', prompt: 'pq_commissions', chatFirst: true },
  'leases-soon': { testID: 'home-leases', icon: 'calendar', title: 'pc_leases', prompt: 'pq_leases', chatFirst: true },
  'tomorrow-viewings': { testID: 'home-tomorrow', icon: 'calendar', title: 'pc_tomorrow', prompt: 'pq_tomorrow', chatFirst: true },
  calls: { testID: 'home-calls', icon: 'chat', title: 'pc_calls', prompt: 'pq_calls', chatFirst: true },
  'new-leads': { testID: 'home-new-leads', icon: 'leads', title: 'pc_newLeads', prompt: 'pq_newLeads', chatFirst: true },
  'missing-photos': { testID: 'home-missing-photos', icon: 'units', title: 'pc_photos', prompt: 'pq_photos' },
  'stale-units': { testID: 'home-stale-units', icon: 'units', title: 'pc_staleUnits', prompt: 'pq_staleUnits' },
  'stuck-leads': { testID: 'home-stuck-leads', icon: 'leads', title: 'pc_stuckLeads', prompt: 'pq_stuckLeads' },
  'next-viewing': { testID: 'home-viewing', icon: 'calendar', title: 'pc_viewing' },
};

const fill = (text: string, n: number, locale: string) => text.replace('{n}', n.toLocaleString(locale));

/** Chat prompt for a priority id, or null when it has none. */
export const priorityPrompt = (id: string, lang: Lang): string | null => {
  const key = ENTRIES[id]?.prompt;
  return key ? t(lang, key) : null;
};

/** Plain title for tips and shortcuts that repeat a priority's wording. */
export const priorityTitle = (id: 'overdue' | 'new-leads' | 'waiting-over-1h', lang: Lang): string => t(lang, ENTRIES[id].title);

export interface PriorityView {
  testID: string;
  title: string;
  detail?: string;
  /** Number or time shown at the end of the card. */
  value: string;
  icon: IconName;
  callPhone?: string | null;
  /** Primary button already opens the chat, so "ask" would repeat it. */
  chatFirst: boolean;
  prompt: string | null;
}

/** Display copy for one priority; null for ids this app version does not know (never shown raw). */
export function formatPriority(p: SearchHomePriority, lang: Lang): PriorityView | null {
  const e = ENTRIES[p.id];
  if (!e) return null;
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const extra = p.extra ?? {};
  const num = (k: string) => Number(extra[k] || 0);
  let detail: string | undefined;
  let value = p.count.toLocaleString(locale);
  let callPhone: string | null | undefined;
  if (p.id === 'waiting-over-1h' && num('over24h') > 0) detail = fill(t(lang, 'pc_over24'), num('over24h'), locale);
  else if (p.id === 'uncontacted-old') detail = lang === 'ar' ? 'أكتر من ٢٤ ساعة' : 'Over 24 hours';
  else if (p.id === 'intake') {
    detail = [num('disconnected') > 0 ? fill(t(lang, 'pc_disc'), num('disconnected'), locale) : '', num('failed') > 0 ? fill(t(lang, 'pc_failed'), num('failed'), locale) : ''].filter(Boolean).join(' · ') || undefined;
  } else if (p.id === 'next-viewing') {
    const at = typeof extra.at === 'string' && Number.isFinite(Date.parse(extra.at))
      ? new Date(extra.at).toLocaleTimeString(locale, { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' }) : '';
    detail = [extra.name ?? extra.ref, extra.unitCode].filter(Boolean).join(' · ') || undefined;
    value = at || value;
    callPhone = typeof extra.phone === 'string' ? extra.phone : null;
  }
  return { testID: e.testID, title: t(lang, e.title), detail, value, icon: e.icon, callPhone, chatFirst: Boolean(e.chatFirst), prompt: priorityPrompt(p.id, lang) };
}

/** "3 things need your decision"; the all-clear line when there are none. */
export function decisionSummary(decisions: number, lang: Lang): string {
  if (decisions <= 0) return t(lang, 'pc_sumClear');
  return decisions === 1 ? t(lang, 'pc_sumOne') : fill(t(lang, 'pc_sumMany'), decisions, lang === 'ar' ? 'ar-EG' : 'en-GB');
}

export type NextStep = { label: string; action: 'add-unit' | 'share-unit' | 'follow-up' };

/** Best next action when nothing needs a decision, by role. */
export function nextStepForRole(role: string | undefined, lang: Lang): NextStep {
  const r = (role ?? '').toLowerCase();
  if (r === 'data_entry') return { label: t(lang, 'pc_nextAdd'), action: 'add-unit' };
  if (r === 'owner' || r === 'manager' || r === 'admin' || r === 'team_lead') return { label: t(lang, 'pc_nextFollow'), action: 'follow-up' };
  return { label: t(lang, 'pc_nextShare'), action: 'share-unit' };
}

export const allClearLine = (lang: Lang): string => t(lang, 'pc_clear');
