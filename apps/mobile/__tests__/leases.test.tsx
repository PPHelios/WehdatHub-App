import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LeasesScreen } from '../src/screens/LeasesScreen';
import { api } from '../src/api';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('../src/api', () => ({ api: { leases: jest.fn() } }));
const m = api as unknown as { leases: jest.Mock };

test('the leases list opens the unit lease card', async () => {
  m.leases.mockResolvedValue({ items: [{ code: 'R-1', tenant_name: 'Omar', tenant_ref: 'L-0042', broker_name: 'Sara', rent: 20000, end: '2027-01-10', daysLeft: 58, done: false, doneKind: null }] });
  await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LeasesScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('lease-R-1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('lease-R-1'));
  expect(mockNavigate).toHaveBeenCalledWith('Unit', { code: 'R-1' });
});
