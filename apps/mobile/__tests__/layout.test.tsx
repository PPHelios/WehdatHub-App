import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { columnsFor, narrow } from '../src/layout';

test('phones get one column, tablets two, big tablets three', () => {
  expect([390, 699, 700, 999, 1000].map(columnsFor)).toEqual([1, 1, 2, 2, 3]);
});

test('the narrow wrapper still renders the screen', async () => {
  const Wrapped = narrow(() => <Text>hello</Text>);
  await render(<Wrapped />);
  expect(screen.getByText('hello')).toBeTruthy();
});
