import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MoreScreen } from '../src/screens/MoreScreen';
import { api } from '../src/api';
import { useAuth } from '../src/auth';

jest.mock('../src/api', () => ({ api: { me: jest.fn(), appSettings: jest.fn(), setLang: jest.fn(), logout: jest.fn() } }));
jest.mock('../src/components/AppSettings', () => ({ AppSettings: () => null }));
const rights = { current: { manager: false, agencyOwner: false, team: false } as Record<string, boolean> };
jest.mock('../src/rights', () => ({ useRights: () => rights.current }));
jest.mock('../src/lock', () => ({ lockAvailable: async () => false, useLock: () => ({ enabled: false, enable: async () => true, disable: async () => undefined }) }));
jest.mock('../src/push', () => ({ stopPush: async () => undefined }));
const m = api as unknown as { me: jest.Mock };

const show = async (r: Record<string, boolean>, onOpen = jest.fn()) => {
  rights.current = r;
  useAuth.setState({ broker: { id: 'b', name: 'Sara', role: 'broker', lang: 'en' } as never, agencyName: 'NCH' } as never);
  m.me.mockResolvedValue({ broker: {}, agency: {}, rights: r, testSwitch: null });
  await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MoreScreen mode="settings" onOpen={onOpen} /></QueryClientProvider>);
  return onOpen;
};

test('a broker sees Me only: the theme and language settings and the notifications link, no agency or plan', async () => {
  const open = await show({ manager: false, agencyOwner: false, team: false });
  expect(screen.getByTestId('settings-me')).toBeTruthy();
  expect(screen.getByTestId('app-settings')).toBeTruthy();
  expect(screen.queryByTestId('settings-agency')).toBeNull();
  expect(screen.queryByTestId('settings-plan')).toBeNull();
  await fireEvent.press(screen.getByTestId('settings-open-notifications'));
  expect(open).toHaveBeenCalledWith('Notifications');
});

test('a manager also sees Agency (AI use and the team), not Plan and billing', async () => {
  const open = await show({ manager: true, agencyOwner: false, team: true });
  expect(screen.getByTestId('settings-agency')).toBeTruthy();
  expect(screen.queryByTestId('settings-plan')).toBeNull();
  await fireEvent.press(screen.getByTestId('settings-open-usage'));
  expect(open).toHaveBeenCalledWith('Usage');
  await fireEvent.press(screen.getByTestId('settings-open-team'));
  expect(open).toHaveBeenCalledWith('Team');
});

test('the agency owner sees all three sections and opens the plan', async () => {
  const open = await show({ manager: true, agencyOwner: true, team: true });
  expect(screen.getByTestId('settings-me')).toBeTruthy();
  expect(screen.getByTestId('settings-agency')).toBeTruthy();
  expect(screen.getByTestId('settings-plan')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('settings-open-plan'));
  expect(open).toHaveBeenCalledWith('Plan');
});

test('the menu mode has no section headings and no agency or plan cards', async () => {
  rights.current = { manager: true, agencyOwner: true, team: true };
  useAuth.setState({ broker: { id: 'b', name: 'Sara', role: 'owner', lang: 'en' } as never } as never);
  m.me.mockResolvedValue({ broker: {}, agency: {}, rights: rights.current, testSwitch: null });
  await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MoreScreen onOpen={jest.fn()} /></QueryClientProvider>);
  expect(screen.queryByTestId('settings-me')).toBeNull();
  expect(screen.queryByTestId('settings-agency')).toBeNull();
  expect(screen.queryByTestId('settings-plan')).toBeNull();
});
