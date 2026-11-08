import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
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
