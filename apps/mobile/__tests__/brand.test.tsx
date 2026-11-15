import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { featureChip } from '../src/featureLabels';
import { withBrandFont } from '../src/fonts';
import { stageLabel } from '../src/i18n';
import { Icon } from '../src/components/Icon';
import { Logo } from '../src/components/Logo';
import { labelOf, FURNISHING } from '../src/unitOptions';

test('bold weights get Cairo Bold, others Cairo Regular, and an own font is kept', () => {
  expect(StyleSheet.flatten(withBrandFont({ fontWeight: '700' }))).toMatchObject({ fontFamily: 'Cairo-Bold' });
  expect(StyleSheet.flatten(withBrandFont({ fontSize: 14 }))).toMatchObject({ fontFamily: 'Cairo-Regular' });
  expect(StyleSheet.flatten(withBrandFont({ fontFamily: 'Menlo' }))?.fontFamily).toBe('Menlo');
});

test('lead stages carry an icon and the website wording', () => {
  expect(stageLabel('ar', 'contacted')).toBe('📞 اتكلمنا');
  expect(stageLabel('en', 'won')).toBe('✅ Won');
});

test('features are readable chips, not codes', () => {
  expect(featureChip('nanny_room', 'ar')).toMatchObject({ label: 'غرفة مربية', icon: '🛏' });
  expect(featureChip('furnished', 'en').label).toBe('Furnished');
  expect(featureChip('some_new_thing', 'en').label).toBe('some new thing');
  expect(labelOf(FURNISHING, 'furnished', 'ar')).toBe('مفروشة');
});

test('the icons and the logo draw', async () => {
  await render(<><Icon name="search" color="#000" /><Logo /></>);
  expect(screen.getByTestId('icon-search')).toBeTruthy();
  expect(screen.getByTestId('logo-mark')).toBeTruthy();
});
