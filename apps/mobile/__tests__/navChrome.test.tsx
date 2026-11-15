import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationBell } from '../src/components/NotificationBell';
import { UnitCard } from '../src/components/UnitCard';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { notificationsInbox: jest.fn() } }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

test('the bell shows the unread number and opens the inbox', async () => {
  m.notificationsInbox.mockResolvedValue({ items: [], page: 1, more: false, unread: 4 });
  const open = jest.fn();
  await wrap(<NotificationBell onPress={open} />);
  await waitFor(() => expect(screen.getByTestId('bell-badge')).toHaveTextContent('4'));
  await fireEvent.press(screen.getByTestId('bell'));
  expect(open).toHaveBeenCalled();
});

test('no unread, no badge', async () => {
  m.notificationsInbox.mockResolvedValue({ items: [], page: 1, more: false, unread: 0 });
  await wrap(<NotificationBell onPress={jest.fn()} />);
  await waitFor(() => expect(m.notificationsInbox).toHaveBeenCalled());
  expect(screen.queryByTestId('bell-badge')).toBeNull();
});

test('a unit card: status on the photo, price, facts as pills, edit with an icon (no emoji)', async () => {
  const onEdit = jest.fn();
  const unit = { id: '1', code: 'HP302', dealType: 'sale', compound: 'Hyde Park', price: 13500000, bedrooms: 3, bathrooms: 3, area: 200, photo: 'https://x/p.jpg', mine: true } as never;
  await render(<UnitCard unit={unit} lang="en" onPress={jest.fn()} onEdit={onEdit} />);
  expect(screen.getByTestId('deal-HP302')).toBeTruthy();
  expect(screen.getByText('Hyde Park')).toBeTruthy();
  expect(screen.getByText('HP302')).toBeTruthy();
  expect(screen.getByText(/200/)).toBeTruthy(); // area as a pill
  expect(screen.getByTestId('icon-edit')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('edit-HP302'));
  expect(onEdit).toHaveBeenCalled();
});

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

test('the floating bar has one sliding highlight, fills the active icon, and navigates on press', async () => {
  const { FloatingTabBar } = require('../src/components/FloatingTabBar');
  const { Icon } = require('../src/components/Icon');
  const routes = [{ key: 'a', name: 'Today' }, { key: 'b', name: 'Search' }, { key: 'c', name: 'More' }];
  const descriptors = Object.fromEntries(routes.map((r) => [r.key, { options: { title: r.name, tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Icon name="search" color={color} fill={focused ? '#123456' : undefined} /> } }]));
  const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
  await render(<FloatingTabBar state={{ index: 0, routes }} descriptors={descriptors} navigation={navigation} />);
  await fireEvent(screen.getByTestId('tab-bar'), 'layout', { nativeEvent: { layout: { width: 310, height: 68 } } });
  await waitFor(() => expect(screen.getByTestId('tab-highlight')).toBeTruthy());
  expect(screen.getAllByTestId('tab-highlight')).toHaveLength(1);
  await fireEvent.press(screen.getByTestId('tab-Search'));
  expect(navigation.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tabPress', target: 'b' }));
  expect(navigation.navigate).toHaveBeenCalledWith('Search', undefined);
  // The tab already open is not navigated to again.
  await fireEvent.press(screen.getByTestId('tab-Today'));
  expect(navigation.navigate).toHaveBeenCalledTimes(1);
});
