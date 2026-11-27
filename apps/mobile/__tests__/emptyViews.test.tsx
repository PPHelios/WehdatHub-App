import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmptyView } from '../src/components/StateViews';

test('EmptyView has an icon and a primary action that runs', async () => {
  const onAction = jest.fn();
  await render(<EmptyView title="Nothing" icon="units" actionLabel="Add unit" onAction={onAction} />);
  expect(screen.getByTestId('empty-icon')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('empty-action'));
  expect(onAction).toHaveBeenCalledTimes(1);
});

test('the type refuses an EmptyView without an action or an icon', () => {
  const never = (_: React.ReactElement) => undefined;
  // @ts-expect-error actionLabel and onAction are required
  never(<EmptyView title="x" icon="units" />);
  // @ts-expect-error icon is required
  never(<EmptyView title="x" actionLabel="Go" onAction={() => undefined} />);
});
