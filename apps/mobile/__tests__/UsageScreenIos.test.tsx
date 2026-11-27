import React from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { UsageScreen } from '../src/screens/MoreScreens';
import { api } from '../src/api';

jest.mock('../src/api', () => ({
  api: {
    usage: jest.fn(),
    plan: jest.fn(),
  },
}));

jest.mock('../src/rights', () => ({
  useRights: () => ({ agencyOwner: true, manager: true }),
}));

const mockedApi = api as jest.Mocked<typeof api>;

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.usage.mockResolvedValue({
    allowance: { source: 'trial', units: { used: 3, limit: 50 }, credits: { used: 10, limit: 80 }, seats: { used: 1, limit: 1 } },
    ai: null,
  } as never);
  mockedApi.plan.mockResolvedValue({
    allowance: {
      source: 'trial',
      until: '2026-12-10T00:00:00Z',
      plan: { id: 'trial', name: ['تجربة', 'Trial'], seats: 1, units: 50, credits: 80, prices: {} },
    },
    payTo: { instapay: 'wehdathub@instapay', bank: 'CIB 1234' },
    paymentChoices: [{ kind: 'plan', plan: 'solo', months: 1, amount: 499, name: ['سولو', 'Solo'] }],
    payments: [],
    canPay: true,
    canBuyCredits: true,
  } as never);
});

test('hides payment buttons on iOS and shows neutral web-management note', async () => {
  const origOS = Platform.OS;
  Platform.OS = 'ios';
  try {
    await render(wrap(<UsageScreen />));
    expect(await screen.findByTestId('plan-allowance')).toBeTruthy();
    expect(screen.getByTestId('ios-billing-note')).toBeTruthy();
    expect(screen.queryByTestId('pay-to-card')).toBeNull();
    expect(screen.queryByTestId('payment-choices-card')).toBeNull();
  } finally {
    Platform.OS = origOS;
  }
});

test('shows payment methods and choices on Android', async () => {
  const origOS = Platform.OS;
  Platform.OS = 'android';
  try {
    await render(wrap(<UsageScreen />));
    expect(await screen.findByTestId('pay-to-card')).toBeTruthy();
    expect(screen.getByTestId('payment-choices-card')).toBeTruthy();
    expect(screen.queryByTestId('ios-billing-note')).toBeNull();
  } finally {
    Platform.OS = origOS;
  }
});
