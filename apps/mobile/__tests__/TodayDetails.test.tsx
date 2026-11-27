import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TodayDetails } from '../src/components/TodayDetails';
import { api } from '../src/api';

import { usePlanState } from '../src/planState';

jest.mock('../src/api', () => ({ api: { today: jest.fn() } }));
jest.mock('../src/planState', () => ({ ...jest.requireActual('../src/planState'), usePlanState: jest.fn(() => ({ phase: 'none', daysLeft: 30, manager: true, allowance: undefined })) }));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
const mocked = api as unknown as { today: jest.Mock };
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TodayDetails /></QueryClientProvider>);

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

test('shows the role cards', async () => {
  mocked.today.mockResolvedValue({
    counts: { followUpsToday: 0, viewings: 0, newLeads: 0 },
    tasks: [],
    moreTasks: 0,
    cards: {
      oldUnits: { total: 1, items: [{ code: 'NH-1', line: 'Flat 150m', days: 30, hidden: false }] },
      target: null,
      ops: { unassigned: 2, uncontactedOld: 0, overdue: 1, team: false },
      commissions: null,
      approvals: null,
    },
  });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('today-card-old')).toBeTruthy());
  expect(screen.getByTestId('today-card-info')).toBeTruthy();
  expect(screen.getByTestId('old-toggle')).toHaveProp('accessibilityState', { expanded: false });
  expect(screen.queryByTestId('old-row-NH-1')).toBeNull();
  await fireEvent.press(screen.getByTestId('old-toggle'));
  expect(screen.getByTestId('old-row-NH-1')).toBeTruthy();
});

test('Open units goes to the UnitsList stack screen (it exists for every role, unlike the Units tab)', async () => {
  mocked.today.mockResolvedValue({ counts: { followUpsToday: 0, viewings: 0, newLeads: 0 }, tasks: [], moreTasks: 0 });
  await wrap();
  await fireEvent.press(await screen.findByText(/Open units|افتح الوحدات/));
  expect(mockNavigate).toHaveBeenCalledWith('UnitsList');
});

test('shows expired plan alert even when rendered inside the SearchHome brief', async () => {
  jest.mocked(usePlanState).mockReturnValue({ phase: 'grace', daysLeft: 2, manager: true, allowance: undefined });
  mocked.today.mockResolvedValue({ counts: { followUpsToday: 0, viewings: 0, newLeads: 0 }, tasks: [], moreTasks: 0 });
  try {
    const result = await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TodayDetails brief={{ ops: false, units: false, viewing: null }} /></QueryClientProvider>);
    expect(await screen.findByTestId('today-plan-expired')).toBeTruthy();
    await result.unmount();
  } finally {
    jest.mocked(usePlanState).mockReturnValue({ phase: 'none', daysLeft: 30, manager: true, allowance: undefined });
  }
});

test('orders Today cards by urgency with badges matching Dashboard priority order', async () => {
  mocked.today.mockResolvedValue({
    counts: { followUpsToday: 0, viewings: 0, newLeads: 0 },
    tasks: [],
    moreTasks: 0,
    cards: {
      target: { deals: 1, commission: 5000, targetDeals: 4, targetCommission: 20000, daysLeft: 10 },
      ops: { unassigned: 2, uncontactedOld: 1, overdue: 1, team: false },
      commissions: { overdue: 1, registrations: 0 },
      approvals: { access: 1, names: 0 },
      oldUnits: null,
    },
  });
  await wrap();
  expect(await screen.findByTestId('today-card-ops')).toBeTruthy();
  expect(screen.getByTestId('today-card-commissions')).toBeTruthy();
  expect(screen.getByTestId('today-card-access')).toBeTruthy();
  expect(screen.getByTestId('today-badge-ops')).toBeTruthy();
  expect(screen.getByTestId('today-badge-commissions')).toBeTruthy();
});
