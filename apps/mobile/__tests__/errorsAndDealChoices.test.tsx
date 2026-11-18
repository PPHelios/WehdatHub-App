import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClientError } from '@wehdathub/shared';
import { errorText } from '../src/errors';
import { DealsScreen } from '../src/screens/DealsScreens';
import { api } from '../src/api';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/api', () => ({ api: { deals: jest.fn(), dealStatus: jest.fn() } }));
const m = api as unknown as Record<string, jest.Mock>;

// QA round 2: the server adds a `message` to every error answer, and the Deals screen offers only the statuses the server allows.
test('the server sentence is shown instead of a generic line', () => {
  const err = new ApiClientError(422, 'follow_up_past', null, { error: 'follow_up_past', message: 'That time has passed; choose a future one.' });
  expect(errorText(err, 'en')).toBe('That time has passed; choose a future one.');
});

test('without a server sentence the generic lines still apply, and a network failure stays offline', () => {
  expect(errorText(new ApiClientError(0, 'network'), 'en')).not.toMatch(/network/);
  expect(errorText(new ApiClientError(403, 'error'), 'en')).toBeTruthy();
  expect(errorText(new ApiClientError(500, 'error', null, { message: '' }), 'en')).toBeTruthy();
});

test('a paid deal offers only paid to a broker (the server lists the allowed statuses)', async () => {
  m.deals.mockResolvedValue({ items: [{ ref: 9, status: 'paid', client_name: 'Omar', unit_code: 'A-1', price: 5000000, version: 1, allowed: ['paid'] }], more: false, totals: [], statuses: ['pending', 'signed', 'paid', 'cancelled'] });
  await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DealsScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('deal-9')).toBeTruthy());
  const tree = JSON.stringify(screen.toJSON());
  const card = tree.slice(tree.indexOf('deal-9'));
  expect(card).toContain('اتدفع');
  expect(card).not.toContain('مستني');
});
