import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Rights } from '@wehdathub/shared';
import { WelcomeScreen, useWelcomeState, welcomeKey, welcomeTarget } from '../src/screens/WelcomeScreen';
import { useAuth } from '../src/auth';
import { api } from '../src/api';
import { track } from '../src/analytics';
import { meOptions } from '../src/queries';

const mockReset = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ reset: mockReset }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/api', () => ({ api: { units: jest.fn() } }));
jest.mock('../src/analytics', () => ({ track: jest.fn() }));
const units = api.units as unknown as jest.Mock;

const base: Rights = { addUnits: true, editUnits: true, leads: true, search: true, team: false, owners: false, manager: false, agencyOwner: false, dataEntry: false, teamLead: false };
const open = (rights: Partial<Rights>, solo = false) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(meOptions().queryKey, { rights: { ...base, ...rights }, workspace: { solo } } as never);
  return render(<QueryClientProvider client={qc}><WelcomeScreen /></QueryClientProvider>);
};
const skip = async () => { await fireEvent.press(screen.getByTestId('welcome-skip')); };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useAuth.setState({ broker: { id: 'b1', name: 'N', role: 'broker', lang: 'en' } as never });
});

test('three slides: Next moves along and the last button says Start', async () => {
  await open({});
  expect(screen.getByText('Ask by voice or text')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('welcome-next'));
  expect(screen.getByText('See what matters today')).toBeTruthy();
  expect(screen.getByTestId('welcome-row-2')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('welcome-next'));
  expect(screen.getByText('Send a unit to a client')).toBeTruthy();
  expect(screen.getByTestId('welcome-sent')).toBeTruthy();
  expect(screen.getByText('Let’s start')).toBeTruthy();
});

test('it is shown once: the flag is stored on finish, and read back as done', async () => {
  const state = () => renderHook(() => useWelcomeState('b1'));
  const first = await state();
  await waitFor(() => expect(first.result.current).toBe('show'));
  await open({});
  await skip();
  await waitFor(() => expect(mockReset).toHaveBeenCalled());
  expect(await AsyncStorage.getItem(welcomeKey('b1'))).toBe('1');
  const again = await state();
  await waitFor(() => expect(again.result.current).toBe('done'));
});

test('skip and finish fire welcome_completed with the skipped flag', async () => {
  await open({});
  await skip();
  await waitFor(() => expect(track).toHaveBeenCalledWith('welcome_completed', { skipped: 1 }));
});

test('brokers land on the tabs (Search, where practice is offered)', async () => {
  await open({});
  await skip();
  await waitFor(() => expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Tabs' }] }));
  expect(units).not.toHaveBeenCalled();
});

test('an owner with no units goes to Add unit; with units, to Home', async () => {
  units.mockResolvedValueOnce({ total: 0 });
  await open({ agencyOwner: true });
  await skip();
  await waitFor(() => expect(mockReset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'Tabs' }, { name: 'AddUnit' }] }));
  expect(welcomeTarget({ ...base, manager: true }, false, 3)).toBe('Tabs');
  expect(welcomeTarget(base, true, 0)).toBe('AddUnit');
  expect(welcomeTarget({ ...base, teamLead: true }, false, 0)).toBe('Tabs');
});

test('data entry goes to Add unit', async () => {
  await open({ dataEntry: true });
  await skip();
  await waitFor(() => expect(mockReset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'Tabs' }, { name: 'AddUnit' }] }));
});

test('a second tap while finishing does nothing more', async () => {
  await open({});
  await act(async () => { await fireEvent.press(screen.getByTestId('welcome-skip')); await fireEvent.press(screen.getByTestId('welcome-skip')); });
  await waitFor(() => expect(mockReset).toHaveBeenCalledTimes(1));
});
