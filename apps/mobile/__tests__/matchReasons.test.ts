import type { ApiUnit } from '@wehdathub/shared';
import { matchReasons } from '../src/matchReasons';

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
