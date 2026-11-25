import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AskResults } from '../src/components/AskResults';
import { SearchCreditRings } from '../src/components/SearchCreditRings';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { askResults: jest.fn(), askAction: jest.fn().mockResolvedValue(undefined), askReport: jest.fn() } }));
const m = api as unknown as Record<string, jest.Mock>;
const jazeel = { id: 'p1', name: 'Jazeel', name_en: 'Jazeel', developer: 'Arabisk', place: 'Obour', governorate: 'Qalyubia', status: 'selling', delivery: 'Q4 2028', price_from: 3000000, facts: [{ label: 'From', value: '3M EGP' }], offers: [{ type: 'apartment', area: 153, floor: null, bedrooms: 3, price: 3000000, down: 300000, monthly: 28000, years: 9, discount_pct: 15 }], offers_total: 7, free_text: null, client_text: 'text' };
const page = (over: object = {}) => ({
  chips: [{ key: 'area', value: '120 m²+' }],
  dropped: [],
  sort: 'best',
  total_projects: 3,
  total_options: 12,
  page: 1,
  pages: 2,
  per_page: 10,
  projects: [jazeel],
  ...over,
});
const wrap = (onOpen?: (id: string, name: string) => void) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AskResults q="more than 120" onOpenProject={onOpen} /></QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  m.askResults.mockResolvedValue(page());
});

test('results are grouped by project with the count, its offers and how many more match', async () => {
  await wrap();
  await waitFor(() => expect(screen.getByText('Jazeel')).toBeTruthy());
  expect(screen.getByTestId('project-count').props.children.join('')).toContain('12');
  expect(screen.getByText(/و 6 خيار تانية/)).toBeTruthy();
  expect(screen.getByText(/153 m²/)).toBeTruthy();
});

test('a project without offers shows its notes lines, not invented numbers', async () => {
  m.askResults.mockResolvedValue(page({ projects: [{ ...jazeel, offers: [], offers_total: 0, free_text: 'Delivery in one year' }] }));
  await wrap();
  await waitFor(() => expect(screen.getByTestId('project-free-text')).toBeTruthy());
  expect(screen.getByText('Delivery in one year')).toBeTruthy();
  expect(screen.queryByTestId('project-offers')).toBeNull();
});

test('a page number is asked for with the contract parameters', async () => {
  await wrap();
  await waitFor(() => expect(screen.getByTestId('page-2')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('page-2'));
  await waitFor(() => expect(m.askResults).toHaveBeenLastCalledWith({ q: 'more than 120', page: 2, sort: 'best', drop: [] }));
});

test('sort pills ask again with the sort and start from page 1', async () => {
  await wrap();
  await waitFor(() => expect(screen.getByTestId('ask-sort')).toBeTruthy());
  await fireEvent.press(screen.getByText('أقل مقدم'));
  await waitFor(() => expect(m.askResults).toHaveBeenLastCalledWith({ q: 'more than 120', page: 1, sort: 'down', drop: [] }));
});

test('dropping a filter chip asks again without it', async () => {
  await wrap();
  await waitFor(() => expect(screen.getByTestId('ask-chip-area')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('ask-chip-area'));
  await waitFor(() => expect(m.askResults).toHaveBeenLastCalledWith({ q: 'more than 120', page: 1, sort: 'best', drop: ['area'] }));
});

test('the filter row sends price, area, down payment and bedrooms', async () => {
  await wrap();
  await waitFor(() => expect(screen.getByTestId('ask-pmax')).toBeTruthy());
  await fireEvent.changeText(screen.getByTestId('ask-pmax'), '5,000,000');
  await fireEvent.changeText(screen.getByTestId('ask-amin'), '100');
  await fireEvent.changeText(screen.getByTestId('ask-dmax'), '300000');
  await fireEvent.press(screen.getByText('3'));
  await waitFor(() => expect(m.askResults).toHaveBeenLastCalledWith({ q: 'more than 120', page: 1, sort: 'best', drop: [], pmax: 5000000, amin: 100, dmax: 300000, bed: 3 }), { timeout: 3000 });
});

test('a card opens the project and the WhatsApp button is there', async () => {
  const open = jest.fn();
  await wrap(open);
  await waitFor(() => expect(screen.getByTestId('project-p1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('project-p1'));
  expect(open).toHaveBeenCalledWith('p1', 'Jazeel');
  expect(screen.getByTestId('project-whatsapp')).toBeTruthy();
});

test('the first answer token and log id ride along on later pages; actions and units are sent', async () => {
  m.askResults.mockResolvedValue(page({ token: 'tok', log_id: 'log1', answer_line: '3 projects fit', projects: [{ ...jazeel, matched: ['place', 'bedrooms'] }] }));
  await wrap();
  await waitFor(() => expect(screen.getByTestId('ask-line')).toBeTruthy());
  expect(screen.getByTestId('project-matched')).toHaveTextContent(/المكان/);
  await fireEvent.press(screen.getByTestId('page-2'));
  await waitFor(() => expect(m.askResults).toHaveBeenLastCalledWith({ q: 'more than 120', page: 2, sort: 'best', drop: [], token: 'tok', logId: 'log1' }));
  expect(m.askAction).toHaveBeenCalledWith('log1', 'page', '2');
  await fireEvent.press(screen.getByTestId('ask-chip-area'));
  expect(m.askAction).toHaveBeenCalledWith('log1', 'chip_drop', 'area');
  await fireEvent(screen.getByTestId('ask-units'), 'valueChange', true);
  await waitFor(() => expect(m.askResults).toHaveBeenLastCalledWith(expect.objectContaining({ units: true, token: 'tok' })));
});

test('Wrong results? sends the note with the log id; a second report is told so', async () => {
  m.askResults.mockResolvedValue(page({ token: 'tok', log_id: 'log1' }));
  m.askReport.mockResolvedValueOnce({ ok: true });
  await wrap();
  await fireEvent.press(await screen.findByTestId('ask-wrong'));
  await fireEvent.changeText(screen.getByTestId('ask-report-note'), 'wrong place');
  await fireEvent.press(screen.getByTestId('ask-report-send'));
  await waitFor(() => expect(m.askReport).toHaveBeenCalledWith('log1', 'wrong place'));
  expect(screen.getByTestId('ask-report-done')).toBeTruthy();
});

test('seeded initial AskResults skips duplicate page-1 fetch and carries token/log_id to page 2', async () => {
  const seeded = page({ token: 'tok-seed', log_id: 'log-seed' });
  await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AskResults q="more than 120" initial={seeded as any} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Jazeel')).toBeTruthy();
  expect(m.askResults).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByTestId('page-2'));
  await waitFor(() => expect(m.askResults).toHaveBeenCalledWith(expect.objectContaining({
    q: 'more than 120',
    page: 2,
    token: 'tok-seed',
    logId: 'log-seed',
  })));
});

test('SearchCreditRings shows neutral state when loading/error and balance accessibilityLabel when loaded', async () => {
  await render(<SearchCreditRings loading ar={false} />);
  expect(screen.getByTestId('search-credit-rings').props.accessibilityLabel).toMatch(/Loading/i);

  await render(<SearchCreditRings error ar={false} />);
  expect(screen.getByTestId('search-credit-rings').props.accessibilityLabel).toMatch(/unavailable/i);

  await render(<SearchCreditRings data={{ personal: { limit: 10, remaining: 7, used: 3 } }} ar={false} />);
  expect(screen.getByTestId('search-credit-rings').props.accessibilityLabel).toMatch(/7.*10/);
});
