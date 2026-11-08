import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchScreen } from '../src/screens/SearchScreen';
import { api } from '../src/api';
import * as voice from '../src/voice';

jest.mock('../src/api', () => ({ api: { search: jest.fn(), voiceToText: jest.fn() } }));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn(), startRecording: jest.fn(), stopRecording: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
const mocked = api as unknown as { search: jest.Mock; voiceToText: jest.Mock };
const v = voice as unknown as { ensureMic: jest.Mock; startRecording: jest.Mock; stopRecording: jest.Mock };

const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><SearchScreen /></QueryClientProvider>);

beforeEach(() => jest.clearAllMocks());

test('typed search shows the no-results state with a way forward', async () => {
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(screen.getByText(/No results|مفيش نتايج/)).toBeTruthy());
  expect(mocked.search).toHaveBeenCalledWith('villa', { drop: false });
});

test('an ask lets the broker search without the unknown words', async () => {
  mocked.search.mockResolvedValueOnce({ status: 'ask', source: 'parser', total: 0, items: [], ask: { terms: ['xyz'], withoutTotal: 4 } });
  mocked.search.mockResolvedValueOnce({ status: 'none', source: 'parser', total: 0, items: [] });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa xyz');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(screen.getByText('xyz')).toBeTruthy());
  await fireEvent.press(screen.getByText(/Search without them|ابحث من غيرها/));
  await waitFor(() => expect(mocked.search).toHaveBeenLastCalledWith('villa xyz', { drop: true }));
});

test('a denied microphone explains and does not record', async () => {
  v.ensureMic.mockResolvedValue(false);
  await wrap();
  await fireEvent.press(screen.getByTestId('search-mic'));
  await waitFor(() => expect(screen.getByTestId('voice-error')).toBeTruthy());
  expect(v.startRecording).not.toHaveBeenCalled();
});

test('record, stop, then the heard text is searched', async () => {
  v.ensureMic.mockResolvedValue(true);
  v.startRecording.mockResolvedValue(undefined);
  v.stopRecording.mockResolvedValue({ uri: 'file:///a.m4a', name: 'search.m4a', type: 'audio/mp4' });
  mocked.voiceToText.mockResolvedValue({ q: 'شقة في التجمع' });
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  await wrap();
  await fireEvent.press(screen.getByTestId('search-mic'));
  await waitFor(() => expect(v.startRecording).toHaveBeenCalled());
  await fireEvent.press(screen.getByTestId('search-mic'));
  await waitFor(() => expect(mocked.search).toHaveBeenCalledWith('شقة في التجمع', { drop: false }));
});
