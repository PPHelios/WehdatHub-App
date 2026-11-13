import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnitPrivateForms } from '../src/components/UnitPrivateForms';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { unitLease: jest.fn(), saveUnitLease: jest.fn(), saveUnitPrivate: jest.fn(), unitLeaseContacts: jest.fn(), unitLeaseDone: jest.fn() } }));
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

test('an existing lease offers WhatsApp to the tenant and owner and can be marked handled', async () => {
  m.unitLease.mockResolvedValue({ rent: true, lease: { startDate: '2026-01-01', months: 12, rent: 20000, increasePct: null, tenantName: 'Omar', remind: true, done: false } });
  m.unitLeaseContacts.mockResolvedValue({ tenant: { name: 'Omar', ref: 'L-0042', phone: '201000000001' }, owner: { name: 'Hassan', phone: '201000000002' } });
  m.unitLeaseDone.mockResolvedValue({ ok: true });
  await wrap();
  await fireEvent.press(await screen.findByText('عقد الإيجار'));
  await waitFor(() => expect(screen.getByTestId('lease-wa-tenant')).toBeTruthy());
  expect(screen.getByTestId('lease-wa-owner')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('lease-done-renewed'));
  await waitFor(() => expect(m.unitLeaseDone).toHaveBeenCalledWith('R-1', 'renewed'));
});
