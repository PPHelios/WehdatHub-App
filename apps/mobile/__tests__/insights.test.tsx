import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardScreen, PricesScreen, ReportScreen, WinLossScreen } from '../src/screens/InsightsScreens';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { dashboard: jest.fn(), pricePerM2: jest.fn(), winLoss: jest.fn(), report: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = async (ui: React.ReactElement) => await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => jest.clearAllMocks());

test('the dashboard shows the leaderboard', async () => {
  m.dashboard.mockResolvedValue({ days: 30, weekly: [], sources: [], pipeline: { new: 2 }, unassigned: 1, uncontacted: 0, overdue: 0, units: { active: 5, stale: 1 }, deals: { n: 1, commission: 100, value: 5000000 }, leads: 3, board: [{ id: 'b1', name: 'Sara', leads: 3, contacted: 2, forward: 1, deals: 1, commission: 100 }] });
  wrap(<DashboardScreen />);
  await waitFor(() => expect(screen.getByTestId('board-b1')).toBeTruthy());
});

test('prices show sale rows with the median', async () => {
  m.pricePerM2.mockResolvedValue({ minUnits: 5, items: [{ place: 'Mivida', listing_type: 'sale', units: 6, median: 60000, low: 50000, high: 70000 }] });
  wrap(<PricesScreen />);
  await waitFor(() => expect(screen.getByTestId('price-sale-Mivida')).toBeTruthy());
});

test('win and loss shows the summary', async () => {
  m.winLoss.mockResolvedValue({ days: 30, won: 3, lost: 1, rate: 75, reasons: [], brokers: [], sources: [] });
  wrap(<WinLossScreen />);
  await waitFor(() => expect(screen.getByTestId('wl-summary')).toBeTruthy());
});

test('a report is sent', async () => {
  m.report.mockResolvedValue({ ok: true, id: 9 });
  await wrap(<ReportScreen />);
  await fireEvent.changeText(screen.getByTestId('report-text'), 'it broke');
  await fireEvent.press(screen.getByTestId('report-send'));
  await waitFor(() => expect(m.report).toHaveBeenCalledWith('it broke'));
});
