import type { ApiUnit, Lang } from '@wehdathub/shared';
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
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const digits = (n: number, lang: Lang) => (lang === 'ar' ? String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]) : String(n));

/** Short "✓ ..." labels for each filter the unit really satisfies. A null unit field never matches. */
export function matchReasons(unit: ApiUnit, understood: MatchFilters | null | undefined, lang: Lang): string[] {
  const f = understood;
  if (!f) return [];
  const out: string[] = [];
  const hasBudget = f.maxPrice != null || f.minPrice != null;
  // Budgets are EGP; a USD/EUR unit is never compared against them.
  const egp = !unit.currency || unit.currency.toUpperCase() === 'EGP';
  if (hasBudget && egp && unit.price !== null && unit.price <= (f.maxPrice ?? Infinity) && unit.price >= (f.minPrice ?? 0)) out.push(t(lang, 'rBudget'));
  if (unit.bedrooms !== null && f.bedrooms != null && unit.bedrooms === f.bedrooms) out.push(t(lang, 'rBeds').replace('{n}', digits(unit.bedrooms, lang)));
  const q = norm(f.areaQuery);
  if (q) {
    const hit = [unit.district, unit.compound, unit.compoundEn, unit.city, unit.phase, unit.phaseEn].find((p) => p && (norm(p).includes(q) || q.includes(norm(p))));
    if (hit) out.push(`✓ ${hit}`);
  }
  if (unit.propertyType && f.propertyType && norm(unit.propertyType) === norm(f.propertyType)) out.push(`✓ ${labelOf(ALL_TYPES, unit.propertyType, lang) ?? unit.propertyType}`);
  if (unit.finishing && f.finishing && norm(unit.finishing) === norm(f.finishing)) out.push(`✓ ${labelOf(FINISHING, unit.finishing, lang) ?? unit.finishing}`);
  if ((unit.dealType === 'sale' || unit.dealType === 'rent') && f.dealType === unit.dealType) out.push(`✓ ${t(lang, unit.dealType)}`);
  return out;
}
