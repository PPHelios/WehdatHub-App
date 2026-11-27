import type { ApiUnit } from '@wehdathub/shared';
import { filtersFromUnderstood, matchReasons } from '../src/matchReasons';

const u = (over: Partial<ApiUnit> = {}): ApiUnit => ({ code: 'A1', price: 4_650_000, currency: 'EGP', bedrooms: 3, district: 'التجمع', compound: null, city: 'Cairo', propertyType: 'apartment', finishing: null, dealType: 'sale', ...over }) as ApiUnit;

test('budget, beds and area match in English and Arabic', () => {
  const f = { maxPrice: 5_000_000, bedrooms: 3, areaQuery: 'التجمع' };
  expect(matchReasons(u(), f, 'en')).toEqual(['✓ In budget', '✓ 3 beds', '✓ التجمع']);
  expect(matchReasons(u(), f, 'ar')).toEqual(['✓ في الميزانية', '✓ ٣ غرف', '✓ التجمع']);
});

test('only true matches are returned', () => {
  expect(matchReasons(u({ price: 9_000_000, bedrooms: 2, district: 'Zayed' }), { maxPrice: 5_000_000, bedrooms: 3, areaQuery: 'التجمع' }, 'en')).toEqual([]);
});

test('null unit fields and missing filters never match', () => {
  expect(matchReasons(u({ price: null, bedrooms: null, district: null, city: null, propertyType: null }), { maxPrice: 5e6, bedrooms: 3, areaQuery: 'x', propertyType: 'apartment' }, 'en')).toEqual([]);
  expect(matchReasons(u(), undefined, 'en')).toEqual([]);
  expect(matchReasons(u(), {}, 'en')).toEqual([]);
});

test('a USD unit is not compared with an EGP budget; type and deal match', () => {
  expect(matchReasons(u({ currency: 'USD' }), { maxPrice: 5e6 }, 'en')).toEqual([]);
  expect(matchReasons(u(), { propertyType: 'apartment', dealType: 'sale' }, 'en')).toEqual(['✓ Apartment', '✓ Sale']);
});

test('a broad field inside a narrower query is not a hit; the exact narrower field is', () => {
  expect(matchReasons(u({ district: null, city: 'Cairo' }), { areaQuery: 'New Cairo' }, 'en')).toEqual([]);
  expect(matchReasons(u({ district: 'New Cairo', city: 'Cairo' }), { areaQuery: 'New Cairo' }, 'en')).toEqual(['✓ New Cairo']);
  expect(matchReasons(u({ district: 'New Cairo' }), { areaQuery: 'cairo' }, 'en')).toEqual(['✓ New Cairo']);
});

const NOW = new Date('2026-06-01');
const sf = (over: Record<string, unknown> = {}) => ({ bedroomsMin: null, bedroomsMax: null, ...over });

test('bedroom range chip, with Arabic digits; null or out of range gives none', () => {
  expect(matchReasons(u({ bedrooms: 3 }), sf({ bedroomsMin: 2, bedroomsMax: 4 }), 'en')).toEqual(['✓ 3 beds']);
  expect(matchReasons(u({ bedrooms: 4 }), sf({ bedroomsMin: 3 }), 'ar')).toEqual(['✓ ٤ غرف']);
  expect(matchReasons(u({ bedrooms: 2 }), sf({ bedroomsMin: 3 }), 'en')).toEqual([]);
  expect(matchReasons(u({ bedrooms: null }), sf({ bedroomsMin: 3 }), 'en')).toEqual([]);
});

test('type and finishing lists match by key, labelled per language; a missing unit field gives no chip', () => {
  const f = { propertyTypes: ['villa', 'apartment'], finishings: ['fully_finished'] };
  expect(matchReasons(u({ finishing: 'fully_finished' }), f, 'en')).toEqual(['✓ Apartment', '✓ Fully finished']);
  expect(matchReasons(u({ finishing: 'fully_finished' }), f, 'ar')).toEqual(['✓ شقة', '✓ تشطيب كامل']);
  expect(matchReasons(u({ propertyType: null, finishing: null }), f, 'en')).toEqual([]);
  expect(matchReasons(u({ propertyType: 'villa', finishing: 'semi_finished' }), { propertyTypes: ['apartment'], finishings: ['fully_finished'] }, 'en')).toEqual([]);
});

test('ready, off plan and delivery-by chips need a delivery year on the unit', () => {
  const d = (year: number) => ({ delivery: { year, quarter: null } }) as Partial<ApiUnit>;
  expect(matchReasons(u(d(2025)), { deliveryReady: true }, 'en', NOW)).toEqual(['✓ Ready to move']);
  expect(matchReasons(u(d(2025)), { deliveryReady: true }, 'ar', NOW)).toEqual(['✓ جاهز للاستلام']);
  expect(matchReasons(u(d(2028)), { deliveryReady: true }, 'en', NOW)).toEqual([]);
  expect(matchReasons(u(d(2028)), { deliveryReady: false }, 'en', NOW)).toEqual(['✓ Off plan']);
  expect(matchReasons(u(d(2027)), { deliveryByYear: 2028 }, 'en', NOW)).toEqual(['✓ Delivery by 2028']);
  expect(matchReasons(u(d(2027)), { deliveryByYear: 2028 }, 'ar', NOW)).toEqual(['✓ تسليم قبل ٢٠٢٨']);
  expect(matchReasons(u({ delivery: null }), { deliveryReady: true, deliveryByYear: 2030 }, 'en', NOW)).toEqual([]);
});

test('filtersFromUnderstood maps the server filters and tolerates an older server', () => {
  expect(filtersFromUnderstood(undefined)).toEqual({});
  expect(filtersFromUnderstood({ appliedFilters: [], filters: { bedrooms: { min: 3, max: null }, propertyTypes: ['villa'], finishing: [], places: [], price: { min: null, max: 9e6 }, delivery: { ready: true, byYear: null } } })).toMatchObject({ bedroomsMin: 3, propertyTypes: ['villa'], maxPrice: 9e6, deliveryReady: true });
});
