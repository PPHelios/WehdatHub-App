import type { ApiUnit, AssistantUnderstood, Lang } from '@wehdathub/shared';
import { t } from './i18n';
import { ALL_TYPES, FINISHING, labelOf } from './unitOptions';

/**
 * What the assistant understood, as fields. The API's `understood` only carries display strings
 * (`appliedFilters`), so the thread builds this from the query context (areaQuery, maxPrice) and the parsed filters.
 */
export interface MatchFilters {
  areaQuery?: string | null;
  maxPrice?: number | null;
  minPrice?: number | null;
  bedrooms?: number | null;
  propertyType?: string | null;
  finishing?: string | null;
  dealType?: string | null;
  /** The server's structured filters: ranges and lists. A null bound is open. */
  bedroomsMin?: number | null;
  bedroomsMax?: number | null;
  propertyTypes?: string[];
  finishings?: string[];
  deliveryReady?: boolean | null;
  deliveryByYear?: number | null;
}

/** Fields from `understood.filters` (older servers send none). */
export function filtersFromUnderstood(u: AssistantUnderstood | null | undefined): MatchFilters {
  const f = u?.filters;
  if (!f) return {};
  return {
    bedroomsMin: f.bedrooms.min, bedroomsMax: f.bedrooms.max, propertyTypes: f.propertyTypes, finishings: f.finishing,
    minPrice: f.price.min, maxPrice: f.price.max, deliveryReady: f.delivery.ready, deliveryByYear: f.delivery.byYear,
  };
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const digits = (n: number, lang: Lang) => (lang === 'ar' ? String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]) : String(n));

/** Short "✓ ..." labels for each filter the unit really satisfies. A null unit field never matches. */
export function matchReasons(unit: ApiUnit, understood: MatchFilters | null | undefined, lang: Lang, now: Date = new Date()): string[] {
  const f = understood;
  if (!f) return [];
  const out: string[] = [];
  const hasBudget = f.maxPrice != null || f.minPrice != null;
  // Budgets are EGP; a USD/EUR unit is never compared against them.
  const egp = !unit.currency || unit.currency.toUpperCase() === 'EGP';
  if (hasBudget && egp && unit.price !== null && unit.price <= (f.maxPrice ?? Infinity) && unit.price >= (f.minPrice ?? 0)) out.push(t(lang, 'rBudget'));
  if (unit.bedrooms !== null && f.bedrooms != null && unit.bedrooms === f.bedrooms) out.push(t(lang, 'rBeds').replace('{n}', digits(unit.bedrooms, lang)));
  if (unit.bedrooms !== null && f.bedrooms == null && (f.bedroomsMin != null || f.bedroomsMax != null) && unit.bedrooms >= (f.bedroomsMin ?? 0) && unit.bedrooms <= (f.bedroomsMax ?? Infinity)) out.push(t(lang, 'rBeds').replace('{n}', digits(unit.bedrooms, lang)));
  const q = norm(f.areaQuery);
  if (q) {
    // The query must equal the unit field or be a whole-word part of it: query "New Cairo" is not a hit for city "Cairo", but is for district "New Cairo".
    const words = ` ${q} `;
    const hit = [unit.district, unit.compound, unit.compoundEn, unit.city, unit.phase, unit.phaseEn].find((p) => { const n = norm(p); return n && (n === q || ` ${n} `.includes(words)); });
    if (hit) out.push(`✓ ${hit}`);
  }
  const types = [f.propertyType, ...(f.propertyTypes ?? [])].map(norm).filter(Boolean);
  if (unit.propertyType && types.includes(norm(unit.propertyType))) out.push(`✓ ${labelOf(ALL_TYPES, unit.propertyType, lang) ?? unit.propertyType}`);
  const fins = [f.finishing, ...(f.finishings ?? [])].map(norm).filter(Boolean);
  if (unit.finishing && fins.includes(norm(unit.finishing))) out.push(`✓ ${labelOf(FINISHING, unit.finishing, lang) ?? unit.finishing}`);
  if ((unit.dealType === 'sale' || unit.dealType === 'rent') && f.dealType === unit.dealType) out.push(`✓ ${t(lang, unit.dealType)}`);
  // Delivery: a unit with no delivery year never matches. Ready = delivered by this year.
  const year = unit.delivery?.year;
  if (year != null) {
    const nowYear = now.getFullYear();
    if (f.deliveryReady === true && year <= nowYear) out.push(t(lang, 'rReady'));
    else if (f.deliveryReady === false && year > nowYear) out.push(t(lang, 'rOffPlan'));
    if (f.deliveryByYear != null && year <= f.deliveryByYear) out.push(t(lang, 'rDeliveryBy').replace('{y}', digits(f.deliveryByYear, lang)));
  }
  return out;
}
