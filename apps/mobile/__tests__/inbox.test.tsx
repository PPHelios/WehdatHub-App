import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InboxScreen } from '../src/screens/InboxScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { notificationsInbox: jest.fn(), notificationRead: jest.fn(), notificationDelete: jest.fn(), notificationsReadAll: jest.fn(), notificationsDeleteAll: jest.fn() } }));
const m = api as unknown as Record<string, jest.Mock>;
const item = { id: 'n1', kind: 'match', title: 'New match', body: 'A-1', url: null, created_at: '2026-11-14T10:00:00Z', read: false };
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><InboxScreen /></QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  m.notificationsInbox.mockResolvedValue({ items: [item], page: 1, more: false, unread: 1 });
});

test('the inbox lists notifications and deletes one', async () => {
  m.notificationDelete.mockResolvedValue({ ok: true, unread: 0 });
  await wrap();
  await waitFor(() => expect(screen.getByText('New match')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('inbox-delete-n1'));
  await waitFor(() => expect(m.notificationDelete).toHaveBeenCalledWith('n1'));
});

test('an empty inbox says so', async () => {
  m.notificationsInbox.mockResolvedValue({ items: [], page: 1, more: false, unread: 0 });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('inbox-empty')).toBeTruthy());
});
