import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClientError } from '@wehdathub/shared';
import { UnitScreen } from '../src/screens/UnitScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { unitEditFields: jest.fn(), saveUnitEdit: jest.fn(), unit: jest.fn(), unitContact: jest.fn(), unitAccessRequest: jest.fn(), unitShareLink: jest.fn() } }));
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
let mockParams: object | undefined;
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, replace: jest.fn() }), useRoute: () => ({ params: mockParams }) }));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn(), startRecording: jest.fn(), stopRecording: jest.fn() }));
const m = api as unknown as Record<string, jest.Mock>;

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const unit = { id: 'u1', code: 'A-1', status: 'active', compound: 'Mivida', price: 9000000, bedrooms: 3, bathrooms: 2, area: 150, district: null, city: null, finishing: null, furnishing: null, features: [], images: [] };

beforeEach(() => {
  jest.clearAllMocks();
});

test('a hidden contact offers a request, then shows it is pending', async () => {
  m.unit.mockResolvedValue(unit);
  m.unitContact.mockImplementation(() => Promise.reject(new ApiClientError(403, 'hidden', null, { access: m.unitAccessRequest.mock.calls.length ? 'pending' : 'ask' })));
  m.unitAccessRequest.mockResolvedValue({ ok: true, already: false, access: 'pending' });
  await render(<QueryClientProvider client={client()}><UnitScreen code="A-1" /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('request-access')).toBeTruthy(), { timeout: 5000 });
  await fireEvent.press(screen.getByTestId('request-access'));
  await waitFor(() => expect(screen.getByTestId('access-pending')).toBeTruthy(), { timeout: 5000 });
  expect(screen.queryByTestId('request-access')).toBeNull();
});
