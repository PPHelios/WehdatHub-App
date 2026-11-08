import type { Lang } from '@wehdathub/shared';

const strings = {
  ar: {
    signIn: 'الدخول', phoneLabel: 'رقم الموبايل المسجل', phoneHint: 'هيوصلك كود على البوت (تليجرام أو واتساب).', sendCode: 'ابعتلي الكود',
    codeLabel: 'الكود (6 أرقام)', verify: 'دخول', changeNumber: 'غيّر الرقم', resend: 'ابعت الكود تاني', codeSent: 'لو الرقم ده مسجل، الكود هيوصلك على البوت خلال دقيقة.',
    badPhone: 'اكتب رقم موبايل صحيح.', badCode: 'اكتب الكود المكوّن من 6 أرقام.', wrongCode: 'الكود مش صح، أو انتهى، أو اتستخدم قبل كده.',
    tooMany: 'محاولات كتير. استنى شوية وحاول تاني.', offline: 'مفيش اتصال بالسيرفر. اتأكد من النت وحاول تاني.', serverError: 'حصلت مشكلة عندنا. حاول تاني بعد شوية.',
    retry: 'حاول تاني', loading: 'بنحمّل…', units: 'الوحدات', more: 'المزيد', search: 'ابحث بكود الوحدة', active: 'نشطة', sold: 'مباعة', archived: 'مؤرشفة',
    noUnits: 'مفيش وحدات هنا', noUnitsHint: 'جرّب فلتر تاني أو امسح البحث.', clearSearch: 'امسح البحث', egp: 'جنيه', beds: 'غرف', baths: 'حمامات', sqm: 'م²',
    unit: 'الوحدة', unitMissing: 'الوحدة دي مش موجودة أو مش متاحة ليك.', backToUnits: 'ارجع للوحدات', photos: 'صور', features: 'المميزات', mine: 'وحدتك',
    today: 'النهارده', followUps: 'متابعات', viewings: 'معاينات', newLeads: 'عملاء جدد', call: 'اتصل', allClear: 'مفيش حاجة مستعجلة النهارده', allClearHint: 'شوف الوحدات أو ارجع بعدين.', openUnits: 'افتح الوحدات', moreTasks: 'مهام تانية:', late: 'متأخر', viewing: 'معاينة', hot: 'عميل ساخن', callTask: 'مكالمة', matches: 'وحدات مناسبة', noPhone: 'مفيش رقم', signOut: 'تسجيل الخروج', agency: 'الشركة', loadMore: 'بنحمّل أكتر…',
  },
  en: {
    signIn: 'Sign in', phoneLabel: 'Your registered mobile', phoneHint: 'A code reaches you through the bot (Telegram or WhatsApp).', sendCode: 'Send me the code',
    codeLabel: 'Code (6 digits)', verify: 'Sign in', changeNumber: 'Change number', resend: 'Send the code again', codeSent: 'If this number is registered, the code reaches you through the bot within a minute.',
    badPhone: 'Enter a valid mobile number.', badCode: 'Enter the 6-digit code.', wrongCode: 'That code is wrong, expired, or already used.',
    tooMany: 'Too many attempts. Wait a little and try again.', offline: "Can't reach the server. Check your connection and try again.", serverError: 'Something went wrong on our side. Try again shortly.',
    retry: 'Try again', loading: 'Loading…', units: 'Units', more: 'More', search: 'Search by unit code', active: 'Active', sold: 'Sold', archived: 'Archived',
    noUnits: 'No units here', noUnitsHint: 'Try another filter or clear the search.', clearSearch: 'Clear search', egp: 'EGP', beds: 'beds', baths: 'baths', sqm: 'm²',
    unit: 'Unit', unitMissing: "This unit doesn't exist or isn't available to you.", backToUnits: 'Back to units', photos: 'Photos', features: 'Features', mine: 'Your unit',
    today: 'Today', followUps: 'Follow-ups', viewings: 'Viewings', newLeads: 'New leads', call: 'Call', allClear: 'Nothing urgent today', allClearHint: 'Check the units or come back later.', openUnits: 'Open units', moreTasks: 'More tasks:', late: 'Overdue', viewing: 'Viewing', hot: 'Hot lead', callTask: 'Call', matches: 'Matching units', noPhone: 'No number', signOut: 'Sign out', agency: 'Agency', loadMore: 'Loading more…',
  },
} as const;

export type StringKey = keyof (typeof strings)['ar'];
export const t = (lang: Lang, key: StringKey): string => strings[lang][key];
