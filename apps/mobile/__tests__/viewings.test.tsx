import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ViewingForm, viewingInstant } from '../src/components/ViewingForm';
import { CalendarScreen, groupByDay } from '../src/screens/CalendarScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { setViewing: jest.fn(), viewings: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
const m = api as unknown as { setViewing: jest.Mock; viewings: jest.Mock };

const lead = { ref: 'L-0001', name: 'Sara', phones: ['201011112222'], kind: 'buyer', stage: 'new', lostReason: null, source: null, notes: null, nextFollowUpAt: null, followUpKind: null, followUpNote: null, lastContactAt: null, assignee: null, version: 3 } as const;
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => jest.clearAllMocks());

test('the instant is the chosen local day and hour', () => {
  const now = new Date(2026, 10, 9, 8, 30);
  const d = new Date(viewingInstant(2, 14, now));
  expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([11, 14, 0]);
});

test('saving a viewing sends the lead version and shows the client message only under the info button', async () => {
  m.setViewing.mockResolvedValue({ lead, viewing: { id: 'v1', startsAt: new Date().toISOString(), place: 'Gate 3', status: 'proposed' }, url: 'https://x/v/t', message: 'Hello Sara, your viewing', wa: 'https://wa.me/201011112222?text=x' });
  await wrap(<ViewingForm lead={lead as never} />);
  await fireEvent.changeText(screen.getByTestId('viewing-place'), 'Gate 3');
  await fireEvent.press(screen.getByTestId('viewing-save'));
  await waitFor(() => expect(screen.getByTestId('viewing-done')).toBeTruthy());
  expect(m.setViewing).toHaveBeenCalledWith('L-0001', expect.objectContaining({ version: 3, place: 'Gate 3' }));
  expect(screen.queryByTestId('viewing-message')).toBeNull();
  await fireEvent.press(screen.getByTestId('viewing-info'));
  expect(screen.getByTestId('viewing-message')).toBeTruthy();
  expect(screen.getByTestId('viewing-send')).toBeTruthy();
});

test('a past time shows the error and no result', async () => {
  const { ApiClientError } = jest.requireActual('@wehdathub/shared');
  m.setViewing.mockRejectedValue(new ApiClientError(422, 'past'));
  await wrap(<ViewingForm lead={lead as never} />);
  await fireEvent.press(screen.getByTestId('viewing-save'));
  await waitFor(() => expect(screen.getByTestId('viewing-error')).toBeTruthy());
  expect(screen.queryByTestId('viewing-done')).toBeNull();
});

test('the calendar groups viewings by day', async () => {
  const items = [
    { id: 'a', startsAt: new Date(2026, 10, 10, 10).toISOString(), place: null, status: 'proposed', proposedAt: null, clientNote: null, leadRef: 'L-0001', leadName: 'Sara', unitCode: 'A-1' },
    { id: 'b', startsAt: new Date(2026, 10, 10, 15).toISOString(), place: 'Gate', status: 'confirmed', proposedAt: null, clientNote: null, leadRef: 'L-0002', leadName: null, unitCode: null },
    { id: 'c', startsAt: new Date(2026, 10, 12, 9).toISOString(), place: null, status: 'proposed', proposedAt: null, clientNote: null, leadRef: 'L-0003', leadName: 'Omar', unitCode: null },
  ];
  expect(groupByDay(items, 'en').map((g) => g.data.length)).toEqual([2, 1]);
  m.viewings.mockResolvedValue({ items });
  await wrap(<CalendarScreen />);
  await waitFor(() => expect(screen.getByTestId('viewing-a')).toBeTruthy());
  expect(screen.getByText('Omar')).toBeTruthy();
});
