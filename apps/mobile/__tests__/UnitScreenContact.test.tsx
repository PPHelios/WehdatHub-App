import React from 'react';
import { StyleSheet } from 'react-native';
import { ltr } from '@wehdathub/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnitScreen } from '../src/screens/UnitScreen';
import { api } from '../src/api';
import { loadContacts } from '../src/contacts';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }), useRoute: () => ({ params: undefined }) }));
jest.mock('../src/api', () => ({ api: { unit: jest.fn(), unitContact: jest.fn(), unitShareLink: jest.fn() } }));
jest.mock('../src/contacts', () => ({ ...jest.requireActual('../src/contacts'), loadContacts: jest.fn() }));
const mocked = api as unknown as { unit: jest.Mock; unitContact: jest.Mock; unitShareLink: jest.Mock };

const unit = { id: 'u1', code: 'A-1', status: 'active', compound: 'Mivida', price: 9000000, bedrooms: 3, bathrooms: 2, area: 150, district: null, city: null, finishing: null, furnishing: null, features: [], images: [] };
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitScreen code="A-1" /></QueryClientProvider>);

test('the owner buttons show only when the server gives the number', async () => {
  mocked.unit.mockResolvedValue(unit);
  mocked.unitContact.mockResolvedValue({ name: 'Ali', phone: '+20 101 234 5678' });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('call-owner')).toBeTruthy(), { timeout: 4000 });
  expect(screen.getByText('Ali')).toBeTruthy();
  expect(screen.getByTestId('owner-phone').props.children).toBe(ltr('+20 101 234 5678'));
  expect(StyleSheet.flatten(screen.getByTestId('unit-owner').props.style).direction).toBe('ltr');
  expect(screen.getByTestId('share-link')).toBeTruthy();
});

test('a refused contact hides the owner buttons', async () => {
  mocked.unit.mockResolvedValue(unit);
  mocked.unitContact.mockRejectedValue(new Error('hidden'));
  await wrap();
  await waitFor(() => expect(screen.getByTestId('share-unit')).toBeTruthy());
  expect(screen.queryByTestId('call-owner')).toBeNull();
  expect(screen.queryByTestId('unit-owner')).toBeNull();
});


test.each(['number', 'contact'])('Send client link accepts a %s from the recipient modal', async (mode) => {
  mocked.unit.mockResolvedValue(unit);
  mocked.unitContact.mockRejectedValue(new Error('hidden'));
  mocked.unitShareLink.mockResolvedValue({ url: 'https://example.com/unit' });
  jest.mocked(loadContacts).mockResolvedValue([{ id: 'client-1', name: 'Test Client', phone: '01012345678' }]);
  await wrap();
  await fireEvent.press(await screen.findByTestId('share-link'));
  if (mode === 'contact') {
    await fireEvent.press(screen.getByTestId('client-pick-contact'));
    await fireEvent.press(await screen.findByText(/Test Client/));
  } else {
    await fireEvent.changeText(screen.getByTestId('client-to'), '01012345678');
  }
  expect(screen.getByTestId('client-to').props.value).toBe('01012345678');
  expect(StyleSheet.flatten(screen.getByTestId('client-to').props.style).direction).toBe('ltr');
  await fireEvent.press(screen.getByTestId('client-make'));
  await waitFor(() => expect(mocked.unitShareLink).toHaveBeenCalledWith('A-1', expect.anything(), '01012345678'));
  mocked.unitShareLink.mockClear();
});
