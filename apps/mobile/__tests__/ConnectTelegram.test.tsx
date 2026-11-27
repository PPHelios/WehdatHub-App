import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../src/api';
import { ConnectTelegramScreen } from '../src/screens/ConnectTelegramScreen';

jest.mock('../src/api', () => ({ api: { me: jest.fn(), telegramLink: jest.fn() } }));

const wrap = (ui: React.ReactElement) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>;

test('Open Telegram fetches the start link and opens it', async () => {
  (api.me as jest.Mock).mockResolvedValue({ onboarding: { telegramConnected: false } });
  (api.telegramLink as jest.Mock).mockResolvedValue({ url: 'https://t.me/bot?start=abc' });
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(wrap(<ConnectTelegramScreen />));
  await fireEvent.press(await screen.findByTestId('tg-open'));
  await waitFor(() => expect(open).toHaveBeenCalledWith('https://t.me/bot?start=abc'));
});

test('shows the connected tick when /me says Telegram is linked', async () => {
  (api.me as jest.Mock).mockResolvedValue({ onboarding: { telegramConnected: true } });
  await render(wrap(<ConnectTelegramScreen />));
  expect(await screen.findByTestId('tg-connected')).toBeTruthy();
  expect(screen.queryByTestId('tg-open')).toBeNull();
});
