import type { Lang } from '@wehdathub/shared';

/** Plan, expiry ladder and payment words. Egyptian Arabic first. `{n}` is replaced by planFmt. No prices for brokers: they only ever read the ask-your-manager lines. */
const P = {
  ar: {
    bannerGrace: 'باقتك خلصت وإنت في فترة سماح: فاضل {n} يوم وكل حاجة شغالة.',
    bannerReadonly: 'الحساب للقراءة بس: تشوف وتبحث، لكن مينفعش تضيف أو تعدّل أو تستخدم الذكاء الاصطناعي. فاضل {n} يوم قبل ما يتوقف.',
    bannerBlocked: 'الحساب متوقف لحد التجديد. بياناتك محفوظة.',
    askManager: 'اطلب من مديرك يجدّد الباقة.',
    renewCta: 'جدّد الباقة',
    titleReadonly: 'الحساب للقراءة بس',
    titleBlocked: 'الحساب متوقف',
    bodyReadonly: 'الإضافة والتعديل والذكاء الاصطناعي واللينكات الجديدة متوقفة لحد ما الباقة تتجدّد.',
    bodyBlocked: 'الحساب متوقف لحد التجديد. بياناتك محفوظة.',
    openPlan: 'افتح صفحة الباقة',
    ok: 'تمام',
    perMonth: '≈ {n} جنيه / شهر',
    months: '{n} شهر',
    month1: 'شهر',
    pricesTitle: 'الأسعار بالجنيه (من غير ضريبة)',
    payNote: 'الدفع بإنستاباي أو تحويل بنكي بس.',
    unitsWarn: 'وصلت {n}% من حد الوحدات. بتتحسب المتاحة والمؤرشفة والمباعة. رقّي الباقة قبل ما توصل للحد.',
    unlimited: 'غير محدود',
    srcGrace: 'فترة سماح',
    srcReadonly: 'للقراءة بس',
    srcBlocked: 'متوقفة',
    srcTrial: 'فترة تجربة',
    errSame: 'دي باقتك الحالية بنفس المدة.',
    errDowngrade: 'مينفعش تنزّل الباقة وهي لسه مدفوعة. تقدر ترقّيها بس.',
    errPeriod: 'مينفعش تغيّر المدة وباقتك لسه مدفوعة.',
    errPending: 'فيه طلب ترقية مستني التأكيد.',
    errLapsed: 'الباقة خلصت. اختار باقة ومدة جديدة بدل الترقية.',
    errNotPaid: 'الترقية للباقات المدفوعة بس.',
    errPlan: 'الباقة أو المدة دي مش متاحة.',
    teamSeats: 'وصلت للحد الأقصى من المستخدمين في باقتك. رقّي الباقة من صفحة الباقة.',
  },
  en: {
    bannerGrace: 'Your plan ended and you are in a grace period: {n} days left and everything still works.',
    bannerReadonly: 'The account is read-only: you can view and search, but not add, edit or use AI. {n} days left before it stops.',
    bannerBlocked: 'The account is stopped until it is renewed. Your data is safe.',
    askManager: 'Ask your manager to renew the plan.',
    renewCta: 'Renew the plan',
    titleReadonly: 'The account is read-only',
    titleBlocked: 'The account is stopped',
    bodyReadonly: 'Adding, editing, AI and new links are off until the plan is renewed.',
    bodyBlocked: 'The account is stopped until it is renewed. Your data is safe.',
    openPlan: 'Open the Plan page',
    ok: 'OK',
    perMonth: '≈ {n} EGP / month',
    months: '{n} months',
    month1: 'month',
    pricesTitle: 'Prices in EGP (no VAT)',
    payNote: 'Payment by InstaPay or bank transfer only.',
    unitsWarn: 'You reached {n}% of your unit limit. Available, archived and sold units all count. Upgrade the plan before you hit the limit.',
    unlimited: 'Unlimited',
    srcGrace: 'Grace period',
    srcReadonly: 'Read-only',
    srcBlocked: 'Stopped',
    srcTrial: 'Trial',
    errSame: 'This is already your plan for the same length.',
    errDowngrade: 'You cannot downgrade while the plan is paid. You can only upgrade.',
    errPeriod: 'You cannot change the length while the plan is paid.',
    errPending: 'An upgrade request is already waiting for confirmation.',
    errLapsed: 'The plan has ended. Choose a new plan and length instead of an upgrade.',
    errNotPaid: 'Upgrades are for paid plans only.',
    errPlan: 'This plan or length is not available.',
    teamSeats: 'Your plan has reached its user limit. Upgrade the plan from the Plan page.',
  },
} as const;

export type PlanTextKey = keyof (typeof P)['ar'];

/** Formats days remaining according to Arabic plural rules and English rules. */
export function formatDaysArabic(n: number): string {
  if (n <= 0) return 'النهارده آخر يوم';
  if (n === 1) return 'فاضل يوم';
  if (n === 2) return 'فاضل يومين';
  if (n >= 3 && n <= 10) return `فاضل ${n} أيام`;
  return `فاضل ${n.toLocaleString('en-US')} يوم`;
}

export function formatDaysLeft(lang: Lang, n: number): string {
  if (lang === 'ar') return formatDaysArabic(n);
  if (n <= 0) return 'today is the last day';
  if (n === 1) return '1 day left';
  return `${n} days left`;
}

export function preEndText(lang: Lang, source: 'paid' | 'trial', daysLeft: number): string {
  if (lang === 'ar') {
    if (source === 'trial') {
      if (daysLeft <= 0) return 'النهارده آخر يوم في فترة التجربة. اختار باقة عشان تكمل شغل.';
      return `${formatDaysArabic(daysLeft)} على انتهاء فترة التجربة. اختار باقة عشان تكمل شغل.`;
    }
    if (daysLeft <= 0) return 'النهارده آخر يوم في باقتك. جدّد قبل ما تنتهي.';
    return `${formatDaysArabic(daysLeft)} على انتهاء باقتك. جدّد دلوقتي عشان مفيش حاجة تقف.`;
  }
  if (source === 'trial') {
    if (daysLeft <= 0) return 'Today is the last day of your trial. Choose a plan to keep working.';
    return `${formatDaysLeft('en', daysLeft)} on your trial. Choose a plan to keep working.`;
  }
  if (daysLeft <= 0) return 'Today is the last day of your plan. Renew before it expires.';
  return `${formatDaysLeft('en', daysLeft)} on your plan. Renew now to avoid interruption.`;
}

export function unitCapText(lang: Lang, pct: number): string {
  if (lang === 'ar') {
    if (pct >= 100) return 'وصلت للحد الأقصى للوحدات (100%). مينفعش تضيف وحدات جديدة لحد ما ترقّي الباقة.';
    return `استهلكت ${pct}% من حد الوحدات. قربت توصل للحد الأقصى، رقّي باقتك قبل ما توصل للحد.`;
  }
  if (pct >= 100) return 'You reached 100% of your unit limit. You cannot add new units until you upgrade.';
  return `You reached ${pct}% of your unit limit. Upgrade your plan before you hit the limit.`;
}

/** A plan string; `{n}` is replaced by `n` when given. */
export const planT = (lang: Lang, key: PlanTextKey, n?: number | string): string => {
  if (typeof n === 'number') {
    if (key === 'bannerGrace') {
      if (lang === 'ar') {
        const d = n <= 0 ? 'النهارده آخر يوم' : formatDaysArabic(n);
        return `باقتك خلصت وإنت في فترة سماح: ${d} وكل حاجة شغالة.`;
      }
      const d = n <= 0 ? 'today is the last day' : n === 1 ? '1 day left' : `${n} days left`;
      return `Your plan ended and you are in a grace period: ${d} and everything still works.`;
    }
    if (key === 'bannerReadonly') {
      if (lang === 'ar') {
        const d = n <= 0 ? 'النهارده آخر يوم' : formatDaysArabic(n);
        return `الحساب للقراءة بس: تشوف وتبحث، لكن مينفعش تضيف أو تعدّل أو تستخدم الذكاء الاصطناعي. ${d} قبل ما يتوقف.`;
      }
      const d = n <= 0 ? 'Today is the last day' : n === 1 ? '1 day left' : `${n} days left`;
      return `The account is read-only: you can view and search, but not add, edit or use AI. ${d} before it stops.`;
    }
  }
  const s: string = P[lang][key];
  return n === undefined ? s : s.replace('{n}', typeof n === 'number' ? n.toLocaleString('en-US') : n);
};
