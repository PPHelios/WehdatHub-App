import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnitsScreen } from '../src/screens/UnitsScreen';
import { api } from '../src/api';
import { useAuth } from '../src/auth';

jest.mock('../src/api', () => ({ api: { units: jest.fn(), me: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }), useRoute: () => ({ params: undefined }) }));
const mocked = api as unknown as { units: jest.Mock; me: jest.Mock };

const page = { total: 1, counts: { active: 4, sold: 2, archived: 1 }, limit: 20, offset: 0, items: [{ id: 'u1', code: 'A-1', compound: 'Mivida', price: 9000000, bedrooms: 3, bathrooms: 2, area: 150, mine: true, photo: null }] };
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitsScreen /></QueryClientProvider>);
const rights = (addUnits: boolean) => ({ addUnits, editUnits: addUnits, leads: true, search: true, team: false, owners: false, manager: false, agencyOwner: false, dataEntry: false, teamLead: false });

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.setState({ status: 'signedIn' });
  mocked.units.mockResolvedValue(page);
});

test('the status chips show their counts and the add button shows when allowed', async () => {
  mocked.me.mockResolvedValue({ rights: rights(true) });
  await wrap();
  await waitFor(() => expect(screen.getByText(/\(4\)/)).toBeTruthy());
  expect(screen.getByText(/\(2\)/)).toBeTruthy();
  await waitFor(() => expect(screen.getByTestId('add-unit')).toBeTruthy());
});

test('the add button is hidden when the agency owner switched adding off', async () => {
  mocked.me.mockResolvedValue({ rights: rights(false) });
  await wrap();
  await waitFor(() => expect(screen.getByText(/\(4\)/)).toBeTruthy());
  await waitFor(() => expect(screen.queryByTestId('add-unit')).toBeNull());
});
