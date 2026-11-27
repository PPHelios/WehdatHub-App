import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DecisionCard } from '../src/components/DecisionCard';

const base = { testID: 'home-x', label: 'Urgent', title: 'Overdue follow-ups', why: '3 follow-ups past due', icon: 'bell' as const };

test('decision card shows label, title, why and fires primary and secondary', async () => {
  const open = jest.fn();
  const ask = jest.fn();
  await render(<DecisionCard {...base} urgency="high" value="3" primary={{ label: 'Open', onPress: open }} secondary={{ label: 'Ask', testID: 'home-x-ask', onPress: ask }} />);
  expect(screen.getByText('Urgent')).toBeTruthy();
  expect(screen.getByText('3 follow-ups past due')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('home-x'));
  await fireEvent.press(screen.getByTestId('home-x-ask'));
  expect(open).toHaveBeenCalledTimes(1);
  expect(ask).toHaveBeenCalledTimes(1);
});

test('low urgency renders a compact row with one button', async () => {
  const open = jest.fn();
  await render(<DecisionCard {...base} urgency="low" primary={{ label: 'Open', onPress: open }} secondary={{ label: 'Ask', testID: 'nope', onPress: jest.fn() }} />);
  expect(screen.queryByTestId('nope')).toBeNull();
  await fireEvent.press(screen.getByTestId('home-x'));
  expect(open).toHaveBeenCalledTimes(1);
});
