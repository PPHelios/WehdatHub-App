import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnitPrivateForms } from '../src/components/UnitPrivateForms';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { unitLease: jest.fn(), saveUnitLease: jest.fn(), saveUnitPrivate: jest.fn() } }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitPrivateForms code="R-1" /></QueryClientProvider>);

test('a rented unit shows the lease form and saves it', async () => {
  m.unitLease.mockResolvedValue({ rent: true, lease: null });
  m.saveUnitLease.mockResolvedValue({ ok: true });
  await wrap();
  await waitFor(() => expect(screen.getByText('عقد الإيجار')).toBeTruthy());
  await fireEvent.press(screen.getByText('عقد الإيجار'));
  await waitFor(() => expect(screen.getByTestId('lease-save')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('lease-save'));
  await waitFor(() => expect(m.saveUnitLease).toHaveBeenCalled());
});

test('a unit for sale has no lease form, only the private details', async () => {
  m.unitLease.mockResolvedValue({ rent: false, lease: null });
  m.saveUnitPrivate.mockResolvedValue({ ok: true });
  await wrap();
  await waitFor(() => expect(screen.getByText('تفاصيل للشركة بس')).toBeTruthy());
  await fireEvent.press(screen.getByText('تفاصيل للشركة بس'));
  await waitFor(() => expect(screen.getByTestId('private-save')).toBeTruthy());
  expect(screen.queryByText('عقد الإيجار')).toBeNull();
});
