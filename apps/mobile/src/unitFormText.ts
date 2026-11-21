import type { Lang } from '@wehdathub/shared';

// Strings of the add/edit unit form that are new with the one box and the four sections (docs/plans/unified-unit-box.md).
const TEXT = {
  ar: {
    step1: 'الوحدة والمكان', step2: 'المساحة والسعر', step3: 'التسليم والدفع', step4: 'المالك والصور',
    next: 'التالي', back: 'رجوع', jump: 'أقسام الفورم',
    boxLabel: 'المكان والمميزات *', boxPlaceholder: 'اكتب كمبوند، منطقة، أو ميزة… (مثال: ميفيدا، بحري، روف)',
    boxRequest: 'اطلب مكان جديد: «{s}»', boxOther: 'ضيف «{s}» كميزة تانية', boxNotInList: 'مش في القائمة', boxNew: 'جديد',
    boxSwap: 'اتغير المكان: {a} بقى {b}', boxPlaces: 'الأماكن', boxFeatures: 'المميزات', boxNoPlace: 'اختار مكان من القايمة',
    boxFromText: 'اتقرا من الرسالة. راجعه قبل الحفظ.', boxRemove: 'شيل {s}',
    newTitle: 'اطلب مكان جديد', newHint: 'بيتحفظ مع الوحدة ويتراجع من الإدارة. المنطقة مطلوبة.',
    newName: 'الاسم بالإنجليزي *', newAr: 'الاسم بالعربي (اختياري)', newMap: 'لينك جوجل ماب (اختياري)',
    newDistrict: 'المنطقة الفرعية', newCity: 'المدينة',
    newArea: 'المنطقة *', newAreaSearch: 'ابحث بالعربي أو الإنجليزي', newAreaPick: 'اختار منطقة من القايمة', newSub: 'منطقة فرعية (اختياري)',
    newSave: 'اطلب المكان', newCancel: 'إلغاء',
    ownerPrivate: 'بيانات المالك والعمولة والملاحظات مش بتظهر للعميل.',
    description: 'وصف للعميل', describeAgain: 'اكتب الوصف من بيانات الوحدة',
    landLabel: 'مساحة الأرض م²', gardenLabel: 'الجنينة م²', roofLabel: 'الروف م²',
    rentLabel: 'الإيجار الشهري *', priceLabel: 'السعر *',
    ownerLeadHint: 'كود العميل لو المالك عميل عندك (L-0042)', moreDetails: 'تفاصيل أكتر (عمولة، وسيط، عنوان، لوكيشن)',
    jumpBlocked: 'ناقص في الخطوة دي. راجعه قبل ما تكمّل.',
  },
  en: {
    step1: 'Unit and place', step2: 'Size and price', step3: 'Delivery and payment', step4: 'Owner and photos',
    next: 'Next', back: 'Back', jump: 'Form sections',
    boxLabel: 'Place and features *', boxPlaceholder: 'Type a compound, an area or a feature… (e.g. Mivida, north facing, roof)',
    boxRequest: 'Request a new place: “{s}”', boxOther: 'Add “{s}” as another feature', boxNotInList: 'not in the list', boxNew: 'new',
    boxSwap: 'Place changed: {a} is now {b}', boxPlaces: 'Places', boxFeatures: 'Features', boxNoPlace: 'Pick a place from the list',
    boxFromText: 'Read from the message. Check it before saving.', boxRemove: 'Remove {s}',
    newTitle: 'Request a new place', newHint: 'It is saved with the unit and reviewed by the agency. The area is required.',
    newName: 'Name in English *', newAr: 'Arabic name (optional)', newMap: 'Google Maps link (optional)',
    newDistrict: 'Sub-area', newCity: 'City',
    newArea: 'Area *', newAreaSearch: 'Search in Arabic or English', newAreaPick: 'Pick an area from the list', newSub: 'Sub-zone (optional)',
    newSave: 'Request the place', newCancel: 'Cancel',
    ownerPrivate: 'Owner, commission and notes are never shown to clients.',
    description: 'Description for clients', describeAgain: 'Write it from the unit details',
    landLabel: 'Land m²', gardenLabel: 'Garden m²', roofLabel: 'Roof m²',
    rentLabel: 'Monthly rent *', priceLabel: 'Price *',
    ownerLeadHint: 'Lead code if the owner is your client (L-0042)', moreDetails: 'More details (commission, co-broker, address, location)',
    jumpBlocked: 'Missing in this step. Check it before going on.',
  },
};

export type FormText = typeof TEXT.ar;
/** A string with its {placeholders} filled in. */
export const fill = (s: string, values: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_m, k) => values[k] ?? '');
export const uf = (lang: Lang): FormText => (lang === 'en' ? TEXT.en : TEXT.ar);
