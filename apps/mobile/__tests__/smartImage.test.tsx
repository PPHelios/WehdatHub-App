import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SmartImage } from '../src/components/SmartImage';

test('a photo shows a spinner, retries twice by itself, then offers a tap to retry', async () => {
  await render(<SmartImage uri="https://x.test/a.jpg" style={{ width: 50, height: 50 }} testID="img" />);
  expect(screen.getByTestId('image-spinner')).toBeTruthy();
  const img = () => screen.getByTestId('smart-image');
  await fireEvent(img(), 'error');
  await fireEvent(img(), 'error');
  expect(screen.getByTestId('image-spinner')).toBeTruthy(); // still trying
  expect(img().props.source.uri).toContain('r=2');
  await fireEvent(img(), 'error');
  expect(screen.getByTestId('image-retry')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('image-retry'));
  expect(screen.getByTestId('image-spinner')).toBeTruthy();
});

test('a loaded photo drops the spinner', async () => {
  await render(<SmartImage uri="https://x.test/a.jpg" style={{ width: 50, height: 50 }} />);
  await fireEvent(screen.getByTestId('smart-image'), 'load');
  expect(screen.queryByTestId('image-spinner')).toBeNull();
});
