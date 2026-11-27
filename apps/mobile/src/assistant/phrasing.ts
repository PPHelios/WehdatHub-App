import type { AssistantQueryResponse, Lang } from '@wehdathub/shared';

/** How many unit cards a turn shows before "See all". */
export const SHOWN_UNITS = 5;

const GENERIC = /^(?:results?|done|ok|here (?:is|are) (?:what i found|the results?)|نتايج|نتائج|النتيجة|دي النتيجة|تم)[\s.!]*$/i;

export const isGenericHeadline = (headline?: string | null): boolean => !headline || !headline.trim() || GENERIC.test(headline.trim());

/** Same turn id, same wording: the opener never changes between renders. */
export const variantOf = (turnId: string, count: number): number => {
  let h = 0;
  for (let i = 0; i < turnId.length; i += 1) h = (h * 31 + turnId.charCodeAt(i)) % 4294967296;
  return h % count;
};

const pick = (id: string, lines: string[]) => lines[variantOf(id, lines.length)];

function countOf(r: AssistantQueryResponse): number | null {
  if (r.units) return r.units.total;
  const stuck = r.cards.find((c) => c.kind === 'stuck_leads');
  return stuck && stuck.kind === 'stuck_leads' ? stuck.total : null;
}

/** A plain-words opener for an answer, built only from what the response holds. Falls back to the server headline when there is nothing better to say. */
export function phraseFor(turnId: string, lang: Lang, r: AssistantQueryResponse): string {
  const ar = lang === 'ar';
  const n = countOf(r);
  const win = r.windowLabel?.trim();
  const role = r.understood?.brokerRole;
  const roleText = role === 'closer' ? (ar ? 'كقافل' : 'as closer') : role === 'participant' ? (ar ? 'كمشارك' : 'as participant') : '';
  const tail = [win, roleText].filter(Boolean).join(' · ');
  const withTail = (line: string) => (tail ? `${line} (${tail})` : line);

  switch (r.intent) {
    case 'unit_search': {
      if (r.units && r.units.status !== 'results' && r.units.status !== 'none') return withTail(ar ? pick(turnId, ['اتفضل اللي لقيته.', 'دي النتيجة.']) : pick(turnId, ['Here is what I found.', 'Here you go.']));
      if (!n) {
        return ar
          ? pick(turnId, ['مفيش وحدات مطابقة للطلب ده — جرّب الاقتراحات.', 'ملقيتش حاجة بالمواصفات دي — نوسّع البحث؟'])
          : pick(turnId, ['No units match that yet — try the ideas below.', 'Nothing fits those details — shall we widen the search?']);
      }
      const shown = Math.min(n, SHOWN_UNITS);
      const closest = n > shown;
      return ar
        ? pick(turnId, closest
          ? [`لقيتلك ${n} وحدة — دي أقرب ${shown} لطلبك.`, `عندي ${n} وحدة مناسبة — دي أول ${shown}.`, `${n} وحدة على طلبك — بدأت بأقرب ${shown}.`]
          : [`لقيتلك ${n} وحدة — دي كلها.`, `عندي ${n} وحدة مناسبة — اتفضل.`, `${n} وحدة على طلبك — اتفضل.`])
        : pick(turnId, closest
          ? [`Found ${n} units — here are the ${shown} closest.`, `${n} units match — starting with the ${shown} closest.`, `Here you go: ${n} units, the ${shown} closest first.`]
          : [`Found ${n} units — here they all are.`, `${n} units match — here you go.`, `Here you go: ${n} units.`]);
    }
    case 'crm_leads':
      return withTail(ar
        ? pick(turnId, [n == null ? 'دي قائمة العملاء.' : `عندك ${n} عميل محتاجين متابعة.`, n == null ? 'اتفضل العملاء.' : `${n} عميل في القائمة دي.`])
        : pick(turnId, [n == null ? 'Here are your leads.' : `${n} leads need your attention.`, n == null ? 'Here is the lead list.' : `${n} leads in this list.`]));
    case 'crm_deals':
      return withTail(ar ? pick(turnId, ['دي الصفقات.', 'اتفضل ملخص الصفقات.']) : pick(turnId, ['Here are the deals.', 'Here is the deals summary.']));
    case 'crm_team':
    case 'crm_broker':
    case 'crm_discipline':
    case 'crm_stuck_brokers':
      return withTail(ar ? pick(turnId, ['دي حالة الفريق.', 'اتفضل أداء الفريق.']) : pick(turnId, ['Here is how the team is doing.', 'Here is the team picture.']));
    case 'primary':
    case 'primary_answer':
      return ar ? pick(turnId, ['دي إجابة من مشاريع المطورين.', 'اتفضل اللي لقيته في المشاريع.']) : pick(turnId, ['Here is what I found in developer projects.', 'Here is the answer from Primary projects.']);
    case 'clarify':
      return ar ? pick(turnId, ['محتاج توضيح بسيط عشان أجاوبك.', 'ممكن توضّح أكتر؟']) : pick(turnId, ['I need one more detail to answer.', 'Could you say a little more?']);
    default:
      return withTail(ar ? pick(turnId, ['اتفضل اللي لقيته.', 'دي النتيجة.']) : pick(turnId, ['Here is what I found.', 'Here you go.']));
  }
}

/** The line a turn opens with: the server's own headline unless it is missing or generic. */
export function leadLine(turnId: string, lang: Lang, r: AssistantQueryResponse): string {
  return isGenericHeadline(r.headline) ? phraseFor(turnId, lang, r) : r.headline;
}
