import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationsScreen } from '../src/screens/NotificationsScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { notificationSettings: jest.fn(), saveNotificationSettings: jest.fn() } }));
const m = api as unknown as { notificationSettings: jest.Mock; saveNotificationSettings: jest.Mock };

const data = {
  kinds: {
    follow_up: { label: { ar: 'المتابعات', en: 'Follow-ups' }, on: true, channel: 'web', frequency: 'immediate', locked: null, urgent: false },
    hot_client: { label: { ar: 'عميل ساخن', en: 'Hot client' }, on: true, channel: 'web', frequency: 'immediate', locked: 'manager', urgent: false },
  },
  reminderMinutes: [60],
  quiet: { enabled: true, start: 22, end: 8 },
  telegramLinked: false,
};
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><NotificationsScreen /></QueryClientProvider>);

beforeEach(() => jest.clearAllMocks());

test('channel and frequency pickers are disabled while the alert is off, and a locked alert cannot be changed', async () => {
  m.notificationSettings.mockResolvedValue(data);
  wrap();
  await waitFor(() => expect(screen.getByTestId('kind-follow_up')).toBeTruthy());
  const firstChip = () => screen.getAllByRole('button', { name: /الموقع/ })[0];
  expect(firstChip().props.accessibilityState.disabled).toBe(false);
  await fireEvent(screen.getByTestId('on-follow_up'), 'valueChange', false);
  expect(firstChip().props.accessibilityState.disabled).toBe(true);
  expect(screen.getByTestId('on-hot_client').props.disabled).toBe(true);
});

test('saving sends only the alerts the person may change and shows the saved note', async () => {
  m.notificationSettings.mockResolvedValue(data);
  m.saveNotificationSettings.mockResolvedValue(data);
  wrap();
  await waitFor(() => expect(screen.getByTestId('kind-follow_up')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('reminder-30'));
  await fireEvent.press(screen.getByTestId('save-notifications'));
  await waitFor(() => expect(m.saveNotificationSettings).toHaveBeenCalled());
  const body = m.saveNotificationSettings.mock.calls[0][0];
  expect(Object.keys(body.kinds)).toEqual(['follow_up']);
  expect(body.reminderMinutes).toEqual([30, 60]);
});

test('WhatsApp is not offered, and an old WhatsApp choice is saved as the default', async () => {
  const old = { ...data, kinds: { follow_up: { ...data.kinds.follow_up, channel: 'whatsapp' } } };
  m.notificationSettings.mockResolvedValue(old);
  m.saveNotificationSettings.mockResolvedValue(data);
  wrap();
  await waitFor(() => expect(screen.getByTestId('kind-follow_up')).toBeTruthy());
  expect(screen.queryByText(/واتساب|WhatsApp/i)).toBeNull();
  await fireEvent.press(screen.getByTestId('save-notifications'));
  await waitFor(() => expect(m.saveNotificationSettings).toHaveBeenCalled());
  expect(m.saveNotificationSettings.mock.calls[0][0].kinds.follow_up.channel).toBe('web');
});
