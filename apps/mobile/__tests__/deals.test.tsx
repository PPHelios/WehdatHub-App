import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DealsScreen, SourcesScreen } from '../src/screens/DealsScreens';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { deals: jest.fn(), dealStatus: jest.fn(), sources: jest.fn(), saveSpend: jest.fn() } }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = async (ui: React.ReactElement) => await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

test('deals list shows a deal', async () => {
  m.deals.mockResolvedValue({ items: [{ ref: 7, status: 'signed', client_name: 'Omar', unit_code: 'A-1', price: 5000000, version: 1 }], more: false, totals: [], statuses: ['signed', 'cancelled'] });
  await wrap(<DealsScreen />);
  await waitFor(() => expect(screen.getByTestId('deal-7')).toBeTruthy());
});

test('sources show a row per source', async () => {
  m.sources.mockResolvedValue({ month: '2026-11', rows: [{ source: 'facebook', leads: 4, deals: 1, commission: 1000, spend: null, perLead: null, perDeal: null }], totals: {} });
  await wrap(<SourcesScreen />);
  await waitFor(() => expect(screen.getByTestId('source-facebook')).toBeTruthy());
});
