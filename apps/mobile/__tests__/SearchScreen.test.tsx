import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchScreen } from '../src/screens/SearchScreen';
import { api } from '../src/api';
import * as voice from '../src/voice';
import { AppState } from 'react-native';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

jest.mock('../src/api', () => ({ api: { search: jest.fn(), voiceToText: jest.fn() } }));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn(), startRecording: jest.fn(), stopRecording: jest.fn(), cancelRecording: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
const mocked = api as unknown as { search: jest.Mock; voiceToText: jest.Mock };
const v = voice as unknown as { ensureMic: jest.Mock; startRecording: jest.Mock; stopRecording: jest.Mock; cancelRecording: jest.Mock };

const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><SearchScreen /></QueryClientProvider>);

beforeEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); v.startRecording.mockReset(); });

test('typed search shows the no-results state with a way forward', async () => {
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(screen.getByText(/No results|مفيش نتايج/)).toBeTruthy());
  expect(mocked.search).toHaveBeenCalledWith('villa', { drop: false, status: 'active' });
});

test('an ask lets the broker search without the unknown words', async () => {
  mocked.search.mockResolvedValueOnce({ status: 'ask', source: 'parser', total: 0, items: [], ask: { terms: ['xyz'], withoutTotal: 4 } });
  mocked.search.mockResolvedValueOnce({ status: 'none', source: 'parser', total: 0, items: [] });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa xyz');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(screen.getByText('xyz')).toBeTruthy());
  await fireEvent.press(screen.getByText(/Search without them|ابحث من غيرها/));
  await waitFor(() => expect(mocked.search).toHaveBeenLastCalledWith('villa xyz', { drop: true, status: 'active' }));
});

type Handlers = { onBegin: (e: object) => void; onUpdate: (e: object) => void; onFinalize: (e: object, ok: boolean) => void };
const handlers = () => (getByGestureTestId('search-mic') as unknown as { handlers: Handlers }).handlers;
/** The finger goes down, moves, lifts. (The helper from the gesture library always finishes a whole press, so the three steps are called by hand.) */
const down = () => act(async () => handlers().onBegin({}));
const move = (x: number, y: number) => act(async () => handlers().onUpdate({ translationX: x, translationY: y }));
const up = (ok = true) => act(async () => handlers().onFinalize({}, ok));
const started = () => waitFor(() => expect(v.startRecording).toHaveBeenCalled());
/** Clock for the note length: the recorder starting moves it to `later`. */
const clock = (later: number) => {
  let t = 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => t);
  v.startRecording.mockImplementation(async () => { t = later; });
};

test('the button is a mic when the box is empty and a send arrow when there is text', async () => {
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  await wrap();
  expect(screen.getByTestId('search-mic')).toBeTruthy();
  expect(screen.getByTestId('icon-mic')).toBeTruthy();
  expect(screen.queryByTestId('search-go')).toBeNull();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa');
  expect(screen.getByTestId('search-go')).toBeTruthy();
  expect(screen.getByTestId('icon-send')).toBeTruthy();
  expect(screen.queryByTestId('icon-mic')).toBeNull();
  await fireEvent.changeText(screen.getByTestId('search-input'), '');
  expect(screen.queryByTestId('search-go')).toBeNull();
  expect(screen.getByTestId('icon-mic')).toBeTruthy();
});

test('a denied microphone explains and does not record', async () => {
  v.ensureMic.mockResolvedValue(false);
  await wrap();
  await down();
  await waitFor(() => expect(screen.getByTestId('voice-error')).toBeTruthy());
  expect(v.startRecording).not.toHaveBeenCalled();
});

test('hold, release, then the heard text is searched', async () => {
  v.ensureMic.mockResolvedValue(true);
  v.startRecording.mockResolvedValue(undefined);
  v.stopRecording.mockResolvedValue({ uri: 'file:///a.m4a', name: 'search.m4a', type: 'audio/mp4' });
  mocked.voiceToText.mockResolvedValue({ q: 'شقة في التجمع' });
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  clock(3000);
  await wrap();
  await down();
  await started();
  await up();
  await waitFor(() => expect(mocked.search).toHaveBeenCalledWith('شقة في التجمع', { drop: false, status: 'active' }));
});

test('sliding left past the line cancels and sends nothing', async () => {
  v.ensureMic.mockResolvedValue(true);
  v.startRecording.mockResolvedValue(undefined);
  mocked.voiceToText.mockClear();
  clock(3000);
  await wrap();
  await down();
  await move(-200, 0);
  await started();
  await up();
  await waitFor(() => expect(v.cancelRecording).toHaveBeenCalled());
  expect(mocked.voiceToText).not.toHaveBeenCalled();
});

test('sliding up locks the note, then send uploads it', async () => {
  v.ensureMic.mockResolvedValue(true);
  v.startRecording.mockResolvedValue(undefined);
  v.stopRecording.mockResolvedValue({ uri: 'file:///a.m4a', name: 'search.m4a', type: 'audio/mp4' });
  mocked.voiceToText.mockResolvedValue({ q: 'villa' });
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  clock(4000);
  await wrap();
  await down();
  await move(0, -100);
  await started();
  await up();
  await waitFor(() => expect(screen.getByTestId('search-bin')).toBeTruthy());
  expect(v.cancelRecording).not.toHaveBeenCalled();
  expect(mocked.voiceToText).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.search).toHaveBeenCalledWith('villa', { drop: false, status: 'active' }));
});

test('a quick tap never touches the microphone and shows the hold hint', async () => {
  v.ensureMic.mockResolvedValue(true);
  v.startRecording.mockResolvedValue(undefined);
  mocked.voiceToText.mockClear();
  await wrap();
  await down();
  await up();
  await act(async () => { await new Promise<void>((r) => setTimeout(() => r(), 300)); });
  expect(screen.getByTestId('search-hint')).toBeTruthy();
  expect(screen.getByText(/Hold to record|دوس مطوّل/)).toBeTruthy();
  expect(v.ensureMic).not.toHaveBeenCalled();
  expect(v.startRecording).not.toHaveBeenCalled();
  expect(mocked.voiceToText).not.toHaveBeenCalled();
});

test('leaving the app mid-note keeps it: stopped rail with bin and send, and send uploads it', async () => {
  v.ensureMic.mockResolvedValue(true);
  v.stopRecording.mockResolvedValue({ uri: 'file:///a.m4a', name: 'search.m4a', type: 'audio/mp4' });
  mocked.voiceToText.mockResolvedValue({ q: 'villa' });
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  let change: (s: string) => void = () => undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, h) => { change = h as (s: string) => void; return { remove: jest.fn() }; });
  clock(3000);
  await wrap();
  await down();
  await started();
  await waitFor(() => expect(screen.getByTestId('search-rail')).toBeTruthy());
  await act(async () => change('background'));
  await waitFor(() => expect(screen.getByTestId('search-bin')).toBeTruthy());
  expect(v.stopRecording).toHaveBeenCalledTimes(1);
  expect(mocked.voiceToText).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.voiceToText).toHaveBeenCalled());
  expect(v.stopRecording).toHaveBeenCalledTimes(1);
});

test('ignored words are shown under the results', async () => {
  mocked.search.mockResolvedValue({ status: 'results', source: 'parser', total: 1, items: [], ignoredTerms: ['xyz'], counts: { active: 1, sold: 0, archived: 0 } });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa xyz');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(screen.getByTestId('ignored-note')).toBeTruthy());
});

test('a guessed spelling is shown as "could not find, did you mean", and what the filters cannot say is listed', async () => {
  mocked.search.mockResolvedValue({ status: 'results', source: 'parser', total: 2, items: [], guesses: [{ typed: 'hyde', as: 'hyde park' }], unapplied: ['near the mall'], reading: 'apartment · Hyde Park', counts: { active: 2, sold: 0, archived: 0 } });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'apartment in hyde near the mall');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(screen.getByTestId('guess-note')).toBeTruthy());
  expect(screen.getByTestId('guess-note').props.children).toContain('hyde park');
  expect(screen.getByTestId('unapplied-note')).toBeTruthy();
});

test('Sold and Archived show their counts from the start and one tap searches them', async () => {
  const counts = { active: 3, sold: 2, archived: 0 };
  mocked.search.mockResolvedValueOnce({ status: 'results', source: 'parser', total: 3, items: [], unitStatus: 'active', counts });
  mocked.search.mockResolvedValueOnce({ status: 'none', source: 'parser', total: 2, items: [], unitStatus: 'sold', counts });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(screen.getByText(/Sold \(2\)|مباعة \(2\)/)).toBeTruthy());
  await fireEvent.press(screen.getByText(/Sold \(2\)|مباعة \(2\)/));
  await waitFor(() => expect(mocked.search).toHaveBeenLastCalledWith('villa', { drop: false, status: 'sold' }));
});

test('when AI credits are used up the results still come, with a note and a way to the unit filters', async () => {
  mocked.search.mockResolvedValue({ status: 'none', source: 'fallback', aiError: 'PLAN_QUOTA_EXCEEDED', total: 0, items: [] });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(screen.getByTestId('quick-reader-note')).toBeTruthy());
  expect(screen.getByTestId('quick-reader-units')).toBeTruthy();
});

test('no credits note when the AI simply was not needed', async () => {
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(screen.getByText(/No results|مفيش نتايج/)).toBeTruthy());
  expect(screen.queryByTestId('quick-reader-note')).toBeNull();
});
