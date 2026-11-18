import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnitsScreen, money } from '../src/screens/UnitsScreen';
import { api } from '../src/api';
import { useAuth } from '../src/auth';

jest.mock('../src/api', () => ({ api: { me: jest.fn(), units: jest.fn(), unitCompounds: jest.fn(), today: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }), useRoute: () => ({ params: undefined }) }));
jest.mock('../src/layout', () => ({ useWide: () => false, useColumns: () => 1, Split: () => null }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitsScreen /></QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.setState({ status: 'signedIn' });
  m.me.mockResolvedValue({ rights: { addUnits: true, editUnits: true, leads: true, search: true, team: false, owners: true, manager: false, agencyOwner: false, dataEntry: false, teamLead: false }, testSwitch: null });
  m.units.mockResolvedValue({ total: 0, counts: { active: 0, sold: 0, archived: 0 }, limit: 20, offset: 0, items: [] });
  m.unitCompounds.mockResolvedValue({ items: [] });
});

test('money reads 3m, 3,500,000 and Arabic digits', () => {
  expect(money('3m')).toBe(3000000);
  expect(money('3,500,000')).toBe(3500000);
  expect(money('٢٥٠٠٠٠٠')).toBe(2500000);
  expect(money('abc')).toBe(0);
});

test('the units list has the website filters: deal, type, bedrooms, finishing, price', async () => {
  await wrap();
  await waitFor(() => expect(m.units).toHaveBeenCalled());
  await fireEvent.press(screen.getByTestId('units-filters'));
  for (const id of ['f-deal', 'f-type', 'f-beds', 'f-pmin', 'f-pmax', 'f-finishing', 'f-furnishing', 'f-mine']) expect(screen.getByTestId(id)).toBeTruthy();
  await fireEvent.press(screen.getByText(/Rent|إيجار/));
  await fireEvent.press(screen.getByText(/Fully finished|تشطيب كامل/));
  await waitFor(() => expect(m.units).toHaveBeenLastCalledWith(expect.objectContaining({ deal: 'rent', finishing: 'fully_finished' })));
});
