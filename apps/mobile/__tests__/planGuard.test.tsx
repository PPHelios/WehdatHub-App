import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClientError, PlanLockedError } from '@wehdathub/shared';
import type { PlanAllowance } from '@wehdathub/shared';
import { UsageScreen } from '../src/screens/MoreScreens';
import { PlanBanner } from '../src/components/PlanBanner';
import { PlanLockSheet } from '../src/components/PlanLockSheet';
import { PlanBlockedGate } from '../src/components/PlanBlockedGate';
import { api } from '../src/api';
import { useAuth } from '../src/auth';
import { usePlanLock } from '../src/planLock';
import { bannerText, planPhase, priceRows, unitWarnPct } from '../src/planState';
import { errorText } from '../src/errors';

jest.mock('../src/api', () => ({ api: { usage: jest.fn(), me: jest.fn(), plan: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }) }));
const m = api as unknown as Record<string, jest.Mock>;

const NOW = new Date('2026-06-10T12:00:00Z');
const plan = { id: 'solo', name: ['سولو', 'Solo'] as [string, string], priceEgp: 199, seats: 1, units: 1000, credits: 400, prices: { 1: 199, 6: 1075, 12: 1990 } };
const allowance = (over: Partial<PlanAllowance> = {}): PlanAllowance => ({
  plan, source: 'paid', until: null, ladder: null, extraSeats: 0,
  credits: { used: 10, limit: 400, plan: 400, bundles: 0, grants: 0 }, seats: { used: 1, limit: 1 }, units: { used: 10, limit: 1000 }, ...over,
});
const ladder = { kind: 'short' as const, end: '2026-06-08T00:00:00Z', readonlyStarts: '2026-06-11T00:00:00Z', blockedStarts: '2026-06-18T00:00:00Z' };
const grace = allowance({ source: 'grace', ladder });
const readonly = allowance({ source: 'readonly', ladder });
const blocked = allowance({ source: 'blocked', ladder });

const rights = (manager: boolean) => ({ rights: { manager, agencyOwner: manager, team: manager, owners: false, addUnits: true, editUnits: true, leads: true, search: true, dataEntry: false, teamLead: false } });
const wrap = async (ui: React.ReactElement) => await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const asMember = (manager: boolean, lang: 'ar' | 'en' = 'en') => {
  useAuth.setState({ status: 'signedIn', token: 't', broker: { id: 1, lang } as never, agencyName: 'A' });
  m.me.mockResolvedValue(rights(manager));
};
beforeEach(() => { jest.clearAllMocks(); usePlanLock.getState().clear(); });
afterEach(() => useAuth.setState({ status: 'signedOut', token: null, broker: null, agencyName: null }));

describe('plan state rules', () => {
  test('phase and days left along the ladder', () => {
    expect(planPhase(grace, NOW)).toEqual({ phase: 'grace', daysLeft: 1 });
    expect(planPhase(readonly, NOW)).toEqual({ phase: 'readonly', daysLeft: 8 });
    expect(planPhase(blocked, NOW)).toEqual({ phase: 'blocked', daysLeft: null });
    expect(planPhase(allowance({ source: 'trial' }), NOW).phase).toBe('none');
    expect(planPhase(allowance(), NOW).phase).toBe('none');
    expect(planPhase(null).phase).toBe('none');
  });
  test('banner text is bilingual and a broker is only told to ask the manager', () => {
    expect(bannerText('ar', 'grace', 3, true)).toContain('فترة سماح');
    expect(bannerText('en', 'grace', 3, true)).toContain('3 days left');
    expect(bannerText('en', 'readonly', 7, true)).toContain('read-only');
    expect(bannerText('en', 'blocked', null, true)).toContain('stopped');
    expect(bannerText('en', 'readonly', 7, false)).toContain('Ask your manager');
    expect(bannerText('ar', 'readonly', 7, false)).toContain('اطلب من مديرك');
    expect(bannerText('en', 'readonly', 7, true)).not.toContain('Ask your manager');
    expect(bannerText('en', 'none', null, true)).toBeNull();
  });
  test('unit warning from 85 percent, never for unlimited', () => {
    expect(unitWarnPct({ used: 84, limit: 100 })).toBeNull();
    expect(unitWarnPct({ used: 85, limit: 100 })).toBe(85);
    expect(unitWarnPct({ used: 100, limit: 100 })).toBe(100);
    expect(unitWarnPct({ used: 900000, limit: 1000000 })).toBeNull();
  });
  test('price rows per period with the per-month equivalent; Agency has no monthly row', () => {
    expect(priceRows(plan)).toEqual([{ months: 1, price: 199, perMonth: null }, { months: 6, price: 1075, perMonth: 179 }, { months: 12, price: 1990, perMonth: 166 }]);
    expect(priceRows({ prices: { 6: 16146, 12: 29900 } }).map((r) => r.months)).toEqual([6, 12]);
    expect(priceRows({ prices: {} })).toEqual([]);
  });
});

describe('the 402 handler', () => {
  test('errorText never shows the voice error or a raw code for a plan lock', () => {
    const e = new PlanLockedError('plan_readonly', { message: 'x' });
    expect(errorText(e, 'en')).toMatch(/Adding, editing/);
    expect(errorText(new PlanLockedError('plan_blocked'), 'ar')).toContain('متوقف');
    expect(errorText(new ApiClientError(422, 'downgrade'), 'en')).toContain('downgrade');
    expect(errorText(new ApiClientError(422, 'period_switch'), 'ar')).toContain('المدة');
  });
  test('a manager gets the sheet with a link to the Plan page', async () => {
    asMember(true);
    const open = jest.fn();
    await wrap(<PlanLockSheet onOpenPlan={open} />);
    expect(screen.queryByTestId('plan-lock-sheet')).toBeNull();
    await act(async () => usePlanLock.getState().show(new PlanLockedError('plan_readonly', { message: 'raw server text /app/usage#plan' })));
    await waitFor(() => expect(screen.getByTestId('plan-lock-open')).toBeTruthy());
    expect(screen.queryByText(/raw server text/)).toBeNull();
    await fireEvent.press(screen.getByTestId('plan-lock-open'));
    expect(open).toHaveBeenCalled();
    expect(usePlanLock.getState().error).toBeNull();
  });
  test('a broker is told to ask the manager and sees no link or price', async () => {
    asMember(false);
    await wrap(<PlanLockSheet onOpenPlan={jest.fn()} />);
    await act(async () => usePlanLock.getState().show(new PlanLockedError('plan_readonly')));
    await waitFor(() => expect(screen.getByTestId('plan-lock-ask')).toBeTruthy());
    expect(screen.queryByTestId('plan-lock-open')).toBeNull();
    expect(screen.queryByText(/EGP|جنيه/)).toBeNull();
  });
});

describe('the banner', () => {
  test.each([['grace', grace], ['readonly', readonly], ['blocked', blocked]] as const)('shows the %s state', async (phase, a) => {
    asMember(true);
    m.usage.mockResolvedValue({ allowance: a });
    await wrap(<PlanBanner onOpenPlan={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId(`plan-banner-${phase}`)).toBeTruthy());
  });
  test('nothing while the plan is current or on trial', async () => {
    asMember(true);
    m.usage.mockResolvedValue({ allowance: allowance({ source: 'trial' }) });
    await wrap(<PlanBanner />);
    await waitFor(() => expect(m.usage).toHaveBeenCalled());
    expect(screen.queryByTestId(/plan-banner/)).toBeNull();
  });
  test('a manager can open the Plan page from it', async () => {
    asMember(true);
    m.usage.mockResolvedValue({ allowance: readonly });
    const open = jest.fn();
    await wrap(<PlanBanner onOpenPlan={open} />);
    await waitFor(() => expect(screen.getByTestId('plan-banner-readonly')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('plan-banner-readonly'));
    expect(open).toHaveBeenCalled();
  });
  test('a broker cannot open it and is told to ask the manager', async () => {
    asMember(false);
    m.usage.mockResolvedValue({ allowance: readonly });
    const open2 = jest.fn();
    await wrap(<PlanBanner onOpenPlan={open2} />);
    await waitFor(() => expect(screen.getByText(/Ask your manager/)).toBeTruthy());
    await fireEvent.press(screen.getByTestId('plan-banner-readonly'));
    expect(open2).not.toHaveBeenCalled();
  });
  test('Arabic first for an Arabic broker', async () => {
    asMember(true, 'ar');
    m.usage.mockResolvedValue({ allowance: grace });
    await wrap(<PlanBanner />);
    await waitFor(() => expect(screen.getByText(/فترة سماح/)).toBeTruthy());
  });
});

describe('blocked account', () => {
  test('a manager reaches the Plan page only', async () => {
    asMember(true);
    m.usage.mockResolvedValue({ allowance: blocked });
    m.plan.mockResolvedValue({ allowance: blocked, payTo: { instapay: '', bank: '' }, limits: {}, payments: [], requests: [], referral: null, canPay: true });
    await wrap(<PlanBlockedGate />);
    await waitFor(() => expect(screen.getByTestId('plan-allowance')).toBeTruthy());
  });
  test('a broker sees ask-your-manager with no prices', async () => {
    asMember(false);
    m.usage.mockResolvedValue({ allowance: blocked });
    await wrap(<PlanBlockedGate />);
    await waitFor(() => expect(screen.getByTestId('plan-blocked-ask')).toBeTruthy());
    expect(screen.queryByTestId('plan-prices')).toBeNull();
    expect(m.plan).not.toHaveBeenCalled(); // the plan call is manager only
  });
  test('nothing covers the app while the account is only read-only', async () => {
    asMember(true);
    m.usage.mockResolvedValue({ allowance: readonly });
    await wrap(<PlanBlockedGate />);
    await waitFor(() => expect(m.usage).toHaveBeenCalled());
    expect(screen.queryByTestId('plan-blocked-gate')).toBeNull();
  });
});

describe('plan and usage screen', () => {
  const planReply = (a: PlanAllowance) => ({ allowance: a, payTo: { instapay: '', bank: '' }, limits: {}, payments: [], requests: [], referral: null, canPay: true });
  test('a manager sees per-period prices with the per-month equivalent, no VAT and the payment note', async () => {
    asMember(true);
    m.usage.mockResolvedValue({ allowance: allowance() });
    m.plan.mockResolvedValue(planReply(allowance()));
    await wrap(<UsageScreen />);
    await waitFor(() => expect(screen.getByTestId('plan-prices')).toBeTruthy());
    expect(screen.getByTestId('plan-price-1')).toHaveTextContent(/199/);
    expect(screen.getByTestId('plan-price-6')).toHaveTextContent(/1,075/);
    expect(screen.getByTestId('plan-price-6')).toHaveTextContent('179 EGP / month', { exact: false });
    expect(screen.getByTestId('plan-price-12')).toHaveTextContent(/166/);
    expect(screen.getByText(/no VAT/)).toBeTruthy();
    expect(screen.getByText(/InstaPay or bank transfer only/)).toBeTruthy();
  });
  test('trial copy says 1 user, 50 units, 80 credits and never mentions a free plan', async () => {
    asMember(true);
    const trial = allowance({ source: 'trial', plan: { ...plan, id: 'trial', name: ['تجربة', 'Trial'], priceEgp: 0, units: 50, credits: 80, prices: {} }, units: { used: 3, limit: 50 }, credits: { used: 0, limit: 80, plan: 80, bundles: 0, grants: 0 } });
    m.usage.mockResolvedValue({ allowance: trial });
    m.plan.mockResolvedValue(planReply(trial));
    await wrap(<UsageScreen />);
    await waitFor(() => expect(screen.getByTestId('plan-trial-copy')).toHaveTextContent(/1 user, 50 units and 80 AI credits/));
    expect(screen.queryByTestId('plan-prices')).toBeNull();
    expect(screen.queryByText(/free plan/i)).toBeNull();
  });
  test('the unit meter warns from 85 percent; extra seats show only through the seat total', async () => {
    asMember(false);
    m.usage.mockResolvedValue({ allowance: allowance({ units: { used: 860, limit: 1000 }, seats: { used: 2, limit: 3 }, extraSeats: 2 }) });
    await wrap(<UsageScreen />);
    await waitFor(() => expect(screen.getByTestId('units-warning')).toHaveTextContent(/86%/));
    expect(screen.getByTestId('meter-seats')).toHaveTextContent('2 / 3', { exact: false });
    expect(screen.queryByText(/extra/i)).toBeNull();
    expect(m.plan).not.toHaveBeenCalled(); // a broker never loads the plan, so never sees prices
    expect(screen.queryByTestId('plan-prices')).toBeNull();
  });
  test('no warning below 85 percent and unlimited units read as unlimited', async () => {
    asMember(false);
    m.usage.mockResolvedValue({ allowance: allowance({ units: { used: 5000, limit: 1000000 } }) });
    await wrap(<UsageScreen />);
    await waitFor(() => expect(screen.getByTestId('meter-units')).toHaveTextContent(/Unlimited/));
    expect(screen.queryByTestId('units-warning')).toBeNull();
  });
});
