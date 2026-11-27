import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StarterCard, starterDismissKey, starterSteps, useStarterDismissed } from '../src/components/StarterCard';
import { useAuth } from '../src/auth';
import { useToastStore } from '../src/components/Toast';

const props = () => ({ onAddUnit: jest.fn(), onShareSample: jest.fn(), onConnectTelegram: jest.fn(), onAsk: jest.fn(), onDismiss: jest.fn() });
const asRole = (role: string, lang: 'ar' | 'en' = 'en') => useAuth.setState({ broker: { id: 'b1', name: 'N', role, lang } as never });

afterEach(() => { jest.useRealTimers(); });

test('renders the owner steps, reflects completion state, and triggers callbacks', async () => {
  asRole('owner');
  const p = props();
  await render(<StarterCard onboarding={{ hasUnit: false, hasSharedLink: false, telegramConnected: true }} {...p} />);
  expect(screen.getByTestId('starter-step-3')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('starter-step-1'));
  expect(p.onAddUnit).toHaveBeenCalledTimes(1);
  // No units yet: "share" sends the owner to add one first.
  await fireEvent.press(screen.getByTestId('starter-step-2'));
  expect(p.onAddUnit).toHaveBeenCalledTimes(2);
  await fireEvent.press(screen.getByTestId('starter-dismiss'));
  expect(p.onDismiss).toHaveBeenCalledTimes(1);
});

test('share opens the units list once a unit exists', async () => {
  asRole('manager');
  const p = props();
  await render(<StarterCard onboarding={{ hasUnit: true, hasSharedLink: false, telegramConnected: false }} {...p} />);
  await fireEvent.press(screen.getByTestId('starter-step-2'));
  expect(p.onShareSample).toHaveBeenCalledTimes(1);
});

test('steps differ by role', () => {
  expect(starterSteps('owner')).toEqual(['add', 'share', 'telegram']);
  expect(starterSteps('broker')).toEqual(['telegram', 'ask', 'share']);
  expect(starterSteps('team_lead')).toEqual(['telegram', 'ask', 'share']);
  expect(starterSteps('data_entry')).toEqual(['add', 'photos']);
});

test('broker ask step is done from hasAsked', async () => {
  asRole('broker');
  await render(<StarterCard onboarding={{ hasUnit: false, hasSharedLink: false, telegramConnected: false, hasAsked: true }} {...props()} />);
  expect(screen.getByText('Ask your first question')).toBeTruthy();
  expect(screen.getAllByText('✓')).toHaveLength(1);
});

test('finishing the last step toasts, then hides the card', async () => {
  jest.useFakeTimers();
  asRole('manager');
  const p = props();
  const { rerender } = await render(<StarterCard onboarding={{ hasUnit: true, hasSharedLink: true, telegramConnected: false }} {...p} />);
  await rerender(<StarterCard onboarding={{ hasUnit: true, hasSharedLink: true, telegramConnected: true }} {...p} />);
  expect(useToastStore.getState().text).toBe('All set! You finished every step.');
  expect(screen.getByTestId('starter-card')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(screen.queryByTestId('starter-card')).toBeNull();
});

test('dismiss is remembered per broker', async () => {
  const a = await renderHook(() => useStarterDismissed('b1'));
  await waitFor(() => expect(a.result.current[0]).toBe(false));
  await act(async () => { a.result.current[1](); });
  expect(await AsyncStorage.getItem(starterDismissKey('b1'))).toBe('1');
  expect(starterDismissKey('b1')).toBe('wehdathub.starterDismissed:b1');
  const b = await renderHook(() => useStarterDismissed('b2'));
  await waitFor(() => expect(b.result.current[0]).toBe(false));
  const again = await renderHook(() => useStarterDismissed('b1'));
  await waitFor(() => expect(again.result.current[0]).toBe(true));
});
