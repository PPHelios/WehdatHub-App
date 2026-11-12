import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CompareScreen, PlatformScreen, ProjectsScreen } from '../src/screens/MoreScreens';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { catalogue: jest.fn(), compare: jest.fn(), platform: jest.fn(), platformSignup: jest.fn(), platformAgency: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }), useRoute: () => ({ params: { id: 'p1', name: 'P' } }) }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = async (ui: React.ReactElement) => await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

test('projects list shows a project', async () => {
  m.catalogue.mockResolvedValue({ projects: { items: [{ id: 'p1', name: 'Mivida', district: 'New Cairo', city: '', units: 3 }], total: 1, pages: 1 }, developers: { items: [] }, canEdit: false });
  await wrap(<ProjectsScreen />);
  await waitFor(() => expect(screen.getByTestId('project-p1')).toBeTruthy());
});

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
