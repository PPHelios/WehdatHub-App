import { FIELD_TYPES, offFields, sendable, sizeShows, stepOf, stepsFor, withImpliedFeatures } from '../src/unitRules';

test('a rental sends no delivery or payment fields, and a sale sends no rent period', () => {
  const rent = sendable({ listing_type: 'rent', rent_period: 'monthly', delivery_year: '2028', is_ready: '', down_payment_value: '100', price_value: '20000', area_value: '90' });
  expect(rent).toEqual({ listing_type: 'rent', rent_period: 'monthly', price_value: '20000', area_value: '90' });
  const sale = sendable({ listing_type: 'sale', rent_period: 'monthly', delivery_year: '2028', price_value: '9000000' });
  expect(sale).toEqual({ listing_type: 'sale', delivery_year: '2028', price_value: '9000000' });
  expect(offFields({ listing_type: 'sale' })).toEqual(['rent_period']);
});

test('the phone-only place fields are never sent', () => {
  const out = sendable({ listing_type: 'sale', compound: 'Mivida', place_label: 'Mivida', place_path: 'New Cairo', place_zones: 'Golden Square', area_path: 'x' });
  expect(out).toEqual({ listing_type: 'sale', compound: 'Mivida' });
});

test('a rental has two steps less: the delivery and payment step is skipped', () => {
  expect(stepsFor({ listing_type: 'sale' })).toEqual([1, 2, 3, 4]);
  expect(stepsFor({ listing_type: 'rent' })).toEqual([1, 2, 4]);
});

test('a blocker belongs to the step that asks for it; the owner and photos are on the last step', () => {
  expect(stepOf('property_type')).toBe(1);
  expect(stepOf('price_value')).toBe(2);
  expect(stepOf('installment_value')).toBe(3);
  expect(stepOf('owner_phone')).toBe(4);
  expect(stepOf('photos')).toBe(4);
});

test('land, garden and roof areas show for their unit types, and a field with a value always shows', () => {
  expect(sizeShows('land_area', 'apartment', {})).toBe(false);
  expect(sizeShows('land_area', 'villa', {})).toBe(true);
  expect(sizeShows('land_area', 'apartment', { land_area: '200' })).toBe(true);
  expect(sizeShows('roof_area', 'roof', {})).toBe(true);
  expect(sizeShows('floor_level', 'villa', {})).toBe(false);
  expect(FIELD_TYPES.roof_area).toContain('roof');
});

test('a garden or roof area adds its feature once', () => {
  expect(withImpliedFeatures({ garden_area: '40' })).toEqual({ garden_area: '40', feature: ['private_garden'] });
  expect(withImpliedFeatures({ roof_area: '30', feature: ['roof'] })).toEqual({ roof_area: '30', feature: ['roof'] });
  expect(withImpliedFeatures({ garden_area: '0' })).toEqual({ garden_area: '0' });
});
