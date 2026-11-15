import type { BoxPlace, ProjectCard, ProjectRead } from '@wehdathub/shared';
import { applyRead, areaPatch, factPills, fieldsOfProject, newSubareaPatch, numberOf, pageWindow, placeContext, placeOf, projectBlockers, projectBody } from '../src/projectRules';
import { chipText } from '../src/components/AskResults';

// What the server's reader answers for the three real launch messages (tests/fixtures/project-pastes.js there), as the app receives it.
const read = (over: Partial<ProjectRead> & { fields: ProjectRead['fields'] }): ProjectRead => ({ name: null, name_en: null, name_candidates: [], developer: null, place: null, features: [], existing: null, offers: [], facts: [], found: [], ...over });
const ARABISK = read({
  name: 'THE NEW BALANCE', developer: { name: 'ARABISK DEVELOPMENT', new: true },
  place: { kind: 'area', id: 'a-obour', name_en: 'New Obour City', name_ar: 'العبور الجديدة', path: 'Qalyubia', via: 'name', area_id: 'a-obour', subzone_id: null, label: 'New Obour City', zones: [] },
  fields: { area_acres: 15, status: 'launching', price_from: 2000000, bedrooms: [2, 3, 4], property_types: ['apartment'] }, found: ['name', 'developer', 'place', 'area_acres', 'status', 'price_from', 'bedrooms', 'property_types'],
});
const PMC = read({ name: 'PMC Mall', fields: { delivery_raw: 'استلام سنه واحدة فقط', price_from: 5875000, down_pct_min: 5, years_max: 7, property_types: ['office'] } });
const JAZEEL = read({ name: 'JAZEEL RESIDENCE', fields: { price_from: 2862554, down_pct_min: 5, years_max: 9, discount_pct: 15 }, existing: { id: 'p9', name: 'Jazeel Residence' } });

const sub: BoxPlace = { kind: 'subzone', id: 's1', name_en: 'Mostakbal', name_ar: 'المستقبل', path: 'Cairo › New Cairo', via: 'name', area_id: 'a-cairo', subzone_id: 's1', label: 'Mostakbal', zones: [] };

test('a launch message fills the empty fields, the area, the developer and the choices', () => {
  const f = applyRead({ status: 'selling' }, ARABISK);
  expect(f).toMatchObject({ name: 'THE NEW BALANCE', developer_name: 'ARABISK DEVELOPMENT', developer_label: 'ARABISK DEVELOPMENT', area_id: 'a-obour', place_label: 'New Obour City', area_acres: '15', price_from: '2000000', status: 'launching', bedrooms: ['2', '3', '4'], property_types: ['apartment'] });
  expect(f.developer_id).toBe('');
});

test('reading never overwrites what the broker typed or picked', () => {
  const f = applyRead({ name: 'My name', price_from: '1,000', area_id: 'x', place_label: 'Mine', developer_label: 'Mine dev', bedrooms: ['1'] }, ARABISK);
  expect(f.name).toBeUndefined();
  expect(f.price_from).toBeUndefined();
  expect(f.area_id).toBeUndefined();
  expect(f.developer_label).toBeUndefined();
  expect(f.bedrooms).toEqual(['1', '2', '3', '4']);
});

test('the other fixtures: numbers, delivery as written and the discount', () => {
  expect(applyRead({}, PMC)).toMatchObject({ name: 'PMC Mall', price_from: '5875000', down_pct_min: '5', years_max: '7', delivery_raw: 'استلام سنه واحدة فقط', property_types: ['office'] });
  expect(applyRead({}, JAZEEL)).toMatchObject({ discount_pct: '15', years_max: '9' });
});

test('a compound is never filed as the project place', () => {
  const compound = { ...sub, kind: 'compound' as const };
  expect(applyRead({}, read({ place: compound, fields: {} })).area_id).toBeUndefined();
});

test('required: the project name and the area; every other field is optional', () => {
  expect(projectBlockers({}, 'en').map((b) => b.field)).toEqual(['name', 'place']);
  expect(projectBlockers({ name: 'X', area_id: 'a' }, 'en')).toEqual([]);
  expect(projectBlockers({ name: 'X' }, 'en').map((b) => b.field)).toEqual(['place']);
  // A saved project always has a place: an edit that leaves it alone is complete.
  expect(projectBlockers({ name: 'X', place_label: 'New Cairo' }, 'en', true)).toEqual([]);
});

test('a place shows its parents and the governorate', () => {
  expect(placeContext(sub)).toEqual({ parents: 'Cairo › New Cairo', governorate: 'Cairo' });
  expect(areaPatch(sub)).toMatchObject({ compound: '', area_id: 'a-cairo', subzone_id: 's1', place_label: 'Mostakbal', place_path: 'Cairo › New Cairo', place_governorate: 'Cairo' });
  const top: BoxPlace = { ...sub, kind: 'area', path: '', id: 'a-cairo', subzone_id: null };
  expect(placeContext(top)).toEqual({ parents: '', governorate: 'Mostakbal' });
});

test('a new sub-area is requested with its name, Arabic name and parent', () => {
  const p = newSubareaPatch('Elite', 'إيليت', sub);
  expect(p).toMatchObject({ compound: 'Elite', compound_new: '1', compound_ar: 'إيليت', area_id: 'a-cairo', subzone_id: 's1', place_label: 'Elite' });
  expect(p.place_path).toBe('Cairo › New Cairo › Mostakbal');
});

test('the body has the website fields, no screen-only keys, and a new project always posts paste_text', () => {
  const body = projectBody({ name: 'X', price_from: '2,000,000', bedrooms: ['2'], feature: [], area_id: 'a', place_label: 'New Obour', place_governorate: 'Q', developer_label: 'D', developer_name: 'D', notes: '  ' }, '', true);
  expect(body).toEqual({ name: 'X', price_from: '2,000,000', bedrooms: ['2'], area_id: 'a', developer_name: 'D', paste_text: '' });
  expect(projectBody({ name: 'X' }, '  hello  ')).toEqual({ name: 'X', paste_text: 'hello' });
  expect(projectBody({ name: 'X' }, '')).toEqual({ name: 'X' });
});

test('a saved project becomes form values', () => {
  const f = fieldsOfProject({ name: 'Mivida', status: 'selling', price_from: 3000000, bedroom_options: [2, 3], feature_keys: ['roof'], features_other: ['x', 'y'], district: 'New Cairo', city: 'Cairo', lat: 30.1, lng: 31.2, area_id: 'a1' }, { id: 'd1', name: 'Emaar' });
  expect(f).toMatchObject({ name: 'Mivida', price_from: '3000000', bedrooms: ['2', '3'], feature: ['roof'], features_other: 'x، y', place_label: 'New Cairo', pin: '30.1, 31.2', developer_id: 'd1', developer_label: 'Emaar', area_id: 'a1' });
});

test('page numbers: first, last and the current page ±2, with gaps', () => {
  expect(pageWindow(1, 1)).toEqual([]);
  expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
  expect(pageWindow(1, 20)).toEqual([1, 2, 3, null, 20]);
  expect(pageWindow(10, 20)).toEqual([1, null, 8, 9, 10, 11, 12, null, 20]);
  expect(pageWindow(20, 20)).toEqual([1, null, 18, 19, 20]);
});

test('card facts come from the raw columns, or from the readable facts when the server sends them', () => {
  const raw: ProjectCard = { name: 'A', price_from: 2000000, bedroom_options: [2, 4], area_acres: 15, down_pct_min: 5, years_max: 8 };
  expect(factPills(raw, 'en')).toEqual(['From 2M EGP', '2–4 bed', '15 feddan', 'Down 5%', '8 yrs']);
  expect(factPills({ name: 'A', facts: [{ label: 'Down', value: '5%' }] }, 'en')).toEqual(['Down 5%']);
  expect(placeOf({ name: 'A', place: 'New Obour', governorate: 'Qalyubia' })).toBe('New Obour · Qalyubia');
  expect(placeOf({ name: 'A', district: 'New Cairo', city: 'Cairo' })).toBe('New Cairo · Cairo');
});

test('typed filter numbers: Arabic digits and commas', () => {
  expect(numberOf('5,000,000')).toBe(5000000);
  expect(numberOf('٣٠٠')).toBe(300);
  expect(numberOf('')).toBeUndefined();
  expect(numberOf('abc')).toBeUndefined();
});

test('a chip can hold a value or the numbers of a filter', () => {
  expect(chipText('Obour')).toBe('Obour');
  expect(chipText({ price_min: 1000000, price_max: 3000000 })).toBe('1000000 · 3000000');
  expect(chipText({ locations: ['Obour', 'Cairo'] })).toBe('Obour · Cairo');
});
