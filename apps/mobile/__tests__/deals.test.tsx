import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommissionsScreen, DealsScreen, SourcesScreen } from '../src/screens/DealsScreens';
import { api } from '../src/api';

const mockNavigate = jest.fn();
let mockRouteParams: Record<string, unknown> = {};
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }), useRoute: () => ({ params: mockRouteParams }) }));
jest.mock('../src/api', () => ({ api: { deals: jest.fn(), dealStatus: jest.fn(), commissions: jest.fn(), sources: jest.fn(), saveSpend: jest.fn() } }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = async (ui: React.ReactElement) => await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = {};
});

test('deals list shows a deal', async () => {
  m.deals.mockResolvedValue({ items: [{ ref: 7, status: 'signed', client_name: 'Omar', unit_code: 'A-1', price: 5000000, version: 1 }], more: false, totals: [], statuses: ['signed', 'cancelled'] });
  await wrap(<DealsScreen />);
  await waitFor(() => expect(screen.getByTestId('deal-7')).toBeTruthy());
});

test('a rent deal offers the lease, prefilled from the deal', async () => {
  m.deals.mockResolvedValue({ items: [{ ref: 8, status: 'signed', client_name: 'Omar', unit_code: 'R-1', deal_type: 'rent', lead_ref: 42, price: 20000, closed_at: '2026-11-10T10:00:00Z', version: 1 }], more: false, totals: [], statuses: ['signed'] });
  await wrap(<DealsScreen />);
  await waitFor(() => expect(screen.getByTestId('add-lease-8')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('add-lease-8'));
  expect(mockNavigate).toHaveBeenCalledWith('Unit', { code: 'R-1', lease: { tenantName: 'L-0042', startDate: '2026-11-10', rent: '20000' } });
});

test('sources show a row per source, month switcher, signed toggle, cohort note, and silent ad-burn alerts', async () => {
  m.sources.mockResolvedValue({
    month: '2026-11',
    rows: [
      { source: 'facebook', leads: 4, deals: 1, commission: 1000, spend: null, perLead: null, perDeal: null },
      { source: 'tiktok', leads: 0, deals: 0, commission: 0, spend: 5000, perLead: null, perDeal: null, adBurn: true },
    ],
    totals: {},
  });
  await wrap(<SourcesScreen />);
  await waitFor(() => expect(screen.getByTestId('source-facebook')).toBeTruthy());
  expect(screen.getByTestId('sources-cohort-note')).toBeTruthy();
  expect(screen.getByTestId('source-burn-tiktok')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('sources-prev-month'));
  await waitFor(() => expect(m.sources).toHaveBeenCalledWith('2026-10', false));
  await fireEvent.press(await screen.findByText(/Signed \/ paid only|الموقّعة/));
  await waitFor(() => expect(m.sources).toHaveBeenLastCalledWith('2026-10', true));
});

test('commissions show Claimable vs Overdue split and drill into developer', async () => {
  m.commissions.mockResolvedValue({
    kind: 'developers',
    period: 'All',
    items: [{ id: 'c1', unit_code: 'M-1', developer_name: 'Emaar', status: 'claimable', expected_amount: 50000 }],
    total: 1,
    totals: { count: 1, claimable: 50000, claimableCount: 1, overdue: 1, overdueAmount: 20000 },
    byDeveloper: [{ developerId: 'dev-1', developerName: 'Emaar', claimable: 50000, claimableCount: 1, claimed: 20000, paid: 0, outstanding: 70000, overdueCount: 1, overdueAmount: 20000 }],
    statuses: ['expected', 'claimable', 'claimed', 'partly_paid', 'paid'],
  });
  await wrap(<CommissionsScreen />);
  await fireEvent.press(await screen.findByText(/Developers|مطورين/));
  expect(await screen.findByTestId('comm-split-summary')).toBeTruthy();
  expect(screen.getByTestId('comm-claimable')).toBeTruthy();
  expect(screen.getByTestId('comm-overdue')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('comm-dev-dev-1'));
  await waitFor(() => expect(m.commissions).toHaveBeenCalledWith('developers', undefined, 0, { developer: 'dev-1', overdue: false, period: 'all' }));
});

test('deals paginates >20 items on scroll and resets to page 0 when status filter changes', async () => {
  const mkDeal = (ref: number) => ({ ref, status: 'signed', client_name: `Client ${ref}`, unit_code: `U-${ref}`, price: 3_000_000, version: 1 });
  m.deals
    .mockResolvedValueOnce({ items: Array.from({ length: 20 }, (_, i) => mkDeal(i + 1)), more: true, totals: [], statuses: ['signed', 'paid'] })
    .mockResolvedValueOnce({ items: [mkDeal(21)], more: false, totals: [], statuses: ['signed', 'paid'] })
    .mockResolvedValueOnce({ items: [mkDeal(99)], more: false, totals: [], statuses: ['signed', 'paid'] });

  await wrap(<DealsScreen />);
  await waitFor(() => expect(screen.getByTestId('deal-1')).toBeTruthy());
  expect(m.deals).toHaveBeenCalledWith(undefined, 0);

  await fireEvent(screen.getByTestId('deals-list'), 'endReached');
  await waitFor(() => expect(m.deals).toHaveBeenCalledWith(undefined, 1));
  expect(await screen.findByTestId('deal-21')).toBeTruthy();

  await fireEvent.press(screen.getAllByText(/اتوقّع|signed/)[0]);
  await waitFor(() => expect(m.deals).toHaveBeenCalledWith('signed', 0));
});

test('commissions paginates >20 developer items while preserving developer + overdue filters and resets on filter change', async () => {
  const mkComm = (idx: number) => ({ id: `c-${idx}`, unit_code: `P-${idx}`, developer_name: 'Emaar', status: 'claimable', expected_amount: 10_000 });
  m.commissions.mockImplementation(async (kind: string, _status?: string, page = 0, opts?: { developer?: string; overdue?: boolean }) => {
    if (kind === 'resale') {
      return { kind: 'resale', period: 'All', items: [], total: 0, totals: null, statuses: [] };
    }
    if (opts?.developer === 'dev-1' && opts?.overdue) {
      return {
        kind: 'developers',
        period: 'All',
        items: page === 0 ? Array.from({ length: 20 }, (_, i) => mkComm(i + 1)) : [mkComm(21), mkComm(22)],
        total: 22,
        totals: { count: 22, claimable: 220_000, claimableCount: 22, overdue: 22, overdueAmount: 220_000 },
        byDeveloper: [],
        statuses: ['claimable'],
      };
    }
    return {
      kind: 'developers',
      period: 'All',
      items: [mkComm(1)],
      total: 1,
      totals: { count: 1, claimable: 10_000, claimableCount: 1, overdue: 1, overdueAmount: 10_000 },
      byDeveloper: [{ developerId: 'dev-1', developerName: 'Emaar', claimable: 10_000, claimableCount: 1, claimed: 0, paid: 0, outstanding: 10_000, overdueCount: 1, overdueAmount: 10_000 }],
      statuses: ['claimable'],
    };
  });

  await wrap(<CommissionsScreen />);
  await fireEvent.press(await screen.findByText(/Developers|مطورين/));
  await waitFor(() => expect(screen.getByTestId('comm-dev-dev-1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('comm-dev-dev-1'));
  await fireEvent.press(await screen.findByText(/^(Overdue|متأخر)$/));
  await waitFor(() => expect(m.commissions).toHaveBeenCalledWith('developers', undefined, 0, { developer: 'dev-1', overdue: true, period: 'all' }));

  await fireEvent(await screen.findByTestId('commissions-list'), 'endReached');
  await waitFor(() => expect(m.commissions).toHaveBeenCalledWith('developers', undefined, 1, { developer: 'dev-1', overdue: true, period: 'all' }));
  expect(await screen.findByTestId('comm-c-22')).toBeTruthy();

  await fireEvent.press(screen.getByText(/Resale|ريسيل/));
  await waitFor(() => expect(m.commissions).toHaveBeenCalledWith('resale', undefined, 0));
});

test('deals applies drill-through route filters, renders summary banner, and lets user dismiss filters', async () => {
  mockRouteParams = {
    from: '2026-11-01T00:00:00.000Z',
    to: '2026-11-16T00:00:00.000Z',
    brokerId: 'b1',
    brokerRole: 'closer',
    market: 'resale',
    area: 'fifth-settlement',
  };
  m.deals.mockResolvedValue({
    items: [{ ref: 9, status: 'signed', client_name: 'Karim', unit_code: 'FS-9', price: 6000000, version: 1 }],
    more: false,
    totals: [],
    statuses: ['signed'],
    dealSummary: {
      deals: 1,
      volume: 6000000,
      commissionTotal: 90000,
      brokerShareTotal: 45000,
      commissionBasis: 'deal_commission',
      brokerRole: 'closer',
      unknownMarketCount: 2,
      unknownAreaCount: 1,
    },
  });

  await wrap(<DealsScreen />);
  await waitFor(() => expect(m.deals).toHaveBeenCalledWith(undefined, 0, {
    from: '2026-11-01T00:00:00.000Z',
    to: '2026-11-16T00:00:00.000Z',
    brokerId: 'b1',
    brokerRole: 'closer',
    market: 'resale',
    area: 'fifth-settlement',
    summary: true,
  }));
  expect(await screen.findByTestId('deals-summary-banner')).toBeTruthy();
  expect(screen.getByTestId('deals-filter-market')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('deals-filter-market'));
  await waitFor(() => expect(m.deals).toHaveBeenLastCalledWith(undefined, 0, expect.objectContaining({
    from: '2026-11-01T00:00:00.000Z',
    brokerRole: 'closer',
  })));
  expect(m.deals.mock.calls.at(-1)?.[2]?.market).toBeUndefined();
});
