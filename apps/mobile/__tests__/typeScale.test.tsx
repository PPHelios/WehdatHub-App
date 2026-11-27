import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { AppText } from '../src/components/AppText';

test('AppText variant applies the type-scale size and line height', async () => {
  await render(<AppText testID="t" variant="title">x</AppText>);
  const flat = StyleSheet.flatten(screen.getByTestId('t').props.style);
  expect(flat.fontSize).toBe(22);
  expect(flat.lineHeight).toBe(30);
});
