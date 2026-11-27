import React from 'react';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddUnitScreen } from '../src/screens/AddUnitScreen';
import { api } from '../src/api';
import * as draft from '../src/draft';

// QA 2026-11-17: after an imported post was edited and saved, the app opened a SECOND, empty import screen (React Navigation 7's
// navigate() pushes a new screen), so the other posts were lost. It must return to the open import screen with popTo.
const mockPopTo = jest.fn();
const mockNavigate = jest.fn();
jest.mock('../src/api', () => ({ api: { extractUnit: jest.fn(), reviewUnit: jest.fn(), createUnit: jest.fn(), placeBox: jest.fn(), placeBoxResolve: jest.fn(), placeSuggest: jest.fn(), unitSaveStatus: jest.fn(), photoUploadLinks: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: jest.fn(), navigate: mockNavigate, popTo: mockPopTo, goBack: jest.fn() }),
  useRoute: () => ({ params: { text: 'Code HP-9 villa 354m 3 bedrooms', fresh: true, noAi: true, importId: '4', code: 'HP-9', fields: { listing_type: 'sale', property_type: 'villa', compound: 'Hyde Park', area_value: '354', bedrooms: '3', price_value: '9000000', owner_phone: '01012345678', owner_name_from_phone: '1' } } }),
}));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn().mockResolvedValue(true), startRecording: jest.fn(), stopRecording: jest.fn(), cancelRecording: jest.fn() }));
const m = api as unknown as Record<string, jest.Mock>;

beforeEach(async () => {
  jest.clearAllMocks();
  m.placeBoxResolve.mockResolvedValue({});
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null });
  m.createUnit.mockResolvedValue({ code: 'HP-9', photos: 0, photosFailed: 0 });
  await draft.clearDraft();
});

test('saving an edited import post goes back to the open import screen (popTo), marking the post as added', async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AddUnitScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('f-area_value').props.value).toBe('354'));
  await waitFor(() => expect(screen.getByTestId('save-unit')).toBeEnabled(), { timeout: 4000 });
  await act(async () => { fireEvent.press(screen.getByTestId('save-unit')); });
  await waitFor(() => expect(mockPopTo).toHaveBeenCalledWith('WhatsAppImport', { saved: { id: '4', code: 'HP-9' } }));
  expect(mockNavigate).not.toHaveBeenCalledWith('WhatsAppImport', expect.anything());
});
