import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { VoiceBar } from '../src/components/VoiceBar';
import { cancelRecording } from '../src/voice';

jest.mock('../src/voice', () => ({
  ensureMic: jest.fn().mockResolvedValue(true),
  startRecording: jest.fn().mockResolvedValue(undefined),
  stopRecording: jest.fn(),
  cancelRecording: jest.fn(),
  EmptyRecordingError: class extends Error {},
}));
let mockReduced = false;
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...actual, default: actual.default, useReducedMotion: () => mockReduced };
});

const discard = (getByTestId: (id: string) => any) => fireEvent(getByTestId('vb-mic'), 'accessibilityAction', { nativeEvent: { actionName: 'discard' } });

beforeEach(() => {
  jest.useFakeTimers();
  (cancelRecording as jest.Mock).mockClear();
});
afterEach(() => jest.useRealTimers());

test('reduced motion: cancel is immediate, no bin', async () => {
  mockReduced = true;
  const { getByTestId, queryByTestId } = await render(<VoiceBar id="vb" label="Talk" onFile={jest.fn()} onError={jest.fn()} />);
  await discard(getByTestId);
  expect(cancelRecording).toHaveBeenCalledTimes(1);
  expect(queryByTestId('discard-bin')).toBeNull();
  expect(queryByTestId('vb-rail')).toBeNull();
});

test('animated: cancel calls cancelRecording, shows the bin, then resets to idle', async () => {
  mockReduced = false;
  const { getByTestId, queryByTestId } = await render(<VoiceBar id="vb" label="Talk" onFile={jest.fn()} onError={jest.fn()} />);
  await discard(getByTestId);
  expect(cancelRecording).toHaveBeenCalledTimes(1);
  expect(getByTestId('discard-bin')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(800); });
  expect(queryByTestId('discard-bin')).toBeNull();
  expect(queryByTestId('vb-rail')).toBeNull();
});
