import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnitScreen } from '../src/screens/UnitScreen';
import { api } from '../src/api';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }), useRoute: () => ({ params: undefined }) }));
jest.mock('../src/api', () => ({ api: { unit: jest.fn(), unitContact: jest.fn(), unitShareLink: jest.fn() } }));
const mocked = api as unknown as { unit: jest.Mock; unitContact: jest.Mock };

const unit = { id: 'u1', code: 'A-1', status: 'active', compound: 'Mivida', price: 9000000, bedrooms: 3, bathrooms: 2, area: 150, district: null, city: null, finishing: null, furnishing: null, features: [], images: [] };
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitScreen code="A-1" /></QueryClientProvider>);

test('the owner buttons show only when the server gives the number', async () => {
  mocked.unit.mockResolvedValue(unit);
  mocked.unitContact.mockResolvedValue({ name: 'Ali', phone: '01012345678' });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('call-owner')).toBeTruthy());
  expect(screen.getByTestId('share-link')).toBeTruthy();
});

test('a refused contact hides the owner buttons', async () => {
  mocked.unit.mockResolvedValue(unit);
  mocked.unitContact.mockRejectedValue(new Error('hidden'));
  await wrap();
  await waitFor(() => expect(screen.getByTestId('share-unit')).toBeTruthy());
  expect(screen.queryByTestId('call-owner')).toBeNull();
});
