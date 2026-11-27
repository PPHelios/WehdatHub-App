import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddUnitScreen } from '../src/screens/AddUnitScreen';
import { api } from '../src/api';
import * as draft from '../src/draft';

jest.mock('../src/api', () => ({ api: { extractUnit: jest.fn(), reviewUnit: jest.fn(), createUnit: jest.fn(), placeBox: jest.fn(), placeBoxResolve: jest.fn(), placeSuggest: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: jest.fn() }),
  useRoute: () => ({ params: { text: 'Code HP-9 villa 354m 3 bedrooms', fresh: true, noAi: true, importId: '4', code: 'HP-9', fields: { listing_type: 'sale', property_type: 'villa', area_value: '354', bedrooms: '3', price_value: '9000000' } } }),
}));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn().mockResolvedValue(true), startRecording: jest.fn(), stopRecording: jest.fn(), cancelRecording: jest.fn() }));
const m = api as unknown as { extractUnit: jest.Mock; placeBoxResolve: jest.Mock };

const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AddUnitScreen /></QueryClientProvider>);
beforeEach(async () => {
  jest.clearAllMocks();
  m.placeBoxResolve.mockResolvedValue({});
  await draft.clearDraft();
});

test('opened from the WhatsApp import: the fields and the code are already filled, and there is no AI fill or voice button', async () => {
  await wrap();
  await waitFor(() => expect(screen.getByTestId('f-area_value').props.value).toBe('354'));
  expect(screen.getByTestId('f-code').props.value).toBe('HP-9');
  expect(screen.getByTestId('f-price_value').props.value).toBe('9,000,000');
  expect(screen.getByTestId('describe').props.value).toContain('Code HP-9 villa');
  expect(screen.getByText(/Original message|الرسالة الأصلية/)).toBeTruthy();
  expect(screen.queryByTestId('fill')).toBeNull();
  expect(screen.queryByTestId('unit-mic')).toBeNull();
  expect(m.extractUnit).not.toHaveBeenCalled();
});
