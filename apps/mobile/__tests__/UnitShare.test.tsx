import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useUnitShare } from '../src/assistant/useUnitShare';

jest.mock('../src/api', () => ({ api: { unitShareLink: jest.fn() } }));

function Host() {
  const share = useUnitShare();
  return <><Pressable testID="send" onPress={() => share.open('HP-301')}><Text>Send</Text></Pressable>{share.modal}</>;
}

test('Send to client opens the client-link modal', async () => {
  await render(<Host />);
  expect(screen.queryByTestId('client-to')).toBeNull();
  await fireEvent.press(screen.getByTestId('send'));
  expect(screen.getByTestId('client-to')).toBeTruthy();
});
