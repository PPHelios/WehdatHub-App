import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchScreen } from '../src/screens/SearchScreen';
import { api } from '../src/api';
import * as voice from '../src/voice';

jest.mock('../src/api', () => ({ api: { search: jest.fn(), voiceToText: jest.fn() } }));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn(), startRecording: jest.fn(), stopRecording: jest.fn(), cancelRecording: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
const mocked = api as unknown as { search: jest.Mock; voiceToText: jest.Mock };
const v = voice as unknown as { ensureMic: jest.Mock; startRecording: jest.Mock; stopRecording: jest.Mock; cancelRecording: jest.Mock };

const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><SearchScreen /></QueryClientProvider>);

beforeEach(() => jest.clearAllMocks());

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

const at = (x: number, y = 0) => ({ nativeEvent: { pageX: x, pageY: y } });
const hold = async (x = 0) => {
  await fireEvent(screen.getByTestId('search-mic'), 'responderGrant', at(0));
  if (x) await fireEvent(screen.getByTestId('search-mic'), 'responderMove', at(x));
};
const letGo = () => fireEvent(screen.getByTestId('search-mic'), 'responderRelease', at(0));

test('a denied microphone explains and does not record', async () => {
  v.ensureMic.mockResolvedValue(false);
  await wrap();
  await hold();
  await waitFor(() => expect(screen.getByTestId('voice-error')).toBeTruthy());
  expect(v.startRecording).not.toHaveBeenCalled();
});

test('hold, release, then the heard text is searched', async () => {
  v.ensureMic.mockResolvedValue(true);
  v.startRecording.mockResolvedValue(undefined);
  v.stopRecording.mockResolvedValue({ uri: 'file:///a.m4a', name: 'search.m4a', type: 'audio/mp4' });
  mocked.voiceToText.mockResolvedValue({ q: 'شقة في التجمع' });
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  const now = jest.spyOn(Date, 'now');
  now.mockReturnValue(1000);
  await wrap();
  await hold();
  await waitFor(() => expect(v.startRecording).toHaveBeenCalled());
  now.mockReturnValue(3000);
  await letGo();
  await waitFor(() => expect(mocked.search).toHaveBeenCalledWith('شقة في التجمع', { drop: false, status: 'active' }));
  now.mockRestore();
});

test('sliding away cancels and sends nothing', async () => {
  v.ensureMic.mockResolvedValue(true);
  v.startRecording.mockResolvedValue(undefined);
  mocked.voiceToText.mockClear();
  const now = jest.spyOn(Date, 'now');
  now.mockReturnValue(1000);
  await wrap();
  await hold(200);
  await waitFor(() => expect(v.startRecording).toHaveBeenCalled());
  now.mockReturnValue(3000);
  await letGo();
  await waitFor(() => expect(v.cancelRecording).toHaveBeenCalled());
  expect(mocked.voiceToText).not.toHaveBeenCalled();
  now.mockRestore();
});

test('a very short hold asks to hold longer', async () => {
  v.ensureMic.mockResolvedValue(true);
  v.startRecording.mockResolvedValue(undefined);
  await wrap();
  await hold();
  await waitFor(() => expect(v.startRecording).toHaveBeenCalled());
  await letGo();
  await waitFor(() => expect(screen.getByTestId('voice-error')).toBeTruthy());
});

test('ignored words are shown under the results', async () => {
  mocked.search.mockResolvedValue({ status: 'results', source: 'parser', total: 1, items: [], ignoredTerms: ['xyz'], counts: { active: 1, sold: 0, archived: 0 } });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa xyz');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(screen.getByTestId('ignored-note')).toBeTruthy());
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
