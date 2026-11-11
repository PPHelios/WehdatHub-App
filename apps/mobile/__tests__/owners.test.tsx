import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OwnersScreen, OwnerScreen } from '../src/screens/OwnersScreen';
import { RequestsScreen } from '../src/screens/RequestsScreen';
import { MoreScreen } from '../src/screens/MoreScreen';
import { api } from '../src/api';
import { useAuth } from '../src/auth';

jest.mock('../src/api', () => ({ api: { me: jest.fn(), owners: jest.fn(), ownerRenames: jest.fn(), owner: jest.fn(), ownerPrivate: jest.fn(), accessRequests: jest.fn(), answerAccess: jest.fn(), testRole: jest.fn(), logout: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }), useRoute: () => ({ params: { id: 'o1', name: 'Hassan' } }) }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const rights = (o: object) => ({ addUnits: true, editUnits: true, leads: true, search: true, team: false, owners: true, manager: false, agencyOwner: false, dataEntry: false, teamLead: false, ...o });
const owner = { id: 'o1', name: 'Hassan', code: 'O-1', phones: ['201000000001'], unit_count: 1, flag: null, is_private: false, notes: null, canEdit: false, units: [{ code: 'A-1', compound: 'Mivida', status: 'active', is_private: false }] };

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.setState({ status: 'signedIn' });
  m.me.mockResolvedValue({ rights: rights({}), testSwitch: null });
  m.owners.mockResolvedValue({ items: [owner], more: false });
  m.ownerRenames.mockResolvedValue({ items: [] });
  m.owner.mockResolvedValue({ owner, events: [], lead: null });
});

test('the owners list shows each owner', async () => {
  wrap(<OwnersScreen />);
  await waitFor(() => expect(screen.getByText(/Hassan/)).toBeTruthy());
});

test('only the agency owner sees the VIP switch', async () => {
  wrap(<OwnerScreen />);
  await waitFor(() => expect(screen.getByText(/A-1/)).toBeTruthy());
  expect(screen.queryByTestId('owner-vip')).toBeNull();
});

test('the agency owner can turn VIP on', async () => {
  m.me.mockResolvedValue({ rights: rights({ agencyOwner: true }), testSwitch: null });
  m.ownerPrivate.mockResolvedValue({ ok: true });
  wrap(<OwnerScreen />);
  await waitFor(() => expect(screen.getByTestId('owner-vip')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('owner-vip'));
  await waitFor(() => expect(m.ownerPrivate).toHaveBeenCalledWith('o1', true, ['A-1']));
});

test('a manager approves a pending request', async () => {
  m.accessRequests.mockResolvedValue({ total: 1, items: [{ id: 7, status: 'pending', created_at: '2026-11-11T10:00:00Z', code: 'A-1', broker_name: 'Sara', decided_by_name: null }] });
  m.answerAccess.mockResolvedValue({ ok: true });
  wrap(<RequestsScreen />);
  await waitFor(() => expect(screen.getByTestId('approve-7')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('approve-7'));
  await waitFor(() => expect(m.answerAccess).toHaveBeenCalledWith(7, true));
});

test('a plain broker sees no requests or activity buttons', async () => {
  wrap(<MoreScreen onOpen={jest.fn()} />);
  await waitFor(() => expect(screen.getByTestId('open-owners')).toBeTruthy());
  expect(screen.queryByTestId('open-requests')).toBeNull();
  expect(screen.queryByTestId('open-activity')).toBeNull();
});
