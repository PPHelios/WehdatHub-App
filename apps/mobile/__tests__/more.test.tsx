import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CompareScreen, PlatformScreen } from '../src/screens/MoreScreens';
import { MoreScreen } from '../src/screens/MoreScreen';
import { ReportsHubScreen } from '../src/screens/ReportsHubScreen';
import { AdminHubScreen } from '../src/screens/AdminHubScreen';
import { ClientsHubScreen } from '../src/screens/ClientsHubScreen';
import { SettingsHubScreen } from '../src/screens/SettingsHubScreen';
import { api } from '../src/api';
import { useAuth } from '../src/auth';

jest.mock('../src/api', () => ({ api: { me: jest.fn(), catalogue: jest.fn(), compare: jest.fn(), platform: jest.fn(), platformSignup: jest.fn(), platformAgency: jest.fn(), dashboard: jest.fn().mockResolvedValue({ days: 30, weekly: [], sources: [], pipeline: {}, unassigned: 0, uncontacted: 0, overdue: 0, units: { active: 0, stale: 0 }, deals: { n: 0, commission: 0, value: 0 }, leads: 0, board: [] }), team: jest.fn().mockResolvedValue({ items: [] }), calendar: jest.fn().mockResolvedValue({ items: [] }), leads: jest.fn().mockResolvedValue({ items: [], more: false, total: 0, offset: 0, limit: 20 }), portalEnquiries: jest.fn().mockResolvedValue({ items: [] }) } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }), useRoute: () => ({ params: { id: 'p1', name: 'P' } }) }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = async (ui: React.ReactElement, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) =>
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);

test('compare makes a link', async () => {
  m.compare.mockResolvedValue({ url: 'https://x/c/1', codes: ['A', 'B'] });
  await wrap(<CompareScreen />);
  await fireEvent.changeText(screen.getByTestId('compare-code-0'), 'A-1');
  await fireEvent.changeText(screen.getByTestId('compare-code-1'), 'B-2');
  await fireEvent.press(screen.getByTestId('compare-make'));
  await waitFor(() => expect(screen.getByTestId('compare-url')).toBeTruthy());
});

test('platform lists agencies', async () => {
  m.platform.mockResolvedValue({ dashboard: {}, period: {}, agencies: [{ id: 'a1', name: 'NCH', plan: 'office', brokers: 3, units: 10, leads30: 4 }], signupOpen: false });
  await wrap(<PlatformScreen />);
  await waitFor(() => expect(screen.getByTestId('agency-a1')).toBeTruthy());
});

test('Solo owner MoreScreen shows My Stats, Portal, and Add teammate / Plan instead of Agency hubs, and ClientsHub hides Pipeline', async () => {
  useAuth.setState({ status: 'signedIn', broker: { id: 'solo-1', name: 'Hany', role: 'owner', lang: 'en' } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['me'], {
    rights: { addUnits: true, editUnits: true, leads: true, search: true, team: false, owners: true, manager: true, agencyOwner: true, dataEntry: false, teamLead: false },
    workspace: { tier: 'solo', mode: 'solo', members: 1, solo: true, teamStyle: 'shared', analytics: false },
    nav: {
      role: 'owner',
      tabs: [],
      groups: [{
        key: 'main',
        label: { ar: '', en: '' },
        items: [
          { key: 'dashboard', app: 'Dashboard', icon: 'dashboard', label: { ar: 'إحصائياتي', en: 'My Stats' }, web: '/app/dashboard', onBar: false },
          { key: 'portal', app: 'Portal', icon: 'building', label: { ar: 'البوابات', en: 'Portal' }, web: '/app/portal', onBar: false },
          { key: 'plan', app: 'Plan', icon: 'card', label: { ar: 'الباقة', en: 'Plan' }, web: '/app/plan', onBar: false },
        ],
      }],
    },
  });
  const onOpen = jest.fn();
  await wrap(<MoreScreen onOpen={onOpen} />, client);
  expect(screen.getByTestId('hub-mystats')).toBeTruthy();
  expect(screen.getByTestId('hub-portal')).toBeTruthy();
  expect(screen.getByTestId('hub-plan-teammate')).toBeTruthy();
  expect(screen.queryByTestId('hub-admin')).toBeNull();
  expect(screen.queryByTestId('hub-reports')).toBeNull();

  await fireEvent.press(screen.getByTestId('hub-mystats'));
  expect(onOpen).toHaveBeenCalledWith('Dashboard');
  await fireEvent.press(screen.getByTestId('hub-portal'));
  expect(onOpen).toHaveBeenCalledWith('Portal');
  await fireEvent.press(screen.getByTestId('hub-plan-teammate'));
  expect(onOpen).toHaveBeenCalledWith('Plan');

  await wrap(<ClientsHubScreen />, client);
  expect(screen.queryByTestId('hub-tab-pipeline')).toBeNull();
  expect(screen.getByTestId('hub-tab-calendar')).toBeTruthy();
});

test('Team and Broker nav specs hide disallowed hub tabs in AdminHub, ReportsHub, and SettingsHub', async () => {
  useAuth.setState({ status: 'signedIn', broker: { id: 'team-1', name: 'Mona', role: 'owner', lang: 'en' } });
  const teamClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  teamClient.setQueryData(['me'], {
    rights: { addUnits: true, editUnits: true, leads: true, search: true, team: true, owners: true, manager: true, agencyOwner: true, dataEntry: false, teamLead: false },
    workspace: { tier: 'team', mode: 'team', members: 4, solo: false, teamStyle: 'shared', analytics: false },
    nav: {
      role: 'owner',
      tabs: [],
      groups: [{
        key: 'all',
        label: { ar: '', en: '' },
        items: [
          { key: 'team', app: 'Team', icon: 'team', label: { ar: '', en: 'Team' }, web: null, onBar: false },
          { key: 'portal', app: 'Portal', icon: 'building', label: { ar: '', en: 'Portal' }, web: null, onBar: false },
          { key: 'dashboard', app: 'Dashboard', icon: 'dashboard', label: { ar: '', en: 'Dashboard' }, web: null, onBar: false },
          { key: 'activity', app: 'ActivityLog', icon: 'folder', label: { ar: '', en: 'Activity' }, web: null, onBar: false },
        ],
      }],
    },
  });

  await wrap(<AdminHubScreen />, teamClient);
  expect(screen.getByTestId('hub-tab-team')).toBeTruthy();
  expect(screen.getByTestId('hub-tab-portals')).toBeTruthy();
  expect(screen.queryByTestId('hub-tab-rules')).toBeNull();
  expect(screen.queryByTestId('hub-tab-requests')).toBeNull();

  await wrap(<ReportsHubScreen />, teamClient);
  expect(screen.getByTestId('hub-tab-dashboard')).toBeTruthy();
  expect(screen.getByTestId('hub-tab-activity')).toBeTruthy();
  expect(screen.queryByTestId('hub-tab-winloss')).toBeNull();
  expect(screen.queryByTestId('hub-tab-sources')).toBeNull();

  const brokerClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  brokerClient.setQueryData(['me'], {
    rights: { addUnits: true, editUnits: true, leads: true, search: true, team: false, owners: false, manager: false, agencyOwner: false, dataEntry: false, teamLead: false },
    workspace: { tier: 'team', mode: 'team', members: 4, solo: false, teamStyle: 'shared', analytics: false },
    nav: { role: 'broker', tabs: [], groups: [] },
  });
  await wrap(<SettingsHubScreen />, brokerClient);
  expect(screen.queryByTestId('hub-tab-plan')).toBeNull();
  expect(screen.getByTestId('hub-tab-app')).toBeTruthy();
});
