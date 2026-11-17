import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ratioText } from '../src/screens/MoreScreens';
import { DealsScreen, dealStatusLabel } from '../src/screens/DealsScreens';
import { api } from '../src/api';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/api', () => ({ api: { deals: jest.fn(), dealStatus: jest.fn() } }));
const m = api as unknown as Record<string, jest.Mock>;

// QA 2026-11-17: on the Usage screen (Arabic) "135 of 6,000" read "6,000 / 135", and the Deals screen showed English statuses.
test('usage ratios keep "used / limit" in a left-to-right run so Arabic does not flip them', () => {
  const t = ratioText(135, 6000);
  expect(t).toBe('⁦135 / 6,000⁩');
  expect(t.indexOf('135')).toBeLessThan(t.indexOf('6,000'));
  expect(ratioText(null, 10)).toContain('—');
});

test('deal statuses are shown in Arabic on the Arabic screen and unchanged otherwise', () => {
  expect(dealStatusLabel('cancelled', true)).toBe('اتلغى');
  expect(dealStatusLabel('paid', true)).toBe('اتدفع');
  expect(dealStatusLabel('signed', false)).toBe('signed');
  expect(dealStatusLabel('mystery', true)).toBe('mystery');
});

test('a deal with no client or unit shows no dangling separators', async () => {
  m.deals.mockResolvedValue({ items: [{ ref: 4, status: 'cancelled', client_name: '', unit_code: '', price: 3000000, version: 1 }], more: false, totals: [], statuses: ['cancelled'] });
  await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DealsScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('deal-4')).toBeTruthy());
  const tree = JSON.stringify(screen.toJSON());
  expect(tree).toContain('3,000,000');
  expect(tree).not.toMatch(/ · ·/);
});
