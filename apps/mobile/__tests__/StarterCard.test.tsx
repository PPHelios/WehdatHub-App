import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StarterCard } from '../src/components/StarterCard';

test('renders 3 steps, reflects completion state, and triggers callbacks', async () => {
  const onAddUnit = jest.fn();
  const onShareSample = jest.fn();
  const onConnectTelegram = jest.fn();
  const onDismiss = jest.fn();

  const { rerender } = await render(
    <StarterCard
      onboarding={{ hasUnit: false, hasSharedLink: false, telegramConnected: true }}
      onAddUnit={onAddUnit}
      onShareSample={onShareSample}
      onConnectTelegram={onConnectTelegram}
      onDismiss={onDismiss}
    />
  );

  expect(screen.getByTestId('starter-card')).toBeTruthy();
  expect(screen.getByTestId('starter-step-1')).toBeTruthy();
  expect(screen.getByTestId('starter-step-2')).toBeTruthy();
  expect(screen.getByTestId('starter-step-3')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('starter-step-1'));
  expect(onAddUnit).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByTestId('starter-step-2'));
  expect(onShareSample).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByTestId('starter-dismiss'));
  expect(onDismiss).toHaveBeenCalledTimes(1);

  await rerender(
    <StarterCard
      onboarding={{ hasUnit: true, hasSharedLink: true, telegramConnected: true }}
      onAddUnit={onAddUnit}
      onShareSample={onShareSample}
      onConnectTelegram={onConnectTelegram}
      onDismiss={onDismiss}
    />
  );
  expect(screen.queryByTestId('starter-card')).toBeNull();
});
