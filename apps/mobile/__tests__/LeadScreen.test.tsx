import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClientError } from '@wehdathub/shared';
import { LeadScreen } from '../src/screens/LeadScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { lead: jest.fn(), leadCalled: jest.fn(), leadStage: jest.fn(), leadFollowUp: jest.fn(), leadNote: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ params: { ref: 'L-0001' } }) }));
const m = api as unknown as Record<string, jest.Mock>;
const lead = { ref: 'L-0001', name: 'Sara', phones: ['201012345678'], kind: 'buyer', stage: 'new', lostReason: null, source: 'Web', notes: null, nextFollowUpAt: null, followUpKind: null, followUpNote: null, lastContactAt: null, assignee: null, version: 3 };

const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LeadScreen /></QueryClientProvider>);
beforeEach(() => {
  jest.clearAllMocks();
  m.lead.mockResolvedValue({ lead, timeline: [] });
});

test('I called sends the version the screen shows', async () => {
  m.leadCalled.mockResolvedValue({ lead: { ...lead, version: 4 } });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('lead-called')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('lead-called'));
  await waitFor(() => expect(m.leadCalled).toHaveBeenCalledWith('L-0001', 3));
});

test('a change made elsewhere shows a clear message and reloads', async () => {
  m.leadCalled.mockRejectedValue(new ApiClientError(409, 'conflict'));
  await wrap();
  await waitFor(() => expect(screen.getByTestId('lead-called')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('lead-called'));
  await waitFor(() => expect(screen.getByTestId('lead-message')).toBeTruthy());
  expect(m.lead.mock.calls.length).toBeGreaterThan(1);
});
