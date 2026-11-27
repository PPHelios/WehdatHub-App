import { shouldUseAssistantEndpoint } from '../src/screens/SearchScreen';

describe('SearchScreen shouldUseAssistantEndpoint phrase coverage', () => {
  const assistantQueries = [
    'Unassigned leads',
    'without broker',
    'no broker',
    'not assigned',
    'عملاء من غير وسيط',
    'عملاء بدون وسيط',
    'ملهمش وسيط',
    'لسه متوزعوش',
    'Leads waiting over 1h',
    'late first contact',
    'delayed first contact',
    'تأخر أول تواصل',
    'بقالهم اكتر من ساعه',
    'Overdue follow-ups',
    'missed follow ups',
    'متابعات متأخرة',
    'متابعات فايتة',
    'Uncontacted leads',
    'never contacted',
    'لسه متكلموش',
    'Approaching SLA',
    'قربوا يعدوا',
    'Opened offer link without follow-up',
    'شافوا العرض ومحدش تابع',
    'Who has showing today?',
    'Who has showing next week?',
    'Who has showing last week?',
    'معاينات النهارده',
    'معاينات بكرة',
    'جدول المعاينات',
    'How is Sara doing this week?',
    'How many showings does khaled has?',
    'تقييم سارة',
    'سارة عملت ايه',
    'أخبار سارة',
    'خالد عنده كام معاينة',
    "Omar's team this month",
    'شغل فريق عمر',
    'تيم عمر',
    'Silent brokers',
    'inactive brokers',
    'الوسطاء اللي مش بيردوا',
    'مين مش بيرد',
    'مبيردوش',
    'مبيحدثوش',
    'Average response time',
    'سرعة الرد',
    'بنرد في قد ايه',
    'Brokers with no next step',
    'عملاء من غير خطوة',
    'Agency brief',
    'ملخص الشركة',
    'حالة الشركة',
    'الوضع ايه',
    'Resale deals this month',
    'صفقات الريسيل',
    'Developer commissions due',
    'عمولات المطورين',
    'Lead sources performance',
    'فيسبوك',
    'أحسن مصدر',
    'Win / loss reasons',
    'أسباب الخسارة',
    'ليه بنخسر',
    'Leases ending soon',
    'عقود إيجار قربت تخلص',
  ];

  test.each(assistantQueries)('routes "%s" to assistant endpoint', (q) => {
    expect(shouldUseAssistantEndpoint(q, 'auto', false)).toBe(true);
  });

  const unitQueries = [
    '3 bedroom apartment in New Cairo under 9M',
    'شقة 3 غرف في التجمع تحت 9 مليون',
    'فيلا للبيع في زايد',
  ];

  test.each(unitQueries)('leaves unit search "%s" for unit search path', (q) => {
    expect(shouldUseAssistantEndpoint(q, 'auto', false)).toBe(false);
  });
});
