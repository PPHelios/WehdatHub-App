import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientRequestsScreen } from '../src/screens/ClientRequestsScreen';
import { api } from '../src/api';

const mockNavigate = jest.fn();
jest.mock('../src/api', () => ({ api: { clientRequests: jest.fn(), clientRequestDelete: jest.fn(), clientRequestFulfil: jest.fn(), search: jest.fn(), addClientRequest: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
const m = api as unknown as Record<string, jest.Mock>;
const row = { id: 'r1', summary: '3 beds in Obour, up to 5M', lead: { ref: 'L-0007', name: 'Sara' }, matches: 4, alerts: true, fulfilled_at: null, created_at: '2026-11-14T10:00:00Z' };
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ClientRequestsScreen /></QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  m.clientRequests.mockResolvedValue({ items: [row], page: 1, more: false });
});

test('pending requests show the lead and open it', async () => {
  await wrap();
  await waitFor(() => expect(screen.getByText(/3 beds in Obour/)).toBeTruthy());
  await fireEvent.press(screen.getByTestId('request-lead-r1'));
  expect(mockNavigate).toHaveBeenCalledWith('Lead', { ref: 'L-0007' });
});

test('a request can be marked fulfilled, and the Fulfilled tab asks for that tab', async () => {
  m.clientRequestFulfil.mockResolvedValue({ ok: true });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('request-fulfil-r1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('request-fulfil-r1'));
  await waitFor(() => expect(m.clientRequestFulfil).toHaveBeenCalledWith('r1'));
  await fireEvent.press(screen.getAllByText('Fulfilled')[0]);
  await waitFor(() => expect(m.clientRequests).toHaveBeenCalledWith('fulfilled', 1));
});

test('adding a request turns the description into filters and sends it with the lead', async () => {
  m.search.mockResolvedValue({ f: 'tok' });
  m.addClientRequest.mockResolvedValue({ id: 'r2' });
  await wrap();
  await fireEvent.press(screen.getByTestId('request-add'));
  await fireEvent.changeText(screen.getByTestId('request-q'), '3 beds Obour');
  await fireEvent.changeText(screen.getByTestId('request-lead'), 'L-0007');
  await fireEvent.press(screen.getByTestId('request-save'));
  await waitFor(() => expect(m.addClientRequest).toHaveBeenCalledWith('tok', 'L-0007', true));
});
