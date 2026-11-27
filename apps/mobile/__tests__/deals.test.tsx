import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommissionsScreen, DealsScreen, SourcesScreen } from '../src/screens/DealsScreens';
import { ReportsHubScreen } from '../src/screens/ReportsHubScreen';
import { api } from '../src/api';

const mockNavigate = jest.fn();
const mockDispatch = jest.fn();
let beforeRemoveCb: ((e: { preventDefault: () => void; data: { action: unknown } }) => void) | undefined;
let mockRouteParams: Record<string, unknown> = {};
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    dispatch: mockDispatch,
    addListener: (_ev: string, cb: typeof beforeRemoveCb) => {
      beforeRemoveCb = cb;
      return () => { beforeRemoveCb = undefined; };
    },
  }),
  useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('../src/api', () => ({ api: { me: jest.fn().mockResolvedValue({ rights: { manager: true, agencyOwner: true }, workspace: { tier: 'team', mode: 'team', members: 5, solo: false }, nav: null }), deals: jest.fn(), dealStatus: jest.fn(), commissions: jest.fn(), sources: jest.fn(), saveSpend: jest.fn(), dashboard: jest.fn().mockResolvedValue({ days: 30, weekly: [], sources: [], pipeline: {}, unassigned: 0, uncontacted: 0, overdue: 0, units: { active: 0, stale: 0 }, deals: { n: 0, commission: 0, value: 0 }, leads: 0, board: [] }), winLoss: jest.fn() } }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = async (ui: React.ReactElement) => await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = {};
  beforeRemoveCb = undefined;
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

test('sources protects unsaved spend on month switch, navigation exit, hub-tab switch, disables pending save, keeps failed draft, and scopes saved msg by month', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  let resolveSave!: () => void;
  let rejectSave!: (err: Error) => void;
  m.sources.mockResolvedValue({
    month: '2026-11',
    rows: [{ source: 'facebook', leads: 4, deals: 1, commission: 1000, spend: null, perLead: null, perDeal: null }],
    totals: {},
  });
  m.saveSpend
    .mockImplementationOnce(() => new Promise<void>((_res, rej) => { rejectSave = rej; }))
    .mockImplementationOnce(() => new Promise<void>((res) => { resolveSave = res; }));

  const view1 = await wrap(<SourcesScreen />);
  const input = await screen.findByDisplayValue('');
  await fireEvent.changeText(input, '3500');

  // 1. Warn before losing edits on month switch
  await fireEvent.press(screen.getByTestId('sources-prev-month'));
  expect(screen.getByTestId('sources-discard-sheet')).toBeTruthy();
  expect(m.sources).not.toHaveBeenCalledWith('2026-10', false);

  // 2. Warn on navigation beforeRemove
  const preventDefault = jest.fn();
  beforeRemoveCb?.({ preventDefault, data: { action: { type: 'GO_BACK' } } });
  expect(preventDefault).toHaveBeenCalled();
  expect(await screen.findByTestId('sources-discard-sheet')).toBeTruthy();

  // 3. Failed save keeps draft input intact
  await fireEvent.press(screen.getByTestId('sources-save'));
  await act(async () => {
    rejectSave(new Error('network_fail'));
    await Promise.resolve();
  });
  expect(screen.getByDisplayValue('3500')).toBeTruthy();

  // 4. Pending save disables Save button to block duplicate submits, and scopes confirmation to submittedMonth
  await fireEvent.press(screen.getByTestId('sources-save'));
  expect(screen.getByTestId('sources-save').props.accessibilityState?.disabled).toBe(true);
  await act(async () => {
    resolveSave();
    await Promise.resolve();
  });
  expect(await screen.findByTestId('sources-msg')).toBeTruthy();
  expect(screen.getByTestId('sources-msg').props.children).toContain('2026-11');
  view1.unmount();

  // 5. Hub-tab switch in ReportsHubScreen warns on dirty Sources tab
  alertSpy.mockClear();
  mockRouteParams = { initialTab: 'sources' };
  const client2 = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client2.setQueryData(['me'], {
    rights: { manager: true, agencyOwner: true },
    workspace: { tier: 'team', mode: 'team', members: 5, solo: false },
    nav: null,
  });
  await render(<QueryClientProvider client={client2}><ReportsHubScreen /></QueryClientProvider>);
  const hubInput = await screen.findByDisplayValue('');
  await fireEvent.changeText(hubInput, '900');
  await fireEvent.press(screen.getByTestId('hub-tab-dashboard'));
  expect(alertSpy).toHaveBeenCalledTimes(1);
});
