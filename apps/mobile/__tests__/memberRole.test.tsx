import React from 'react';
import { Alert } from 'react-native';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemberRole } from '../src/screens/TeamScreen';
import { InviteScreen } from '../src/screens/InviteScreen';
import { api } from '../src/api';
import { currentLang, useAuth } from '../src/auth';
import { ot } from '../src/ownerText';

jest.mock('../src/api', () => ({ api: { me: jest.fn(), team: jest.fn(), changeRole: jest.fn(), teamRole: jest.fn(), setTeam: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }), useRoute: () => ({ params: {} }) }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const rights = (o: object) => ({ addUnits: true, editUnits: true, leads: true, search: true, team: true, owners: true, manager: false, agencyOwner: false, dataEntry: false, teamLead: false, ...o });
const run = async (fn: () => Promise<unknown>) => { await fn(); };
const L = (k: string) => ot(currentLang(), k as never);
// "Are you sure?": press the first button (Save).
const confirm = () => jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => { buttons?.[0]?.onPress?.(); });

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.setState({ status: 'signedIn' });
  m.team.mockResolvedValue({ items: [{ id: 'tl1', name: 'Lina', role: 'team_lead', teamLeadId: null, me: false, away: false, open: 0, overdue: 0, soon: 0 }] });
  for (const k of ['changeRole', 'teamRole', 'setTeam']) m[k].mockResolvedValue({ ok: true });
});

test('a manager sees broker and team lead only, and makes a broker a team lead', async () => {
  m.me.mockResolvedValue({ rights: rights({ manager: true }), testSwitch: null });
  confirm();
  wrap(<MemberRole id="b1" role="broker" teamLeadId={null} run={run} />);
  await waitFor(() => expect(screen.getByText(L('teamLead'))).toBeTruthy());
  expect(screen.queryByText(L('dataEntry'))).toBeNull();
  fireEvent.press(screen.getByText(L('teamLead')));
  await waitFor(() => expect(m.teamRole).toHaveBeenCalledWith('b1', true));
  expect(m.changeRole).not.toHaveBeenCalled();
});

test('a manager puts a broker in a team', async () => {
  m.me.mockResolvedValue({ rights: rights({ manager: true }), testSwitch: null });
  wrap(<MemberRole id="b1" role="broker" teamLeadId={null} run={run} />);
  await waitFor(() => expect(screen.getByText('Lina')).toBeTruthy());
  fireEvent.press(screen.getByText('Lina'));
  await waitFor(() => expect(m.setTeam).toHaveBeenCalledWith('b1', 'tl1'));
});

test('the agency owner moves a team lead to data entry: role taken back, then changed', async () => {
  m.me.mockResolvedValue({ rights: rights({ manager: true, agencyOwner: true }), testSwitch: null });
  confirm();
  wrap(<MemberRole id="b2" role="team_lead" teamLeadId={null} run={run} />);
  await waitFor(() => expect(screen.getByText(L('dataEntry'))).toBeTruthy());
  fireEvent.press(screen.getByText(L('dataEntry')));
  await waitFor(() => expect(m.changeRole).toHaveBeenCalledWith('b2', 'data_entry'));
  expect(m.teamRole).toHaveBeenCalledWith('b2', false);
});

test('a manager who is not the owner gets no role choice for a data entry member', async () => {
  m.me.mockResolvedValue({ rights: rights({ manager: true }), testSwitch: null });
  wrap(<MemberRole id="b3" role="data_entry" teamLeadId={null} run={run} />);
  await waitFor(() => expect(m.me).toHaveBeenCalled());
  expect(screen.queryByTestId('member-role')).toBeNull();
});

test('InviteScreen and MemberRole respect inviteRoles and hide team_lead / data_entry in Team tier', async () => {
  m.me.mockResolvedValue({
    rights: rights({ manager: true, agencyOwner: true }),
    workspace: { tier: 'team', mode: 'team', members: 4, solo: false, teamStyle: 'shared', analytics: false },
    inviteRoles: ['broker', 'manager'],
    testSwitch: null,
  });
  wrap(<InviteScreen />);
  await waitFor(() => expect(screen.getByText(L('broker'))).toBeTruthy());
  expect(screen.getByText(L('manager'))).toBeTruthy();
  expect(screen.queryByText(L('teamLead'))).toBeNull();
  expect(screen.queryByText(L('dataEntry'))).toBeNull();

  wrap(<MemberRole id="b1" role="broker" teamLeadId={null} run={run} />);
  await waitFor(() => expect(screen.getByTestId('member-role')).toBeTruthy());
  expect(screen.queryByText(L('teamLead'))).toBeNull();
  expect(screen.queryByText(L('dataEntry'))).toBeNull();
});
