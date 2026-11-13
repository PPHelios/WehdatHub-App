import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LeadRulesScreen } from '../src/screens/LeadRulesScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { teamRules: jest.fn(), saveTeamRules: jest.fn(), saveTeamRouting: jest.fn(), setTeamAway: jest.fn() } }));
const m = api as unknown as Record<string, jest.Mock>;
const data = { rules: { enabled: false, wait_minutes: 30, start: 9, end: 21, days: [0, 1, 2, 3, 4, 5, 6], max_jumps: 2 }, roundRobin: true, order: ['b1'], brokers: [{ id: 'b1', name: 'Omar', role: 'broker', away: false, open: 4 }] };
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LeadRulesScreen /></QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  m.teamRules.mockResolvedValue(data);
  m.saveTeamRules.mockResolvedValue({ rules: data.rules });
  m.saveTeamRouting.mockResolvedValue({ roundRobin: false, order: ['b1'] });
  m.setTeamAway.mockResolvedValue({ id: 'b1', awayUntil: null });
});

test('save sends the rule and the round robin switch', async () => {
  await wrap();
  await waitFor(() => expect(screen.getByTestId('rules-save')).toBeTruthy());
  await fireEvent(screen.getByTestId('rr-switch'), 'valueChange', false);
  await fireEvent(screen.getByTestId('rule-switch'), 'valueChange', true);
  await fireEvent.press(screen.getByTestId('rules-save'));
  await waitFor(() => expect(m.saveTeamRouting).toHaveBeenCalledWith({ roundRobin: false, order: ['b1'] }));
  expect(m.saveTeamRules).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, wait_minutes: '30' }));
});

test('a broker can be sent away for a week', async () => {
  await wrap();
  await waitFor(() => expect(screen.getByTestId('away-b1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('away-b1'));
  await waitFor(() => expect(m.setTeamAway).toHaveBeenCalledWith('b1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)));
});
