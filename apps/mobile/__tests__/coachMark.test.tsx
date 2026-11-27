import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoachMark } from '../src/components/CoachMark';
import { coachKey, useCoachMarks } from '../src/coachMarks';
import { useAuth } from '../src/auth';

function Target({ id, text }: { id: string; text: string }) {
  const ref = React.useRef<React.ComponentRef<typeof View>>(null);
  React.useEffect(() => {
    // The test renderer has no layout: answer where the target is.
    if (ref.current) (ref.current as unknown as { measureInWindow: unknown }).measureInWindow = (cb: (x: number, y: number, w: number, h: number) => void) => cb(20, 100, 50, 50);
  }, []);
  return <><View ref={ref} /><CoachMark id={id} targetRef={ref} text={text} /></>;
}

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  useCoachMarks.setState({ active: null, shown: false });
  useAuth.setState({ broker: { id: 'b1', name: 'N', role: 'broker', lang: 'en' } as never });
});
afterEach(() => jest.useRealTimers());

const settle = async () => { await act(async () => { await jest.advanceTimersByTimeAsync(400); }); };

test('shows its text once and "Got it" closes it', async () => {
  await render(<Target id="mic" text="Hold the mic" />);
  await settle();
  expect(screen.getByText('Hold the mic')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('coach-got-it'));
  expect(screen.queryByText('Hold the mic')).toBeNull();
  expect(await AsyncStorage.getItem(coachKey('mic', 'b1'))).toBe('1');
});

test('a mark the broker already saw never shows again, a new broker still sees it', async () => {
  await AsyncStorage.setItem(coachKey('mic', 'b1'), '1');
  await render(<Target id="mic" text="Hold the mic" />);
  await settle();
  expect(screen.queryByText('Hold the mic')).toBeNull();
  await act(async () => {
    useCoachMarks.setState({ active: null, shown: false });
    useAuth.setState({ broker: { id: 'b2', name: 'M', role: 'broker', lang: 'en' } as never });
  });
  await render(<Target id="mic" text="Second broker" />);
  await settle();
  expect(screen.getByText('Second broker')).toBeTruthy();
});

test('only one mark per app session', async () => {
  await render(<><Target id="mic" text="First tip" /><Target id="hubTabs" text="Second tip" /></>);
  await settle();
  expect(screen.getByText('First tip')).toBeTruthy();
  expect(screen.queryByText('Second tip')).toBeNull();
  await fireEvent.press(screen.getByTestId('coach-got-it'));
  await waitFor(() => expect(screen.queryByText('First tip')).toBeNull());
  // Still the same session: the second tip stays hidden and is not marked as seen.
  await render(<Target id="leadSwipe" text="Third tip" />);
  await settle();
  expect(screen.queryByText('Third tip')).toBeNull();
  expect(await AsyncStorage.getItem(coachKey('leadSwipe', 'b1'))).toBeNull();
});
