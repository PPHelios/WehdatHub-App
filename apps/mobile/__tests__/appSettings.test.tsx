import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppSettings } from '../src/components/AppSettings';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { appSettings: jest.fn(), saveAppSettings: jest.fn() } }));
const m = api as unknown as { appSettings: jest.Mock; saveAppSettings: jest.Mock };
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AppSettings /></QueryClientProvider>);

test('owner sees the agency switches and saves them', async () => {
  m.appSettings.mockResolvedValue({ draftStyle: 'short', quietLine: true, switches: { brokersMayWrite: true, dataEntryOwners: false } });
  m.saveAppSettings.mockResolvedValue({ ok: true });
  wrap();
  await waitFor(() => expect(screen.getByTestId('sw-write')).toBeTruthy());
  await fireEvent(screen.getByTestId('sw-owners'), 'valueChange', true);
  await fireEvent.press(screen.getByTestId('save-app-settings'));
  await waitFor(() => expect(m.saveAppSettings).toHaveBeenCalledWith({ draftStyle: 'short', quietLine: true, switches: { brokersMayWrite: true, dataEntryOwners: true } }));
});

test('a broker has no agency switches', async () => {
  m.appSettings.mockResolvedValue({ draftStyle: '', quietLine: false, switches: null });
  wrap();
  await waitFor(() => expect(screen.getByTestId('quietline-switch')).toBeTruthy());
  expect(screen.queryByTestId('sw-write')).toBeNull();
});
