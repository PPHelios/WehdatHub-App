import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AppText } from '../src/components/AppText';

test('AppText uses the Cairo font and caps the text size at 1.5x', async () => {
  await render(<AppText testID="t" style={{ fontWeight: '700' }}>hi</AppText>);
  const el = screen.getByTestId('t');
  expect(el.props.maxFontSizeMultiplier).toBe(1.5);
  expect(JSON.stringify(el.props.style)).toContain('Cairo-Bold');
});
