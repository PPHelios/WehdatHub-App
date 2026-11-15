import React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react-native';
import { Button } from '../src/components/Button';

test('shows a spinner while loading and ignores taps', async () => {
  const onPress = jest.fn();
  await render(<Button label="Go" onPress={onPress} loading />);
  expect(screen.getByTestId('button-spinner')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button'));
  expect(onPress).not.toHaveBeenCalled();
});

test('a second tap while the action runs is ignored', async () => {
  let release!: () => void;
  const onPress = jest.fn().mockImplementationOnce(() => new Promise<void>((r) => { release = r; }));
  await render(<Button label="Go" onPress={onPress} />);
  const button = screen.getByRole('button');
  const first = fireEvent.press(button); // settles when the action ends
  await fireEvent.press(button); // ignored
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('button-spinner')).toBeTruthy(); // the spinner shows by itself while the action runs
  await act(async () => release());
  await first;
  expect(screen.queryByTestId('button-spinner')).toBeNull();
  await fireEvent.press(button);
  expect(onPress).toHaveBeenCalledTimes(2);
});

