import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Sheet } from '../src/components/Sheet';
import { EmptyView, Loading } from '../src/components/StateViews';
import { ToastHost, toast } from '../src/components/Toast';

const Safe = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>{children}</SafeAreaProvider>
);

test('Sheet shows children when visible and backdrop press calls onClose', async () => {
  const onClose = jest.fn();
  await render(<Safe><Sheet visible onClose={onClose} title="Pick" testID="s"><Text>inside</Text></Sheet></Safe>);
  expect(screen.getByText('inside')).toBeTruthy();
  expect(screen.getByText('Pick')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('s-backdrop'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('Sheet renders nothing when not visible', async () => {
  await render(<Safe><Sheet visible={false} onClose={jest.fn()}><Text>inside</Text></Sheet></Safe>);
  expect(screen.queryByText('inside')).toBeNull();
});

test('EmptyView renders icon and secondary action', async () => {
  const onSecond = jest.fn();
  await render(<Safe><EmptyView title="Nothing" icon="search" actionLabel="Add" onAction={jest.fn()} secondaryAction={{ label: 'Import', onPress: onSecond }} /></Safe>);
  expect(screen.getByTestId('empty-icon')).toBeTruthy();
  await fireEvent.press(screen.getByText('Import'));
  expect(onSecond).toHaveBeenCalled();
});

test('Loading kind=rows renders 3 placeholders', async () => {
  await render(<Safe><Loading kind="rows" /></Safe>);
  expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(3);
});

test('toast() still shows its text', async () => {
  await render(<Safe><ToastHost /></Safe>);
  await act(async () => toast('Saved.'));
  expect(screen.getByText('Saved.')).toBeTruthy();
});
