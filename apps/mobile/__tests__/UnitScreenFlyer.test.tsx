import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnitScreen } from '../src/screens/UnitScreen';
import { api } from '../src/api';
import Share from 'react-native-share';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }), useRoute: () => ({ params: undefined }) }));
jest.mock('../src/api', () => ({ api: { unit: jest.fn(), unitContact: jest.fn(), unitShareLink: jest.fn(), unitFlyer: jest.fn(), unitMessage: jest.fn() } }));
const mocked = api as unknown as { unit: jest.Mock; unitContact: jest.Mock; unitFlyer: jest.Mock; unitMessage: jest.Mock };

class FakeReader {
  result: string | null = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL() { this.result = 'data:image/png;base64,AA'; this.onloadend?.(); }
}
const asGlobal = globalThis as unknown as { FileReader: unknown; fetch: unknown };
const shareOpen = Share.open as jest.Mock;

const unit = { id: 'u1', code: 'A-1', status: 'active', compound: 'Mivida', price: 9000000, bedrooms: 3, bathrooms: 2, area: 150, district: null, city: null, finishing: null, furnishing: null, features: [], images: [] };
beforeEach(() => {
  jest.clearAllMocks();
  asGlobal.FileReader = FakeReader;
  asGlobal.fetch = jest.fn().mockResolvedValue({ blob: async () => ({}) });
});
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitScreen code="A-1" /></QueryClientProvider>);

test.each([['flyer', 'dark', false], ['flyer-light', 'light', false], ['flyer-nobrand', 'dark', true]])('%s makes a flyer, only it spins, then share shows', async (id, theme, nobrand) => {
  mocked.unit.mockResolvedValue(unit);
  mocked.unitContact.mockRejectedValue(new Error('hidden'));
  let done: (v: { url: string }) => void = () => undefined;
  mocked.unitFlyer.mockReturnValue(new Promise((r) => { done = r; }));
  await wrap();
  await waitFor(() => expect(screen.getByTestId(id)).toBeTruthy());
  const first = fireEvent.press(screen.getByTestId(id)); // settles when the flyer is made
  await waitFor(() => expect(screen.getAllByTestId('button-spinner')).toHaveLength(1));
  expect(mocked.unitFlyer).toHaveBeenCalledWith('A-1', theme, nobrand, expect.anything());
  for (const other of ['flyer', 'flyer-light', 'flyer-nobrand']) expect(screen.getByTestId(other).props.accessibilityState.disabled).toBe(true);
  await act(async () => { done({ url: 'https://x/f.png' }); });
  await first;
  await waitFor(() => expect(screen.getByTestId('flyer-share')).toBeTruthy());
});

test('Send the flyer opens the share sheet with the flyer picture (WhatsApp gets a file)', async () => {
  mocked.unit.mockResolvedValue(unit);
  mocked.unitContact.mockRejectedValue(new Error('hidden'));
  mocked.unitFlyer.mockResolvedValue({ url: 'https://x/f.png' });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('flyer')).toBeTruthy());
  await act(async () => { fireEvent.press(screen.getByTestId('flyer')); });
  await waitFor(() => expect(screen.getByTestId('flyer-share')).toBeTruthy());
  await act(async () => { fireEvent.press(screen.getByTestId('flyer-share')); });
  await waitFor(() => expect(shareOpen).toHaveBeenCalledTimes(1));
  expect(asGlobal.fetch).toHaveBeenCalledWith('https://x/f.png');
  const arg = shareOpen.mock.calls[0][0];
  expect(arg.urls).toEqual(['data:image/png;base64,AA']);
  expect(arg.type).toBe('image/png');
  expect(arg.useInternalStorage).toBe(true);
});

test('Share unit sends the unit pictures and the edited message through the share sheet', async () => {
  mocked.unit.mockResolvedValue({ ...unit, images: [{ id: 'i1', url: 'https://x/1.jpg' }, { id: 'i2', url: 'https://x/2.jpg' }] });
  mocked.unitContact.mockRejectedValue(new Error('hidden'));
  mocked.unitMessage.mockResolvedValue({ message: 'A-1 · 9,000,000 EGP' });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('share-unit')).toBeTruthy());
  await act(async () => { fireEvent.press(screen.getByTestId('share-unit')); });
  await waitFor(() => expect(screen.getByTestId('msg-text').props.value).toBe('A-1 · 9,000,000 EGP'));
  await act(async () => { fireEvent.press(screen.getByTestId('msg-send')); });
  await waitFor(() => expect(shareOpen).toHaveBeenCalledTimes(1));
  const arg = shareOpen.mock.calls[0][0];
  expect(arg.urls).toHaveLength(2);
  expect(arg.message).toBe('A-1 · 9,000,000 EGP');
  expect(arg.useInternalStorage).toBe(true);
});
