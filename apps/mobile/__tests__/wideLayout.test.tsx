import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigation } from '../src/navigation';
import { useAuth } from '../src/auth';
import type { ApiBroker } from '@wehdathub/shared';

let mockWidth = 1194;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => ({ width: mockWidth, height: 834, scale: 2, fontScale: 1 }) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, SafeAreaProvider: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaInsetsContext: require('react').createContext({ top: 0, bottom: 0, left: 0, right: 0 }), initialWindowMetrics: { frame: { x: 0, y: 0, width: 1194, height: 834 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } } };
});
jest.mock('../src/rights', () => ({ useRightsState: () => ({ ready: true, nav: null, workspace: null, rights: { leads: true, addUnits: true, manager: false, agencyOwner: false, team: false } }), useRights: () => ({}) }));
jest.mock('../src/components/NotificationBell', () => ({ NotificationBell: () => null, inboxUnreadOptions: { queryKey: ['unread'], queryFn: async () => ({}) } }));
for (const m of ['SearchScreen', 'LeadsScreen', 'MapScreen', 'UnitsScreen', 'MoreScreen', 'TeamScreen', 'OwnersScreen', 'LoginScreen']) {
  jest.mock(`../src/screens/${m}`, () => new Proxy({}, { get: () => () => null }));
}
jest.mock('../src/screens/MoreScreens', () => ({ PlanScreen: () => null }));
jest.mock('../src/screens/InsightsScreens', () => ({ DashboardScreen: () => null }));

const open = () => render(<QueryClientProvider client={new QueryClient()}><RootNavigation /></QueryClientProvider>);
beforeEach(() => useAuth.setState({ status: 'signedIn', broker: { id: 'b', name: 'Sara Ali', role: 'broker', lang: 'en' } as ApiBroker }));

test('a tablet gets the side nav, not the bottom bar', async () => {
  mockWidth = 1194;
  await open();
  expect(await screen.findByTestId('side-nav')).toBeTruthy();
  expect(screen.getByTestId('side-profile')).toBeTruthy();
  expect(screen.queryByTestId('tab-bar')).toBeNull();
});

test('a phone keeps the bottom bar and has no side nav', async () => {
  mockWidth = 390;
  await open();
  expect(await screen.findByTestId('tab-bar')).toBeTruthy();
  expect(screen.queryByTestId('side-nav')).toBeNull();
});

test('the old Ask link opens the Search tab in Primary mode', () => {
  const { openPrimarySearch } = require('../src/searchLink');
  const navigate = jest.fn();
  openPrimarySearch({ navigate });
  expect(navigate).toHaveBeenCalledWith('Tabs', { screen: 'Search', params: expect.objectContaining({ mode: 'primary' }) });
});
