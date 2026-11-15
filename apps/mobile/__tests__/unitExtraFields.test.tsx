import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { UnitExtraFields } from '../src/components/UnitExtraFields';

const field = (k: string, label: string) => <Text key={k} testID={`f-${k}`}>{label}</Text>;

test('the features picker lists features without icons and toggles them', async () => {
  const set = jest.fn();
  await render(<UnitExtraFields fields={{ feature: ['corner'] }} set={set} field={field} lang="en" rent={false} ready editing={false} />);
  await fireEvent.press(screen.getByTestId('feature-elevator'));
  expect(set).toHaveBeenCalledWith('feature', ['corner', 'elevator']);
  await fireEvent.press(screen.getByTestId('feature-corner'));
  expect(set).toHaveBeenCalledWith('feature', []);
  expect(screen.getByText('Elevator')).toBeTruthy();
});

test('a new unit has the code field and the payment fields', async () => {
  await render(<UnitExtraFields fields={{}} set={jest.fn()} field={field} lang="en" rent={false} ready editing={false} />);
  expect(screen.getByTestId('f-code')).toBeTruthy();
  expect(screen.getByTestId('f-installment_value')).toBeTruthy();
});

test('an edit has no code field and rent has no payment fields', async () => {
  await render(<UnitExtraFields fields={{}} set={jest.fn()} field={field} lang="en" rent ready editing />);
  expect(screen.getByTestId('f-land_area')).toBeTruthy();
  expect(screen.queryByTestId('f-code')).toBeNull();
  expect(screen.queryByTestId('f-installment_value')).toBeNull();
});
