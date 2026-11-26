import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardScreen, PricesScreen, ReportScreen, WinLossScreen } from '../src/screens/InsightsScreens';
import { api } from '../src/api';

const mockNavigate = jest.fn();
jest.mock('../src/api', () => ({ api: { dashboard: jest.fn(), pricePerM2: jest.fn(), winLoss: jest.fn(), report: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }) }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = async (ui: React.ReactElement) => await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => jest.clearAllMocks());

test('the dashboard shows the leaderboard with response time and open workload', async () => {
  m.dashboard.mockResolvedValue({
    days: 30,
    weekly: [2, 4, 1],
    sources: [],
    pipeline: { new: 2 },
    unassigned: 1,
    uncontacted: 0,
    overdue: 0,
    units: { active: 5, stale: 1 },
    deals: { n: 1, commission: 100, value: 5000000 },
    leads: 3,
    team: [{ id: 'b1', name: 'Sara' }],
    teamLeads: [{ id: 't1', name: 'Omar' }],
    board: [{ id: 'b1', name: 'Sara', leads: 3, contacted: 2, forward: 1, deals: 1, commission: 100, open: 4, responseMin: 18 }],
  });
  wrap(<DashboardScreen />);
  await waitFor(() => expect(screen.getByTestId('board-b1')).toBeTruthy());
  expect(screen.getByTestId('dash-scope')).toBeTruthy();
  expect(screen.getByTestId('dash-weekly')).toBeTruthy();
  expect(screen.getByText(/4 open|4 مفتوح/)).toBeTruthy();
  expect(screen.getByText(/18 min|18 د/)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('dash-scope'));
  await fireEvent.press(await screen.findByTestId('dash-scope-opt-broker:b1'));
  await waitFor(() => expect(m.dashboard).toHaveBeenCalledWith(30, { broker: 'b1' }));
  await screen.findByTestId('dash-scope');
  await fireEvent.press(screen.getByTestId('dash-scope'));
  await fireEvent.press(await screen.findByTestId('dash-scope-opt-team:t1'));
  await waitFor(() => expect(m.dashboard).toHaveBeenCalledWith(30, { team: 't1' }));
});

test('formats response times across hours/days and handles empty board', async () => {
  m.dashboard.mockResolvedValue({
    days: 30,
    weekly: [],
    sources: [],
    pipeline: { new: 0 },
    unassigned: 0,
    uncontacted: 0,
    overdue: 0,
    units: { active: 0, stale: 0 },
    deals: { n: 0, commission: 0, value: 0 },
    leads: 0,
    board: [
      { id: 'b1', name: 'Hana', leads: 1, contacted: 1, forward: 0, deals: 0, commission: 0, open: 1, responseMin: 120 },
      { id: 'b2', name: 'Tarek', leads: 1, contacted: 1, forward: 0, deals: 0, commission: 0, open: 1, responseMin: 4320 },
      { id: 'b3', name: 'Nour', leads: 1, contacted: 0, forward: 0, deals: 0, commission: 0, open: 1, responseMin: null },
    ],
  });
  wrap(<DashboardScreen />);
  await waitFor(() => expect(screen.getByTestId('board-b1')).toBeTruthy());
  expect(screen.getByText(/2 h|2 س/)).toBeTruthy();
  expect(screen.getByText(/3 d|3 يوم/)).toBeTruthy();

  m.dashboard.mockResolvedValueOnce({
    days: 30,
    weekly: [],
    sources: [],
    pipeline: { new: 0 },
    unassigned: 0,
    uncontacted: 0,
    overdue: 0,
    units: { active: 0, stale: 0 },
    deals: { n: 0, commission: 0, value: 0 },
    leads: 0,
    board: [],
  });
  wrap(<DashboardScreen />);
  await waitFor(() => expect(screen.getByText(/No activity in this period|مفيش نشاط في الفترة دي/)).toBeTruthy());
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
  await waitFor(() => expect(m.report).toHaveBeenCalledWith('it broke', expect.objectContaining({ type: 'bug' })));
});

test('shows waitingOver1h KPI, disciplineSummary, updates sort chip, and handles legacy board fields', async () => {
  const dashPayload = {
    days: 30,
    weekly: [3, 5],
    sources: [],
    pipeline: { new: 2 },
    unassigned: 1,
    waitingOver1h: 2,
    uncontacted: 1,
    overdue: 1,
    units: { active: 4, stale: 0 },
    deals: { n: 2, commission: 200, value: 8000000 },
    leads: 4,
    disciplineSummary: { consistent: 1, lagging: 1, silent: 1, totalNoNextStep: 3, totalMissed: 2 },
    board: [
      { id: 'b1', name: 'Consistent Broker', active: true, telegramLinked: true, leads: 3, contacted: 3, forward: 2, deals: 1, commission: 100, open: 1, updates: 12, updates48h: 3, noNextStep: 0, missed: 0, discipline: 'consistent', responseMin: 10 },
      { id: 'b2', name: 'Silent Broker', active: true, telegramLinked: false, leads: 3, contacted: 0, forward: 0, deals: 0, commission: 0, open: 4, updates: 0, updates48h: 0, noNextStep: 3, missed: 2, discipline: 'silent', responseMin: null },
      { id: 'b3', name: 'Legacy Broker', leads: 1, contacted: 1, forward: 0, deals: 0, commission: 0 },
    ],
  };
  m.dashboard.mockResolvedValueOnce(dashPayload);
  await wrap(<DashboardScreen />);
  await waitFor(() => expect(screen.getByTestId('board-b1')).toBeTruthy());
  expect(screen.getByTestId('kpi-waiting-over-1h')).toBeTruthy();
  expect(screen.getByTestId('dash-discipline-summary')).toBeTruthy();
  expect(screen.getByTestId('discipline-badge-b2')).toBeTruthy();
  expect(screen.getByTestId('board-b3')).toBeTruthy();
  expect(screen.getByText(/Telegram off|تليجرام مش مربوط/)).toBeTruthy();

  m.dashboard.mockResolvedValueOnce(dashPayload);
  await wrap(<DashboardScreen ranking />);
  await waitFor(() => expect(screen.getByText(/Fewest updates|الأقل تحديثاً/)).toBeTruthy());
  await fireEvent.press(screen.getByText(/Fewest updates|الأقل تحديثاً/));
  expect(screen.getByText('Silent Broker')).toBeTruthy();
  expect(screen.queryByText('Legacy Broker')).toBeNull();
});

test('dashboard KPIs drill into preserved broker/team queues, agency-wide unassigned under scope, and render weeklyRanges', async () => {
  m.dashboard.mockResolvedValue({
    days: 30,
    weekly: [2, 4],
    weeklyRanges: [
      { from: '2026-11-02', to: '2026-11-09', label: '11/02–11/09' },
      { from: '2026-11-09', to: '2026-11-16', label: '11/09–11/16' },
    ],
    sources: [],
    pipeline: { new: 2 },
    unassigned: 3,
    unassignedScope: 'agency',
    waitingOver1h: 2,
    uncontacted: 4,
    overdue: 1,
    units: { active: 5, stale: 0 },
    deals: { n: 1, commission: 100, value: 5000000 },
    leads: 6,
    team: [{ id: 'b1', name: 'Sara' }],
    teamLeads: [{ id: 't1', name: 'Omar' }],
    board: [{ id: 'b1', name: 'Sara', leads: 3, contacted: 2, forward: 1, deals: 1, commission: 100, open: 4, updates: 5 }],
  });

  await wrap(<DashboardScreen />);
  await waitFor(() => expect(screen.getByTestId('dash-weekly')).toBeTruthy());
  expect(screen.getByText('11/02–11/09')).toBeTruthy();
  expect(screen.queryByText('Week 1')).toBeNull();

  await fireEvent.press(screen.getByTestId('dash-scope'));
  await fireEvent.press(await screen.findByTestId('dash-scope-opt-broker:b1'));
  await waitFor(() => expect(m.dashboard).toHaveBeenCalledWith(30, { broker: 'b1' }));

  // Scoped Unassigned labels Agency-wide and opens agency-wide queue without broker filter
  expect(await screen.findByText(/Agency-wide|على مستوى الشركة/)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('kpi-unassigned'));
  expect(mockNavigate).toHaveBeenLastCalledWith('LeadsList', { queue: 'unassigned' });

  await fireEvent.press(screen.getByTestId('kpi-waiting-over-1h'));
  expect(mockNavigate).toHaveBeenLastCalledWith('LeadsList', { queue: 'waiting-over-1h', broker: 'b1' });

  await fireEvent.press(screen.getByTestId('kpi-uncontacted'));
  expect(mockNavigate).toHaveBeenLastCalledWith('LeadsList', { queue: 'uncontacted', broker: 'b1' });

  await fireEvent.press(screen.getByTestId('kpi-overdue'));
  expect(mockNavigate).toHaveBeenLastCalledWith('LeadsList', { tab: 'overdue', broker: 'b1' });

  await fireEvent.press(screen.getByTestId('dash-scope'));
  await fireEvent.press(await screen.findByTestId('dash-scope-opt-team:t1'));
  await waitFor(() => expect(m.dashboard).toHaveBeenCalledWith(30, { team: 't1' }));
  await fireEvent.press(await screen.findByTestId('kpi-waiting-over-1h'));
  expect(mockNavigate).toHaveBeenLastCalledWith('LeadsList', { queue: 'waiting-over-1h', team: 't1' });
});
