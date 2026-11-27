import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Skeleton } from '../src/components/Skeleton';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

test('Card renders children and fires onPress', async () => {
  const onPress = jest.fn();
  await render(<Card testID="c" onPress={onPress}><Text>hi</Text></Card>);
  expect(screen.getByText('hi')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('c'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('ScreenHeader shows title and back fires', async () => {
  const onBack = jest.fn();
  await render(<ScreenHeader title="Units" onBack={onBack} />);
  expect(screen.getByText('Units')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('header-back'));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('Skeleton uses the given size', async () => {
  await render(<Skeleton width={40} height={12} />);
  expect(screen.getByTestId('skeleton', { includeHiddenElements: true })).toHaveStyle({ width: 40, height: 12 });
});

test('Button presses, and is disabled while loading', async () => {
  const onPress = jest.fn();
  const { rerender } = await render(<Button label="Go" onPress={onPress} testID="b" />);
  await fireEvent.press(screen.getByTestId('b'));
  expect(onPress).toHaveBeenCalledTimes(1);
  await rerender(<Button label="Go" onPress={onPress} testID="b" loading />);
  expect(screen.getByRole('button')).toBeDisabled();
});
