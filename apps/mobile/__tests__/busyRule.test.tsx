import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '../src/components/Button';
import { BusyProvider, useServerCall } from '../src/busy';

describe('the busy rule', () => {
  function Screen({ slow }: { slow: Promise<void> }) {
    const run = useServerCall();
    return (
      <View>
        <Button label="Save" testID="save" onPress={() => slow} />
        <Button label="Other" testID="other" onPress={() => undefined} />
        <Button label="Call" testID="call" onPress={() => run(() => slow)} />
      </View>
    );
  }

  test('while one button runs, it spins and the others are disabled; all free when it ends', async () => {
    let done!: () => void;
    const slow = new Promise<void>((r) => { done = r; });
    await render(<BusyProvider><Screen slow={slow} /></BusyProvider>);
    await act(async () => { fireEvent.press(screen.getByTestId('save')); });
    expect(screen.getAllByTestId('button-spinner')).toHaveLength(1); // only the pressed button spins
    expect(screen.getByTestId('other').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('call').props.accessibilityState.disabled).toBe(true);
    await act(async () => { done(); await slow; });
    expect(screen.getByTestId('other').props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByTestId('button-spinner')).toBeNull();
  });

  test('a failing call does not leave the screen locked', async () => {
    const onBoom = jest.fn();
    function Boom() {
      return <Button label="Boom" testID="boom" onPress={async () => { try { throw new Error('x'); } catch (e) { onBoom(); } }} />;
    }
    await render(<BusyProvider><Boom /><Button label="Other" testID="other" onPress={() => undefined} /></BusyProvider>);
    await act(async () => { fireEvent.press(screen.getByTestId('boom')); });
    expect(onBoom).toHaveBeenCalled();
    expect(screen.getByTestId('other').props.accessibilityState.disabled).toBe(false);
  });

  test('a button that is loading (the screen passes loading) locks the others', async () => {
    await render(<BusyProvider><Button label="A" testID="a" loading onPress={() => undefined} /><Button label="B" testID="b" onPress={() => undefined} /></BusyProvider>);
    expect(screen.getByTestId('b').props.accessibilityState.disabled).toBe(true);
  });
});
