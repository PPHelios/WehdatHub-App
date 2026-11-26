import type { LeadQueue, LeadTab } from '@wehdathub/shared';

type LeadFilters = { queue?: LeadQueue; tab?: LeadTab; lookup?: string; assigned?: boolean };
export type SearchIntent =
  | { kind: 'leads'; filters: LeadFilters }
  | { kind: 'assignee'; name: string }
  | { kind: 'deals'; lastMonth: boolean }
  | { kind: 'source'; source: 'inventory' | 'primary' }
  | { kind: 'search' | 'clarify' };

const queues: [LeadQueue, RegExp][] = [
  ['unassigned', /unassigned|without (?:a )?(?:broker|agent)|(?:من غير|بدون) (?:وسيط|بروكر)|مش متوزع|مفيش حد مسكهم/],
  ['uncontacted', /uncontacted|not contacted|nobody (?:called|contacted)|محدش كلم|لسه ما اتكلموش|لسه متكلموش/],
  ['late-response', /late (?:first )?(?:reply|response)|(?:first )?response deadline|delayed response|ميعاد اول رد عدي|تاخير الرد|متاخرين في الرد/],
  ['overdue', /overdue follow[ -]?ups?|متابعات متاخره|المتابعات اللي اتاخرت/],
];

export function normalizeSearchWords(raw: string) {
  return raw.trim().toLowerCase().normalize('NFKC')
    .replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) & 15))
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[\u0640\u064b-\u065f'’]/g, '').replace(/\s+/g, ' ');
}

const noNextStep = /no next step|من غير خطوه|مفيش خطوه جايه/;
const lastMonth = /last month|الشهر اللي فات|الشهر الماضي/;
const leadWords = /\bleads?\b|عملاء|عملا|العملاء|عميل/;

/**
 * Fallback/local intent classifier for Home Search:
 * Screen shortcuts, report-screen jumps, unit-code opens, work queues, and client matching are removed;
 * keeps only direct L-code/phone lead lookup, queue fallbacks, Primary/Resale explicit keywords, and search.
 */
export function parseSearchIntent(raw: string, active?: 'leads' | 'deals'): SearchIntent {
  const original = raw.trim().replace(/[؟?!]+$/, '');
  const q = normalizeSearchWords(original).replace(/^(?:please\s+|ممكن\s+|لو سمحت\s+)/, '');
  if (!q) return { kind: 'search' };

  const assignedTo = /^(?:(?:show (?:me )?)?leads (?:assigned to|with)|(?:اعرض |هات )?(?:العملاء|عملاء) (?:اللي مع|مع|بتوع|اللي عند))\s+(.+)$/.exec(q);
  if (assignedTo && lastMonth.test(q)) return { kind: 'clarify' };
  if (assignedTo && !noNextStep.test(q) && !queues.some(([, pattern]) => pattern.test(q))) return { kind: 'assignee', name: assignedTo[1] };

  const assignee = active === 'leads' && !queues.some(([, pattern]) => pattern.test(q)) && /^(?:only |بس بتوع |بس مع |عملاء )(.+?)(?: بس)?$/.exec(original.toLowerCase().replace(/^(?:ممكن|لو سمحت)\s+/, ''));
  if (assignee) return { kind: 'assignee', name: normalizeSearchWords(assignee[1].replace(/(?:'s|’s)$/i, '')) };

  if (active === 'deals' && /^(?:last month|this month|الشهر اللي فات|الشهر ده)(?: بس| only)?$/.test(q)) {
    return { kind: 'deals', lastMonth: lastMonth.test(q) };
  }

  // Lead lookup by L-code or Egyptian phone number (lead updates & status changes use SearchLeadAction directly).
  if (/^l-\d+$|^(?:\+?20|0)1[0125]\d{8}$/.test(q)) return { kind: 'leads', filters: { lookup: q } };

  const matchingQueues = queues.filter(([, pattern]) => pattern.test(q)).map(([queue]) => queue);
  if (matchingQueues.length > 1 || (matchingQueues.length && lastMonth.test(q) && !/assigned|اتسلم|اتوزع/.test(q.replace(/unassigned/g, '')))) return { kind: 'clarify' };
  if (matchingQueues[0]) return { kind: 'leads', filters: { queue: matchingQueues[0], ...(lastMonth.test(q) ? { assigned: true } : {}) } };

  const primary = /\bprimary\b|(?:^|\s)(?:برايمري|برايمرى|اولي)(?=\s|[:،,.]|$)/.test(q);
  if (primary) return { kind: 'source', source: 'primary' };
  const inventory = /\b(resale|inventory)\b|ريسيل|اعاده البيع/.test(q);
  if (inventory) return { kind: 'source', source: 'inventory' };
  if (/^(?:who|why|what|how many|مين|ليه|كام|ايه)(?:\s|$)/.test(q) && !leadWords.test(q)) return { kind: 'clarify' };
  return { kind: 'search' };
}
