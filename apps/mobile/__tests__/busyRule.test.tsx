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
      return <Button label="Boom" testID="boom" onPress={async () => { try { throw new Error('x'); } catch { onBoom(); } }} />;
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

describe('the busy rule reaches fields, switches, rows and every write', () => {
  const { Field } = require('../src/components/Field');
  const { BusySwitch } = require('../src/components/BusySwitch');
  const { beginBusy, resetBusy, BACKGROUND_WRITE } = require('../src/busy');
  const { createApiClient } = require('@wehdathub/shared');
  afterEach(() => resetBusy());

  test('while a write runs a field cannot be edited, a switch is off-limits and a layer catches touches', async () => {
    await render(<BusyProvider><Field label="Name" testID="name" value="" onChangeText={() => undefined} /><BusySwitch testID="sw" value={false} onValueChange={() => undefined} /></BusyProvider>);
    expect(screen.queryByTestId('busy-layer')).toBeNull();
    expect(screen.getByTestId('sw').props.disabled).toBeFalsy();
    let end!: () => void;
    await act(async () => { end = beginBusy(); });
    expect(screen.getByTestId('busy-layer')).toBeTruthy();
    expect(screen.getByLabelText('Name').props.editable).toBe(false);
    expect(screen.getByTestId('sw').props.disabled).toBe(true);
    await act(async () => { end(); });
    expect(screen.queryByTestId('busy-layer')).toBeNull();
    expect(screen.getByLabelText('Name').props.editable).toBe(true);
  });

  test('two writes at once keep the screen locked until the last one ends', async () => {
    await render(<BusyProvider><View /></BusyProvider>);
    let a!: () => void, b!: () => void;
    await act(async () => { a = beginBusy(); b = beginBusy(); });
    await act(async () => { a(); a(); }); // ending twice counts once
    expect(screen.getByTestId('busy-layer')).toBeTruthy();
    await act(async () => { b(); });
    expect(screen.queryByTestId('busy-layer')).toBeNull();
  });

  test('the API client locks the screen for a write, frees it after an error, and ignores reads and background writes', async () => {
    const starts: string[] = [];
    let ended = 0;
    const onWrite = (m: string, p: string) => { if (BACKGROUND_WRITE.test(p)) return undefined; starts.push(`${m} ${p}`); return () => { ended += 1; }; };
    const fetchImpl = jest.fn(async (url: string) => (url.includes('/fail') ? { ok: false, status: 500, json: async () => ({}), headers: { get: () => null } } : { ok: true, status: 200, json: async () => ({ ok: true }), headers: { get: () => null } }));
    const api = createApiClient({ baseUrl: 'https://x.test', getToken: () => 't', fetchImpl, onWrite });
    await api.me().catch(() => undefined); // a read
    await api.registerDevice('tok', 'android'); // a background write
    await api.testRole('broker'); // a write
    expect(starts).toEqual(['POST /test-role']);
    expect(ended).toBe(1);
    await api.saveAppSettings({ quietLine: true });
    expect(ended).toBe(2);
  });
});
