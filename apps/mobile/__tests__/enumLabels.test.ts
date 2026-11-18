// Every value the server stores for a unit's type, finishing, furnishing and status, and a viewing's status, has an Arabic
// and an English label in the app, so no screen shows a raw value such as "fully_finished".
// The lists below copy the server's (WehdatHub-Server domain/fieldRules.js PROPERTY_TYPES, domain/furnishingStatus.js,
// the listings_status_check constraint, services/viewings.js); update both together.
import { ALL_TYPES, FINISHING, FURNISHING, UNIT_STATUS, VIEWING_STATUS, labelOf } from '../src/unitOptions';

const SERVER = {
  types: ['apartment', 'duplex', 'penthouse', 'chalet', 'triplex', 'triplex_roof', 'sky_loft', 'basement', 'mazonette', 'roof', 'studio', 'villa', 'townhouse', 'i_villa', 'twin_villa', 'maisonette', 'office', 'shop', 'clinic', 'commercial', 'land'],
  finishing: ['core_and_shell', 'semi_finished', 'fully_finished', 'super_lux', 'ultra_super_lux'],
  furnishing: ['furnished', 'semi_furnished', 'unfurnished', 'kitchen_and_ac', 'ac_only', 'kitchen_only'],
  unitStatus: ['draft', 'active', 'sold', 'archived', 'deleted'],
  viewingStatus: ['proposed', 'confirmed', 'reschedule', 'cancelled'],
};

const cases: [string, typeof FINISHING, string[]][] = [
  ['types', ALL_TYPES, SERVER.types],
  ['finishing', FINISHING, SERVER.finishing],
  ['furnishing', FURNISHING, SERVER.furnishing],
  ['unit status', UNIT_STATUS, SERVER.unitStatus],
  ['viewing status', VIEWING_STATUS, SERVER.viewingStatus],
];

test.each(cases)('%s: every server value has a real label in both languages', (_name, list, values) => {
  for (const v of values) {
    expect(list.find((o) => o.value === v)).toBeTruthy();
    for (const lang of ['ar', 'en'] as const) {
      const label = labelOf(list, v, lang) ?? '';
      expect(label).not.toContain('_');
      expect(label).not.toBe(v);
    }
  }
});

test('fully_finished reads as words', () => {
  expect(labelOf(FINISHING, 'fully_finished', 'en')).toBe('Fully finished');
  expect(labelOf(FINISHING, 'fully_finished', 'ar')).toBe('تشطيب كامل');
});
