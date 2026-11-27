import type { AssistantMode } from '@wehdathub/shared';

function normalizeForRoute(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[\u0640\u064b-\u065f]/g, '')
    .replace(/\s+/g, ' ');
}

export function shouldUseAssistantEndpoint(clean: string, mode: AssistantMode, hasContext = false): boolean {
  if (mode !== 'auto') return true;
  const q = normalizeForRoute(clean);
  if (
    hasContext &&
    /^(?:only\s+(?:by|for|closed\s+by)|just\s+(?:for|by)|بس\s+(?:بتوع|لـ|ل|قفلها)|increase\s+budget|raise\s+budget|bump\s+budget|under\s+[\d.,]+|(?:لو\s+)?(?:زودنا|ارفع|علي)\s+الميزاني|بحد\s+اقص[يى])\b/i.test(q)
  ) {
    return true;
  }
  return /(waiting\s*(?:over|>)\s*1|waiting\s+(?:for\s+)?(?:contact|to\s+be\s+called)|delayed\s+(?:first\s+contact|reply)|late\s+first\s+contact|no\s+first\s+contact|haven'?t\s+been\s+called|without\s+(?:a\s+)?(?:broker|agent|owner)|no\s+broker|not\s+assigned|unallocated|calls?\s+(?:due\s+)?today|approaching\s+sla|near\s+sla|sla\s+soon|about\s+to\s+breach|almost\s+overdue|opened.*(?:without|no)\s+follow|open(?:ed)?\s+(?:offer|link).*no\s+follow|no\s+next\s+step|missing\s+next\s+step|not\s+updating|silent\s+broker|quiet\s+broker|inactive\s+broker|who.*updat|scorecard|(?:how\s+is|performance\s+of|scorecard\s+for|status\s+of|summary\s+for|report\s+for)\s+\S+|what\s+(?:did|has)\s+.+\s+(?:do|done)|how\s+did\s+.+\s+do|\S+(?:'s|’s)\s+team\b|(?:the|my|our)\s+team\b|\bteam\s+(?:workload|activity|performance|calls|viewings|updates|deals|stats|summary)\b|(?:viewings?|showings?|calls?|updates?)\s+(?:by|for|of)\s+\S+|how\s+many\s+(?:viewings?|showings?|calls?|updates?|leads?|deals?|apartments?|villas?|units?|duplex(?:es)?|studios?|chalets?|penthouses?|offices?|shops?|townhouses?|twin\s*houses?)\s+(?:did|does|do)?|\b(?:viewings?|showings?)\s+(?:today|tomorrow|yesterday|this\s+week|last\s+week|next\s+week)\b|(?:upcoming|scheduled)\s+(?:viewings?|showings?)|who\s+has\s+(?:a\s+)?(?:showing|viewing)|(?:resale|primary)\s+deals?|deals?\s+(?:in|by|for|closed|involved|resale|primary)|(?:average|avg|median|first|reply)\s*response|response\s+time|how\s+fast.*(?:respond|reply)|speed\s+to\s+lead|fastest|slowest|stats\s+for\s+\S+|commission|payout|claimable|overdue|(?:missed|late|pending)\s+follow[ -]?ups?|unassigned|uncontacted|not\s+contacted|never\s+contacted|not\s+called|nobody\s+called|ad\s*spend|marketing\s*spend|\broi\b|\bcpl\b|\bcpd\b|facebook|\bfb\b|\bmeta\b|instagram|tiktok|google|olx|dubizzle|bayut|property\s*finder|nawy|lead\s+sources?|where\s+are\s+leads\s+coming\s+from|best\s+lead\s+source|leases?\s+ending|renewals?|win\s*\/?\s*loss|win\s*rate|conversion\s*rate|closing\s*rate|lost\s+reasons?|agency\s+brief|executive\s+brief|daily\s+brief|today'?s\s+summary|what\s+happened\s+today|how\s+are\s+we\s+doing|dashboard|overview|(?:من\s+غير|بدون)\s+(?:وسيط|بروكر|سيلز|حد)|مش\s+متوزع|لسه\s+متوزعوش|مش\s+متسلم|لسه\s+متسلموش|مفيش\s+حد\s+مسكهم|محدش\s+استلمهم|ملهمش\s+(?:وسيط|بروكر)|تاخر\s+اول\s+تواصل|تاخير\s+اول\s+تواصل|ات[اأ]خر(?:وا)?\s+في\s+اول\s+تواصل|محدش\s+كلم|لسه\s+متكلموش|محدش\s+اتصل|مكالمات\s+النهارده|متابعات\s+(?:متاخره|فايته|عدت)|مستنين.*(?:ساع|تواصل|رد)|انتظار.*ساع|بقالهم.*ساع|اكتر\s+من\s+ساع|عدي\s+ساعه|قربت.*ساع|قربوا\s+(?:يعدوا|يكسروا|يخلصوا|يتاخروا)|فتحوا.*(?:عرض|الرابط|اللينك).*(?:متابع|كلم)|شافوا\s+العرض|بدون\s+(?:خطوه|متابعه)\s*(?:جاي|تالي)|من\s+غير\s+خطوه|مبيحدث|مبيحدثش|مبيحدثوش|مش\s+بيحدث|مفيش\s+تحديث|بدون\s*تحديث|التزام.*(?:تحديث|فريق)|تحديثات\s+الوسطاء|(?:الوسطاء|البروكرز)?\s*اللي\s+مش\s+بيردوا|مش\s+بيردوا|مبيردوش|مش\s+بيتابعوا|مبيتابعوش|صامت|مين\s+(?:ساحب|نايم|مش\s+(?:شغال|بيرد|بيتابع))|(?:ايه\s+اخبار|اخبار|اداء|تقييم|شغل|ملخص|احصائيات|نتايج|ارقام)\s+\S+|\S+\s+(?:عمل|عملت|سجل|سجلت|كلم|كلمت|حدث|حدثت|قفل|قفلت|جاب|جابت)\s*(?:ايه|كام)?|(?:فريق|تيم)\s+\S+|\S+\s+(?:فريق|تيم)|(?:كام|كم)\s+(?:معاين|مكالم|تحديث|عميل|صفق|شقه|فيلا|وحده|دوبلكس|ستوديو|شاليه|بنتهاوس|مكتب|محل|تاون|توين)|معاينات\s+(?:النهارده|بكره|اليوم|امتي)|عندنا\s+(?:كام\s+)?معاين|جدول\s+المعاينات|صفقات\s+(?:ال)?(?:ريسيل|برايمر|في|قفلها|شارك)|وقت\s+الرد|متوسط\s+الرد|اول\s+رد|اسرع\s*(?:رد|واحد)|ابط[اأ]\s*(?:رد|واحد)|سرعه\s+الرد|بنرد\s+في\s+قد\s+ايه|فيسبوك|فيس\s*بوك|انستجرام|تيك\s*توك|جوجل|اوليكس|دوبيزل|بروبرتي|بيوت|نوي|عمولات|عموله|مستحقات\s+المطورين|صرف\s*تسويق|مصادر\s*(?:ال)?عملاء|احسن\s+مصدر|افضل\s+مصدر|العملاء\s+جايين\s+منين|عقود\s*(?:ال)?ايجار|ايجارات|تجديد\s+الايجار|خسار|ليه\s+بنخسر|الصفقات\s+اللي\s+ضاعت|معدل\s+القفل|نسبه\s+(?:القفل|النجاح)|(?:ملخص|لوحه|اداء|حاله|وضع|اخبار)\s+الشركه|تقرير\s+اليوم|الوضع\s+ايه)/i.test(q);
}
