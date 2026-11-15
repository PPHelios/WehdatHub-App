import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LeadsScreen } from '../src/screens/LeadsScreen';
import { NewLeadScreen } from '../src/screens/NewLeadScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { leads: jest.fn(), leadCounts: jest.fn(), team: jest.fn(), assignLead: jest.fn(), extractLead: jest.fn(), createLead: jest.fn() } }));
jest.mock('../src/rights', () => ({ useRights: () => ({ manager: true }) }));
jest.mock('../src/layout', () => ({ useWide: () => false, useColumns: () => 1, Split: () => null }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn(), replace: jest.fn() }), useRoute: () => ({ params: undefined }) }));
const m = api as unknown as Record<string, jest.Mock>;
const lead = (ref: string, version: number, name = 'Sara') => ({ ref, name, phones: ['201012345678'], kind: 'buyer', stage: 'new', lostReason: null, source: null, notes: null, nextFollowUpAt: null, followUpKind: null, followUpNote: null, lastContactAt: null, assignee: null, assigneeId: null, version });
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  m.leads.mockResolvedValue({ items: [lead('L-1', 2, 'Alpha'), lead('L-2', 5, 'Beta')], more: false, total: 2, offset: 0, limit: 20 });
  m.leadCounts.mockResolvedValue({ counts: {} });
  m.team.mockResolvedValue({ items: [{ id: 'b1', name: 'Omar', role: 'broker', me: false, away: false, open: 3, overdue: 0, soon: 0 }] });
  m.assignLead.mockResolvedValue({ lead: lead('L-1', 3) });
});

test('the Unassigned chip asks the server for unassigned leads', async () => {
  await wrap(<LeadsScreen />);
  await waitFor(() => expect(screen.getByTestId('chip-unassigned')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('chip-unassigned'));
  await waitFor(() => expect(m.leads).toHaveBeenCalledWith(expect.objectContaining({ broker: 'none' })));
});

test('select two leads and hand them to a broker, each with its own version', async () => {
  await wrap(<LeadsScreen />);
  await waitFor(() => expect(screen.getByTestId('select-leads')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('select-leads'));
  await fireEvent.press(screen.getByText(/Alpha/));
  await fireEvent.press(screen.getByText(/Beta/));
  await fireEvent.press(screen.getByTestId('assign-selected'));
  await waitFor(() => expect(screen.getByTestId('assign-b1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('assign-b1'));
  await waitFor(() => expect(m.assignLead).toHaveBeenCalledTimes(2));
  expect(m.assignLead).toHaveBeenCalledWith('L-1', 2, 'b1');
  expect(m.assignLead).toHaveBeenCalledWith('L-2', 5, 'b1');
});

test('pasting a WhatsApp message fills the new lead form', async () => {
  m.extractLead.mockResolvedValue({ name: 'Sara', phones: ['01012345678'], kind: 'tenant', source: '', note: 'wants 2 rooms' });
  await wrap(<NewLeadScreen />);
  await fireEvent.changeText(screen.getByTestId('lead-paste'), 'hello 01012345678');
  await fireEvent.press(screen.getByTestId('lead-fill'));
  await waitFor(() => expect(screen.getByTestId('lead-phone').props.value).toBe('01012345678'));
  expect(screen.getByTestId('lead-name').props.value).toBe('Sara');
});
