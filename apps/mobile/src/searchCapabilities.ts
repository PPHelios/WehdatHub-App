import type { LeadQueue, LeadTab } from '@wehdathub/shared';

export const SEARCH_DESTINATIONS = {
  notifications: { route: 'Notifications', aliases: /^(?:(?:open |show )?notifications?|notification settings|اشعارات|الاشعارات|اعدادات الاشعارات|افتح الاشعارات)$/ },
  savedSearches: { route: 'SavedSearches', aliases: /^(?:(?:open |show |my )?saved searches|البحث المحفوظ|عمليات البحث المحفوظه|افتح البحث المحفوظ)$/ },
  settings: { route: 'Settings', aliases: /^(?:open |show )?(?:settings|preferences|language settings|app language|dark mode|light mode|اعدادات|الاعدادات|افتح الاعدادات|اعدادات اللغه|غير اللغه|اللغه|الوضع الداكن|الوضع الفاتح|خلي التطبيق عربي|خلي التطبيق انجليزي)$/ },
  team: { route: 'Team', aliases: /team workload|broker capacity|most overdue follow[ -]?ups|شغل الفريق|مين عنده متابعات متاخره|مين فاضي يستلم عملا/ },
  sources: { route: 'Sources', aliases: /lead sources|marketing sources|مصادر العملاء|مصادر العملا|مصدر العملاء/ },
  losses: { route: 'WinLoss', aliases: /win[ /-]loss|lost deals|why did we lose|اسباب الخساره|ليه خسرنا الصفقات|الصفقات اللي ضاعت/ },
  changes: { route: 'ActivityLog', aliases: /activity log|what changed|what happened while|سجل النشاط|ايه اللي حصل|ايه اللي اتغير/ },
  compare: { route: 'Compare', aliases: /^(?:compare units|compare these (?:three |two )?units|قارن الوحدات|قارن الوحدات دي)/ },
  deals: { route: 'Deals', aliases: /whats holding up (?:this|the) deal|pending deals|الصفقه واقفه ليه|الصفقات المعلقه/ },
  ask: { route: 'Ask', aliases: /^(?:open ask|ask assistant|اسال المساعد|افتح المساعد)$/ },
} as const;

type Destination = keyof typeof SEARCH_DESTINATIONS;
type LeadFilters = { queue?: LeadQueue; tab?: LeadTab; lookup?: string; matching?: boolean; assigned?: boolean };
export type SearchIntent =
  | { kind: 'leads'; filters: LeadFilters }
  | { kind: 'assignee'; name: string }
  | { kind: 'new-lead'; name?: string; phone?: string; paste?: string }
  | { kind: 'dashboard' | 'ranking' }
  | { kind: 'deals'; lastMonth: boolean }
  | { kind: 'source'; source: 'inventory' | 'primary' }
  | { kind: 'unit' | 'reverse'; code: string }
  | { kind: 'unit-work'; missingPhotos?: boolean }
  | { kind: 'links'; name?: string; opened?: boolean; days?: number }
  | { kind: 'route'; destination: Destination; teamOrder?: 'overdue' | 'available' }
  | { kind: 'signed-sources' }
  | { kind: 'unsupported'; feature: 'reverse' }
  | { kind: 'search' | 'clarify' };

const queues: [LeadQueue, RegExp][] = [
  ['unassigned', /unassigned|without (?:a )?(?:broker|agent)|من غير (?:وسيط|بروكر)|مش متوزع|مفيش حد مسكهم/],
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

// Match normalized text while retaining the original spelling and spacing of names.
function originalCapture(original: string, normalized: string, capture: string) {
  const start = normalized.lastIndexOf(capture);
  const end = start + capture.length;
  let first = 0;
  let last = original.length;
  for (let index = 0; index <= original.length; index += 1) {
    const length = normalizeSearchWords(original.slice(0, index)).length;
    if (length <= start) first = index;
    if (length >= end) { last = index; break; }
  }
  return original.slice(first, last).trim();
}

const noNextStep = /no next step|من غير خطوه|مفيش خطوه جايه/;
const lastMonth = /last month|الشهر اللي فات|الشهر الماضي/;
const leadWords = /\bleads?\b|عملاء|عملا|العملاء|عميل/;
const unitCode = /^([a-z][a-z0-9]*-?\d+[a-z0-9-]*)$/i;

export function parseSearchIntent(raw: string, active?: 'leads' | 'deals'): SearchIntent {
  const original = raw.trim().replace(/[؟?!]+$/, '');
  const q = normalizeSearchWords(original).replace(/^(?:please\s+|ممكن\s+|لو سمحت\s+)/, '');
  const newLead = /^(?:new lead|create (?:a )?lead|add (?:a )?lead|ضيف عميل|اضف عميل|اعمل عميل|عميل جديد)(?:\s*[:،,]?\s+|$)/.exec(q);
  if (newLead) {
    const details = originalCapture(original, normalizeSearchWords(original), q.slice(newLead[0].length).trim());
    const phone = /(?:\+?20|0)1[0125]\d{8}/.exec(normalizeSearchWords(details))?.[0];
    const name = phone ? details.replace(/[+٠-٩۰-۹0-9]+/g, '').replace(/[,،:\s]+$/, '').trim() : undefined;
    return { kind: 'new-lead', ...(phone ? { name, phone } : details ? { paste: details } : {}) };
  }
  const assignedTo = /^(?:(?:show (?:me )?)?leads (?:assigned to|with)|(?:اعرض |هات )?(?:العملاء|عملاء) (?:اللي مع|مع|بتوع|اللي عند))\s+(.+)$/.exec(q);
  if (assignedTo && lastMonth.test(q)) return { kind: 'clarify' };
  if (assignedTo && !noNextStep.test(q) && !queues.some(([, pattern]) => pattern.test(q))) return { kind: 'assignee', name: assignedTo[1] };
  const assignee = active === 'leads' && !queues.some(([, pattern]) => pattern.test(q)) && /^(?:only |بس بتوع |بس مع |عملاء )(.+?)(?: بس)?$/.exec(original.toLowerCase().replace(/^(?:ممكن|لو سمحت)\s+/, ''));
  if (assignee) return { kind: 'assignee', name: normalizeSearchWords(assignee[1].replace(/(?:'s|’s)$/i, '')) };
  if (active === 'deals' && /^(?:last month|this month|الشهر اللي فات|الشهر ده)(?: بس| only)?$/.test(q)) return { kind: 'deals', lastMonth: lastMonth.test(q) };
  const lookup = /^(find options for|what fits|match (?:properties|units) (?:for|to)|find lead|open lead|افتح العميل|دور علي العميل|هات العميل|دور علي وحدات ل(?:لعميل)?|ايه اللي يناسب|اخر حاجه وعدنا بيها|what did we (?:last )?promise)\s+(.+)$/.exec(q);
  if (lookup) return { kind: 'leads', filters: {
    lookup: originalCapture(original, normalizeSearchWords(original), lookup[2]),
    matching: /options|fits|match|وحدات|يناسب/.test(lookup[1]),
  } };
  if (/^l-\d+$|^(?:\+?20|0)1[0125]\d{8}$/.test(q)) return { kind: 'leads', filters: { lookup: q } };
  if (/missing photos|من غير صور|ناقصها صور/.test(q)) return { kind: 'unit-work', missingPhotos: true };
  if (/who (?:should i tell|might want)|مين يناسبه|مين مهتم بالوحده/.test(q)) {
    const code = q.split(/\s+/).find((word) => unitCode.test(word));
    return code ? { kind: 'reverse', code: code.toUpperCase() } : { kind: 'unsupported', feature: 'reverse' };
  }
  if (/sources? (?:brought|generated|led).*signed|مصادر.*صفقات.*اتوقعت/.test(q)) return { kind: 'signed-sources' };
  if (/viewings tomorrow|viewings do i have tomorrow|معاينات بكره|معاينات بكرا/.test(q)) return { kind: 'leads', filters: { queue: 'viewings-tomorrow' } };
  if (/open(?:ed)? (?:my )?links|فتح (?:اللينكات|الروابط)/.test(q)) return { kind: 'links', opened: true };
  const sent = /^(?:find (?:the )?(?:offer|link) i sent|هات اللينك اللي بعته(?: ل)?|هات العرض اللي بعته(?: ل)?)\s*(.+?)(?:\s+(last week|الاسبوع اللي فات))?$/.exec(q);
  if (sent) {
    const name = originalCapture(original, normalizeSearchWords(original), sent[1]);
    return { kind: 'links', name, days: sent[2] ? 7 : undefined };
  }
  for (const [destination, cap] of Object.entries(SEARCH_DESTINATIONS)) {
    if (cap.aliases.test(q)) return { kind: 'route', destination: destination as Destination,
      ...(destination === 'team' ? { teamOrder: /overdue|متاخره/.test(q) ? 'overdue' : /capacity|فاضي/.test(q) ? 'available' : undefined } : {}) };
  }
  if (/top (?:achiever|broker)|who closed the most|اعلي وسيط|افضل بروكر|مين اكتر واحد قفل/.test(q)) return { kind: 'ranking' };
  if (/^(?:(?:open|show(?: me)?) (?:the )?)?(?:agency )?dashboard$|لوحه (?:الشركه|التحكم)/.test(q)) return { kind: 'dashboard' };
  if (/closed deals|deals (?:did we close|closed)|how many deals|الصفقات|صفقات.*(?:قفلنا|اتقفلت)|كام صفقه/.test(q)) return { kind: 'deals', lastMonth: lastMonth.test(q) };
  if (/need confirmation|units to check|وحدات.*تحتاج تاكيد|وحدات.*محتاجه مراجعه|اكد الوحدات/.test(q)) return { kind: 'unit-work' };
  const openUnit = /^(?:open|open unit|افتح|افتح الوحده)\s+(.+)$/.exec(q);
  if (openUnit && unitCode.test(openUnit[1])) return { kind: 'unit', code: openUnit[1].toUpperCase() };
  const matchingQueues = queues.filter(([, pattern]) => pattern.test(q)).map(([queue]) => queue);
  if (matchingQueues.length > 1 || (matchingQueues.length && lastMonth.test(q) && !/assigned|اتسلم|اتوزع/.test(q.replace(/unassigned/g, '')))) return { kind: 'clarify' };
  if (matchingQueues[0]) return { kind: 'leads', filters: { queue: matchingQueues[0], ...(lastMonth.test(q) ? { assigned: true } : {}) } };
  if (noNextStep.test(q)) return { kind: 'leads', filters: { tab: 'no_next_step' } };
  if (/call today|follow[ -]?ups today|متابعات النهارده|اكلم مين النهارده/.test(q)) return { kind: 'leads', filters: { tab: 'due_today' } };
  if (/pipeline|مراحل العملاء|مراحل العملا/.test(q) || /^(?:show (?:me )?(?:the )?|my |اعرض |هات )?(?:leads\b|العملاء|عملائي)/.test(q)) {
    if (lastMonth.test(q) && !/assigned|اتسلم|اتوزع/.test(q)) return { kind: 'clarify' };
    return { kind: 'leads', filters: { assigned: lastMonth.test(q) } };
  }
  const primary = /\bprimary\b|(?:^|\s)(?:برايمري|برايمرى|اولي)(?=\s|[:،,.]|$)/.test(q);
  if (primary) return { kind: 'source', source: 'primary' };
  const inventory = /\b(resale|inventory)\b|ريسيل|اعاده البيع/.test(q);
  if (inventory) return { kind: 'source', source: 'inventory' };
  if (/^(?:who|why|what|how many|مين|ليه|كام|ايه)(?:\s|$)/.test(q) && !leadWords.test(q)) return { kind: 'clarify' };
  return { kind: 'search' };
}
