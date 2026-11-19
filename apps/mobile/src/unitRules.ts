import type { UnitFields } from '@wehdathub/shared';

// The add/edit unit rules, the same as the website (web/static/unitFields.js) and the server's field table (domain/fieldRules.js).
// Copied here because the app works offline; if the server's table changes, change it here too.

const APARTMENT_LIKE = ['apartment', 'duplex', 'penthouse', 'chalet', 'triplex', 'triplex_roof', 'sky_loft', 'basement', 'roof'];
const VILLA_LIKE = ['villa', 'townhouse', 'i_villa', 'twin_villa', 'maisonette'];
const COMMERCIAL = ['office', 'shop', 'clinic', 'commercial'];

/** The unit types each optional size field is asked for. A field with a value always shows, whatever the type. */
export const FIELD_TYPES: Record<'land_area' | 'garden_area' | 'roof_area' | 'floor_level', string[]> = {
  land_area: [...VILLA_LIKE, 'land'],
  garden_area: [...VILLA_LIKE, 'duplex', 'apartment', 'chalet', 'triplex'],
  roof_area: [...VILLA_LIKE, 'duplex', 'penthouse', 'triplex', 'triplex_roof', 'sky_loft', 'roof'],
  floor_level: [...APARTMENT_LIKE, 'studio', ...COMMERCIAL],
};

/** The delivery and payment section: off for a rental, so its fields are never sent. */
export const DELIVERY_FIELDS = ['is_ready', 'delivery_year', 'delivery_quarter'];
export const PAYMENT_FIELDS = [
  'down_payment_value', 'remaining_amount', 'installment_value', 'payment_frequency', 'installments_end', 'cash_price',
  'maintenance_pct', 'maintenance_terms', 'project', 'developer',
  ...[1, 2, 3].flatMap((i) => [`plan_down_${i}`, `plan_years_${i}`, `plan_freq_${i}`]),
];
/** Only on the phone: what the box shows (never sent to the server). */
export const LOCAL_FIELDS = ['place_label', 'place_path', 'place_zones', 'area_path'];

/** A garden or roof area is the feature too: a unit with one has the matching chip (web: unitFields.js). */
export function withImpliedFeatures(f: UnitFields): UnitFields {
  const keys = Array.isArray(f.feature) ? f.feature : [];
  const implied = [
    Number(f.garden_area) > 0 ? 'private_garden' : null,
    Number(f.roof_area) > 0 ? 'roof' : null,
  ].filter((k): k is string => Boolean(k) && !keys.includes(k as string));
  return implied.length ? { ...f, feature: [...keys, ...implied] } : f;
}

/**
 * The fitted kitchen and ACs features and the Furnishing field are one fact (web: unitBox.js): a change in either shows in the other.
 * kitchen + AC = "kitchen and AC", AC only, kitchen only. "Furnished" and "semi-furnished" mean more, so they stay as they are.
 * `prev` is the fields before a change, `next` after it; the returned fields have the other side brought into line.
 */
const KITCHEN = 'kitchen_installed';
const AC = 'ac_installed';
const HALF: Record<string, [boolean, boolean]> = { kitchen_and_ac: [true, true], ac_only: [false, true], kitchen_only: [true, false] };
export function withFurnishingSync(prev: UnitFields, next: UnitFields): UnitFields {
  const keysOf = (f: UnitFields) => (Array.isArray(f.feature) ? (f.feature as string[]) : []);
  const pk = keysOf(prev);
  const nk = keysOf(next);
  const pf = String(prev.furnishing ?? '');
  const nf = String(next.furnishing ?? '');
  if (pf !== nf) {
    const want = HALF[nf];
    let keys = nk;
    if (want || nf === 'unfurnished' || (nf === '' && HALF[pf])) {
      keys = keys.filter((k) => k !== KITCHEN && k !== AC);
      if (want?.[0]) keys = [...keys, KITCHEN];
      if (want?.[1]) keys = [...keys, AC];
    }
    return keys.length === nk.length && keys.every((k, i) => k === nk[i]) ? next : { ...next, feature: keys };
  }
  if (pk.includes(KITCHEN) === nk.includes(KITCHEN) && pk.includes(AC) === nk.includes(AC)) return next;
  if (nf === 'furnished' || nf === 'semi_furnished') return next;
  const k = nk.includes(KITCHEN);
  const a = nk.includes(AC);
  const furnishing = k && a ? 'kitchen_and_ac' : a ? 'ac_only' : k ? 'kitchen_only' : HALF[nf] ? '' : nf;
  return furnishing === nf ? next : { ...next, furnishing };
}

const filled = (v: UnitFields[string]) => v !== undefined && v !== null && v !== '' && v !== false && !(Array.isArray(v) && v.length === 0);

/** Whether a size field shows for this unit type (or already has a value). */
export function sizeShows(field: keyof typeof FIELD_TYPES, type: string | undefined, fields: UnitFields): boolean {
  return (!!type && FIELD_TYPES[field].includes(type)) || filled(fields[field]);
}

/** The rental-only and sale-only fields that are switched off for this deal. */
export function offFields(fields: UnitFields): string[] {
  if (fields.listing_type === 'rent') return [...DELIVERY_FIELDS, ...PAYMENT_FIELDS];
  return ['rent_period'];
}

/** What is sent to the server: the fields of the sections that are on for this deal, without the phone-only ones. */
export function sendable(fields: UnitFields): UnitFields {
  const off = new Set([...offFields(fields), ...LOCAL_FIELDS]);
  return Object.fromEntries(Object.entries(fields).filter(([k]) => !off.has(k))) as UnitFields;
}

/** The add flow's four steps (rentals skip step 3). */
export type Step = 1 | 2 | 3 | 4;
export const stepsFor = (fields: UnitFields): Step[] => (fields.listing_type === 'rent' ? [1, 2, 4] : [1, 2, 3, 4]);

const STEP_OF: Record<string, Step> = {
  listing_type: 1, market: 1, property_type: 1, location: 1, compound: 1,
  price_value: 2, monthly_rent: 2, area_value: 2, bua: 2, bedrooms: 2, bathrooms: 2, floor: 2, finishing: 2, furnishing: 2, land_area: 2,
  delivery: 3, delivery_or_ready: 3, installment_value: 3, installment_details: 3, installments_question: 3, installments_end: 3,
  payment_frequency: 3, primary_plan: 3, project_or_developer: 3, maintenance: 3, resale_two_of_three: 3,
};
/** The step a blocker from the server belongs to (owner, photos and anything unknown are on step 4). */
export const stepOf = (field: string): Step => STEP_OF[field] ?? 4;
