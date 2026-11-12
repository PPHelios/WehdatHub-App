import type { Lang } from '@wehdathub/shared';

type Opt = { value: string; ar: string; en: string };
export const PROPERTY_TYPES: Opt[] = [
  { value: 'apartment', ar: 'شقة', en: 'Apartment' }, { value: 'duplex', ar: 'دوبلكس', en: 'Duplex' }, { value: 'penthouse', ar: 'بنتهاوس', en: 'Penthouse' },
  { value: 'studio', ar: 'ستوديو', en: 'Studio' }, { value: 'chalet', ar: 'شاليه', en: 'Chalet' }, { value: 'villa', ar: 'فيلا', en: 'Villa' },
  { value: 'townhouse', ar: 'تاون هاوس', en: 'Townhouse' }, { value: 'twin_villa', ar: 'توين هاوس', en: 'Twin house' }, { value: 'i_villa', ar: 'آي فيلا', en: 'i-Villa' },
  { value: 'office', ar: 'مكتب', en: 'Office' }, { value: 'shop', ar: 'محل', en: 'Shop' }, { value: 'clinic', ar: 'عيادة', en: 'Clinic' }, { value: 'land', ar: 'أرض', en: 'Land' },
];
export const FINISHING: Opt[] = [
  { value: 'core_and_shell', ar: 'بدون تشطيب', en: 'Core & shell' }, { value: 'semi_finished', ar: 'نصف تشطيب', en: 'Semi-finished' }, { value: 'fully_finished', ar: 'تشطيب كامل', en: 'Fully finished' },
  { value: 'super_lux', ar: 'سوبر لوكس', en: 'Super lux' }, { value: 'ultra_super_lux', ar: 'الترا سوبر لوكس', en: 'Ultra super lux' },
];
export const FURNISHING: Opt[] = [
  { value: 'furnished', ar: 'مفروشة', en: 'Furnished' }, { value: 'semi_furnished', ar: 'نصف مفروشة', en: 'Semi-furnished' }, { value: 'unfurnished', ar: 'غير مفروشة', en: 'Unfurnished' },
  { value: 'kitchen_and_ac', ar: 'مطبخ وتكييف', en: 'Kitchen & AC' }, { value: 'ac_only', ar: 'تكييف فقط', en: 'AC only' }, { value: 'kitchen_only', ar: 'مطبخ فقط', en: 'Kitchen only' },
];
export const options = (list: Opt[], lang: Lang) => list.map((o) => ({ value: o.value, label: lang === 'ar' ? o.ar : o.en }));

/** The label of one stored value (finishing, furnishing, type), or the value itself when it is not on the list. */
export const labelOf = (list: Opt[], value: string | null | undefined, lang: Lang): string | null => {
  if (!value) return null;
  const o = list.find((x) => x.value === value);
  return o ? (lang === 'ar' ? o.ar : o.en) : value.replace(/_/g, ' ');
};
