import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ApiUnitListItem } from '@wehdathub/shared';
import { UnitHeroCard } from '../src/components/UnitHeroCard';

const unit = { id: 'u1', code: 'HP-301', status: 'active', propertyType: 'apartment', dealType: 'sale', price: 9_000_000, priceText: null, currency: 'EGP', area: 180, bedrooms: 3, bathrooms: 2, compound: 'Hyde Park', district: 'New Cairo', city: 'Cairo', finishing: null, photo: null, updatedAt: new Date().toISOString() } as unknown as ApiUnitListItem;

test('hero card shows price, per m2, reasons, update and actions; share and save fire', async () => {
  const onShare = jest.fn();
  const onSave = jest.fn();
  await render(<UnitHeroCard unit={unit} lang="en" onPress={() => undefined} onShare={onShare} onSave={onSave} reasons={['✓ In budget']} photoCount={7} />);
  expect(screen.getByText('EGP')).toBeTruthy();
  expect(screen.getByTestId('per-sqm-HP-301')).toHaveTextContent('50,000 / m²');
  expect(screen.getByText('✓ In budget')).toBeTruthy();
  expect(screen.getByText('Today')).toBeTruthy();
  expect(screen.getByTestId('photo-count-HP-301')).toBeTruthy();
  await fireEvent.press(screen.getByText('Send to client'));
  expect(onShare).toHaveBeenCalledWith('HP-301');
  await fireEvent.press(screen.getByTestId('save-HP-301'));
  expect(onSave).toHaveBeenCalledWith('HP-301');
});

test('hero card leaves out per m2 and actions when data or handlers are missing', async () => {
  await render(<UnitHeroCard unit={{ ...unit, area: null }} lang="en" onPress={() => undefined} />);
  expect(screen.queryByTestId('per-sqm-HP-301')).toBeNull();
  expect(screen.queryByText('Send to client')).toBeNull();
});

test('hero card shows per m2 only for EGP sale units', async () => {
  const { rerender } = await render(<UnitHeroCard unit={{ ...unit, currency: 'USD' } as ApiUnitListItem} lang="en" onPress={() => undefined} />);
  expect(screen.queryByTestId('per-sqm-HP-301')).toBeNull();
  await rerender(<UnitHeroCard unit={{ ...unit, dealType: 'rent' } as ApiUnitListItem} lang="en" onPress={() => undefined} />);
  expect(screen.queryByTestId('per-sqm-HP-301')).toBeNull();
});
