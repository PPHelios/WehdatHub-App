import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { narrow, useColumns } from '../src/layout';

function Cols() {
  return <Text>{`cols:${useColumns()}`}</Text>;
}

test('a phone gets one column and the screen still renders inside the narrow wrapper', async () => {
  const Wrapped = narrow(Cols);
  await render(<Wrapped />);
  expect(screen.getByText('cols:1')).toBeTruthy();
});
