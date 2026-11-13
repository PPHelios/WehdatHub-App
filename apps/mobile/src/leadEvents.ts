import type { LeadEvent, Lang } from '@wehdathub/shared';
import { stageLabel } from './i18n';

const WORDS: Record<string, [string, string]> = {
  created: ['اتسجل العميل', 'Added the lead'],
  inquiry: ['العميل سأل تاني', 'The client asked again'],
  merged: ['اتضاف رقم للعميل', 'Added a phone number'],
  assigned: ['سلّم العميل لوسيط', 'Assigned the lead'],
  assignment: ['سلّم العميل لوسيط', 'Assigned the lead'],
  contacted: ['كلّم العميل', 'Contacted the client'],
  follow_up_set: ['حدد متابعة', 'Set a follow-up'],
  follow_up: ['متابعة', 'Follow-up'],
  follow_up_done: ['خلّص المتابعة', 'Finished the follow-up'],
  match_sent: ['بعت وحدات مناسبة للعميل', 'Sent matching units'],
  viewing: ['حدد معاينة', 'Set a viewing'],
  request_set: ['سجل طلب العميل', 'Saved the client request'],
  flag: ['علّم العميل', 'Flagged the lead'],
  flag_handled: ['عالج التنبيه', 'Handled the flag'],
  edited: ['عدّل بيانات العميل', 'Edited the lead'],
  undo: ['تراجع عن خطوة', 'Undid a step'],
  unit_moved_out: ['وحدة اتشالت من اللينك', 'A unit left the link'],
};

/** A history line in plain words (never a raw code); notes show what was written. */
export function eventText(e: LeadEvent, lang: Lang): string {
  if (e.kind === 'stage' && e.stage) return `${lang === 'ar' ? 'غيّر المرحلة إلى' : 'Moved the stage to'} ${stageLabel(lang, e.stage)}`;
  if (e.kind === 'note' && e.text) return e.text;
  const w = WORDS[e.kind];
  if (w) return e.text ? `${w[lang === 'ar' ? 0 : 1]}: ${e.text}` : w[lang === 'ar' ? 0 : 1];
  return e.text || (lang === 'ar' ? 'تحديث' : 'Update');
}
