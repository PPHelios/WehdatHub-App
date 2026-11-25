import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { COLORS } from '@wehdathub/shared';
import type { ApiUnitListItem } from '@wehdathub/shared';
import { UnitCard, UNIT_PHOTO_HEIGHT } from '../src/components/UnitCard';
import { Pill } from '../src/components/Pill';
import { usePrefs } from '../src/prefs';
import { GREEN_PALETTE, radius } from '../src/theme';

const unit = (over: Partial<ApiUnitListItem> = {}): ApiUnitListItem =>
  ({ id: 'u1', code: 'HP-301', status: 'active', title: null, propertyType: 'apartment', dealType: 'sale', price: 9_500_000, priceText: null, area: 180, bedrooms: 3, bathrooms: 2, compound: 'Hyde Park', district: 'New Cairo', city: 'Cairo', finishing: 'Fully finished', photo: null, ...over }) as ApiUnitListItem;

afterEach(() => usePrefs.setState({ appearance: 'system' }));

test('a unit card uses app card tokens, place, facts, finishing and deal pills', async () => {
  await render(<UnitCard unit={unit()} lang="en" onPress={() => undefined} />);
  expect(screen.getByTestId('place-HP-301').props.children).toBe('New Cairo · Cairo');
  expect(screen.getByTestId('finishing-HP-301')).toBeTruthy();
  expect(screen.getByTestId('deal-HP-301')).toBeTruthy();
  const cardStyle = StyleSheet.flatten(screen.getByTestId('unit-card-HP-301').props.style);
  expect(cardStyle.borderRadius).toBe(radius.card);
});

test('a unit card uses unified Pill styling across Arabic and dark mode with accessible price ink', async () => {
  usePrefs.setState({ appearance: 'dark' });
  await render(<UnitCard unit={unit({ propertyType: 'villa', dealType: 'rent', mine: true })} lang="ar" onPress={() => undefined} />);
  expect(screen.getByTestId('type-HP-301')).toHaveTextContent('فيلا');
  expect(screen.getByTestId('deal-HP-301')).toHaveTextContent('إيجار');
  expect(screen.getByTestId('owner-HP-301')).toHaveTextContent('وحدتك');
  expect(screen.getByTestId('code-HP-301')).toHaveTextContent('HP-301');
  expect(screen.queryByTestId('badges-HP-301')).toBeNull();
  const priceStyle = StyleSheet.flatten(screen.getByTestId('price-HP-301').props.style);
  expect(priceStyle.color).toBe(GREEN_PALETTE.primaryInkDark);
});

test('a unit card shows the property type in English, also for types off the add form', async () => {
  await render(<UnitCard unit={unit({ propertyType: 'twin_villa' })} lang="en" onPress={() => undefined} />);
  expect(screen.getByTestId('type-HP-301')).toHaveTextContent('Twin house');
});

test('a unit card with no property type leaves the chip out', async () => {
  await render(<UnitCard unit={unit({ propertyType: null })} lang="en" onPress={() => undefined} />);
  expect(screen.queryByTestId('type-HP-301')).toBeNull();
});

test('with no photo the card keeps the photo area, so a list has even rows', async () => {
  await render(<UnitCard unit={unit({ photo: null })} lang="en" onPress={() => undefined} />);
  const box = screen.getByTestId('no-photo-HP-301');
  expect(StyleSheet.flatten(box.props.style).height).toBe(UNIT_PHOTO_HEIGHT);
});

test('a card with no place or finishing leaves those out', async () => {
  await render(<UnitCard unit={unit({ district: null, city: null, finishing: null })} lang="en" onPress={() => undefined} />);
  expect(screen.queryByTestId('place-HP-301')).toBeNull();
  expect(screen.queryByTestId('finishing-HP-301')).toBeNull();
});

test('a solid green pill uses white text in dark mode', async () => {
  usePrefs.setState({ appearance: 'dark' });
  await render(<Pill solid tone="primary" label="Sale" />);
  const text = StyleSheet.flatten(screen.getByText('Sale').props.style);
  expect(text.color).toBe('#FFFFFF');
});

test('a solid accent pill uses the accent text colour in both modes', async () => {
  usePrefs.setState({ appearance: 'light' });
  const { unmount } = await render(<Pill solid tone="accent" label="Rent" />);
  expect(StyleSheet.flatten(screen.getByText('Rent').props.style).color).toBe(COLORS.light['on-accent']);
  unmount();
  usePrefs.setState({ appearance: 'dark' });
  await render(<Pill solid tone="accent" label="Rent" />);
  expect(StyleSheet.flatten(screen.getByText('Rent').props.style).color).toBe(COLORS.dark['on-accent']);
});
