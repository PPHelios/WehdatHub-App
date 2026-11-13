import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppSettings } from '../src/components/AppSettings';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { appSettings: jest.fn(), saveAppSettings: jest.fn(), uploadLogo: jest.fn(), removeLogo: jest.fn() } }));
jest.mock('../src/photos', () => ({ pickPhotos: jest.fn(async () => [{ uri: 'file:///l.png', name: 'l.png', type: 'image/png' }]) }));
jest.mock('../src/rights', () => ({ useRights: () => ({ manager: true, agencyOwner: false }) }));
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

test('a manager can choose and upload a logo', async () => {
  m.appSettings.mockResolvedValue({ draftStyle: '', quietLine: true, switches: null });
  (api as unknown as { uploadLogo: jest.Mock }).uploadLogo.mockResolvedValue({ ok: true, url: 'u' });
  await wrap();
  await fireEvent.press(await screen.findByTestId('logo-pick'));
  await waitFor(() => expect((api as unknown as { uploadLogo: jest.Mock }).uploadLogo).toHaveBeenCalledWith({ uri: 'file:///l.png', name: 'l.png', type: 'image/png' }));
});
