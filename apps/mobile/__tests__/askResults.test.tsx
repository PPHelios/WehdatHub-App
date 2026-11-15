import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AskResults } from '../src/components/AskResults';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { askResults: jest.fn() } }));
const m = api as unknown as Record<string, jest.Mock>;
const page = (over: object = {}) => ({
  chips: [{ key: 'area', value: '120 m²+' }],
  dropped: [],
  total_projects: 3,
  total_offers: 7,
  page: 1,
  pages: 2,
  projects: [{ name: 'Jazeel', name_en: 'Jazeel', place: 'Obour', offers: [{ area: 153, floor: null, price: 3000000, down: 300000, monthly: 28000 }], client_text: 'text' }],
  ...over,
});
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AskResults q="more than 120" /></QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  m.askResults.mockResolvedValue(page());
});

test('results are grouped by project and the next page is asked for', async () => {
  await wrap();
  await waitFor(() => expect(screen.getByText(/Jazeel/)).toBeTruthy());
  await fireEvent.press(screen.getByTestId('ask-next'));
  await waitFor(() => expect(m.askResults).toHaveBeenLastCalledWith('more than 120', 2, 'best', []));
});

test('dropping a filter chip asks again without it', async () => {
  await wrap();
  await waitFor(() => expect(screen.getByTestId('ask-chip-area')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('ask-chip-area'));
  await waitFor(() => expect(m.askResults).toHaveBeenLastCalledWith('more than 120', 1, 'best', ['area']));
});
