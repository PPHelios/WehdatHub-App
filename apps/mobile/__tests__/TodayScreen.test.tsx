import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TodayScreen } from '../src/screens/TodayScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { today: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
const mocked = api as unknown as { today: jest.Mock };
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TodayScreen /></QueryClientProvider>);

test('shows tasks with a call button', async () => {
  mocked.today.mockResolvedValue({ counts: { followUpsToday: 1, viewings: 0, newLeads: 2 }, tasks: [{ ref: 'L-1', name: 'Hana', kind: 'late', at: null, unitCode: 'NH-V12', phone: '201012345678', matches: null }], moreTasks: 0 });
  await wrap();
  await waitFor(() => expect(screen.getAllByTestId('today-task')).toHaveLength(1));
  expect(screen.getByText('Hana')).toBeTruthy();
});

test('an empty day still offers an action', async () => {
  mocked.today.mockResolvedValue({ counts: { followUpsToday: 0, viewings: 0, newLeads: 0 }, tasks: [], moreTasks: 0 });
  await wrap();
  await waitFor(() => expect(screen.getByText(/Open units|افتح الوحدات/)).toBeTruthy());
});

test('a failure shows retry', async () => {
  mocked.today.mockRejectedValue(new Error('x'));
  await wrap();
  await waitFor(() => expect(screen.getAllByText(/Try again|حاول تاني/).length).toBeGreaterThan(0));
});

test('shows the role cards and a lease can be dismissed', async () => {
  mocked.today.mockResolvedValue({
    counts: { followUpsToday: 0, viewings: 0, newLeads: 0 },
    tasks: [],
    moreTasks: 0,
    cards: {
      oldUnits: { total: 1, items: [{ code: 'NH-1', line: 'Flat 150m', days: 30, hidden: false }] },
      target: null,
      leases: { total: 1, items: [{ key: 'R-1:end:2027-01-01', code: 'R-1', tenant: 'Ali', kind: 'end', date: '2027-01-01', days: 40 }] },
      ops: { unassigned: 2, uncontactedOld: 0, overdue: 1, team: false },
      commissions: null,
      approvals: null,
    },
  });
  (mocked as unknown as { todayDismiss: jest.Mock }).todayDismiss = jest.fn().mockResolvedValue({ ok: true });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('today-card-old')).toBeTruthy());
  expect(screen.getByTestId('today-card-leases')).toBeTruthy();
  expect(screen.getByTestId('today-card-info')).toBeTruthy();
  fireEvent.press(screen.getByTestId('lease-dismiss'));
  await waitFor(() => expect((mocked as unknown as { todayDismiss: jest.Mock }).todayDismiss).toHaveBeenCalledWith('lease', 'R-1:end:2027-01-01'));
});
