import { draftText, isAutoDraft } from '../src/unitDraft';

const labels = { type: 'Apartment', place: 'Golden Square', finishing: '', furnishing: '', features: [] as string[] };

test('the draft reads the unit from its fields, in English', () => {
  const text = draftText({ listing_type: 'sale', area_value: '150', bedrooms: '3', garden_area: '40' }, { ...labels, features: ['Private garden'] }, true);
  expect(text).toBe('Apartment for sale in Golden Square. 150 m², 3 bedrooms, garden 40 m². Private garden.');
});

test('the draft reads the unit in Arabic, with the right plural for the rooms', () => {
  const text = draftText({ listing_type: 'rent', bedrooms: '2', bathrooms: '1', floor_level: '0' }, { ...labels, type: 'شقة' }, false);
  expect(text).toBe('شقة للإيجار في Golden Square. 2 غرفتين نوم، 1 حمام، الدور الأرضي.');
});

test('a sale says ready to move, or the delivery year; a rental says neither', () => {
  expect(draftText({ listing_type: 'sale', is_ready: '1' }, labels, true)).toContain('ready to move');
  expect(draftText({ listing_type: 'sale', delivery_year: '2028' }, labels, true)).toContain('delivery 2028');
  expect(draftText({ listing_type: 'rent', delivery_year: '2028' }, labels, true)).not.toContain('delivery');
});

test('an empty form writes nothing', () => {
  expect(draftText({}, { ...labels, type: '', place: '' }, true)).toBe('');
});

test('the description is kept by hand once it has text', () => {
  expect(isAutoDraft('')).toBe(true);
  expect(isAutoDraft('   ')).toBe(true);
  expect(isAutoDraft('My own words')).toBe(false);
});
