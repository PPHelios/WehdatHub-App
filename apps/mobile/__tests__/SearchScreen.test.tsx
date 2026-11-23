import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchScreen } from '../src/screens/SearchScreen';
import { useAuth } from '../src/auth';
import type { ApiBroker, SearchHomeData } from '@wehdathub/shared';
import { api } from '../src/api';
import * as voice from '../src/voice';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

jest.mock('../src/api', () => ({ api: { searchCredits: jest.fn().mockResolvedValue({ personal: { limit: null, remaining: null, used: 0 } }), search: jest.fn(), voiceToText: jest.fn(), ask: jest.fn(), askResults: jest.fn(), searchHome: jest.fn().mockResolvedValue({ hour: 9 }), overdueUnits: jest.fn(), today: jest.fn().mockResolvedValue({ counts: { followUpsToday: 0, viewings: 0, newLeads: 0 }, tasks: [], moreTasks: 0 }) } }));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn(), startRecording: jest.fn(), stopRecording: jest.fn(), cancelRecording: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }), useIsFocused: () => true }));
const mocked = api as unknown as { search: jest.Mock; voiceToText: jest.Mock; ask: jest.Mock; askResults: jest.Mock };
const v = voice as unknown as { ensureMic: jest.Mock; startRecording: jest.Mock; stopRecording: jest.Mock; cancelRecording: jest.Mock };

const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><SearchScreen /></QueryClientProvider>);

beforeEach(() => { useAuth.setState({ broker: { id: 'search-test', lang: 'en' } as ApiBroker }); jest.restoreAllMocks(); jest.clearAllMocks(); v.startRecording.mockReset(); });

test('typed search shows the no-results state with a way forward', async () => {
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(screen.getByText(/No results|مفيش نتايج/)).toBeTruthy());
  expect(mocked.search).toHaveBeenCalledWith('villa', { drop: false, status: 'active' });
});

test.each([
  ['en', 'Primary apartments in New Cairo'],
  ['ar', 'برايمري شقق في القاهرة الجديدة'],
] as const)('a primary request uses Ask instead of inventory (%s)', async (lang, text) => {
  const broker = useAuth.getState().broker;
  useAuth.setState({ broker: { id: 'search-test', lang } as ApiBroker });
  try {
    mocked.ask.mockResolvedValue({ answer: 'Matching projects', found: true, lang });
    mocked.askResults.mockResolvedValue({ projects: [] });
    const result = await wrap();
    await fireEvent.changeText(screen.getByTestId('search-input'), text);
    await fireEvent.press(screen.getByTestId('search-go'));
    await waitFor(() => expect(screen.getByText('Matching projects')).toBeTruthy());
    await waitFor(() => expect(screen.getByText(lang === 'ar' ? 'مفيش مشروع بالبحث ده.' : 'No project matches this search.')).toBeTruthy());
    expect(mocked.ask).toHaveBeenCalledWith(text);
    expect(mocked.search).not.toHaveBeenCalled();
    await result.unmount();
  } finally {
    useAuth.setState({ broker });
  }
});

test('a Primary keyword does not opt the next unmarked request into Ask', async () => {
  mocked.ask.mockResolvedValue({ answer: 'Matching projects', found: true, lang: 'en' });
  mocked.askResults.mockResolvedValue({ projects: [] });
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'Primary apartments');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(screen.getByText('Matching projects')).toBeTruthy());
  await fireEvent.changeText(screen.getByTestId('search-input'), 'Developer apartments');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.search).toHaveBeenCalledWith('Developer apartments', { drop: false, status: 'active' }));
  expect(mocked.ask).toHaveBeenCalledTimes(1);
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

test('samples show when there are no recent searches, then the last searches replace them', async () => {
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  await AsyncStorage.removeItem('wehdathub.recentSearches:search-test'); // earlier tests searched too
  const first = await wrap();
  await fireEvent.press(screen.getByTestId('search-tools'));
  expect(screen.getByTestId('searchExample1')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('search-input'), ' villa ');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.search).toHaveBeenCalled());
  await first.unmount();
  await wrap();
  await fireEvent.press(screen.getByTestId('search-tools'));
  await waitFor(() => expect(screen.getByTestId('searchRecent1')).toBeTruthy());
  expect(screen.getByText('villa')).toBeTruthy();
  expect(screen.queryByTestId('searchExample1')).toBeNull();
});

test('clear chat resets the composer and removes local recent searches', async () => {
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.search).toHaveBeenCalled());
  await fireEvent.press(screen.getByTestId('search-clear-chat'));
  expect(screen.getByTestId('search-input').props.value).toBe('');
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('wehdathub.recentSearches:search-test');
});

test.each([
  ['en', 'Good evening, Sara', 'Units overdue for an update'],
  ['ar', 'مساء الخير يا Sara', 'وحدات محتاجة تحديث'],
] as const)('data entry home shows the total and the oldest three units in %s', async (lang, greeting, heading) => {
  const previous = useAuth.getState().broker;
  useAuth.setState({ broker: { id: 'entry', role: 'data_entry', name: 'Sara Hassan', lang } });
  const items = ['A-1', 'A-2', 'A-3', 'A-4'].map((code, index) => ({ code, line: 'Apartment', days: 50 - index, hidden: false }));
  jest.mocked(api.searchHome).mockResolvedValueOnce({ hour: 20, completed: 2, units: { total: 4, items: items.slice(0, 3) } } satisfies SearchHomeData);
  jest.mocked(api.overdueUnits).mockResolvedValueOnce({ total: 4, items });
  try {
    const result = await wrap();
    await screen.findByTestId('home-overdue-total');
    expect(screen.getByText(greeting)).toBeTruthy();
    expect(screen.getByText(heading)).toBeTruthy();
    expect(screen.getByTestId('home-unit-A-3')).toBeTruthy();
    expect(screen.queryByTestId('home-unit-A-4')).toBeNull();
    await fireEvent.press(screen.getByTestId('home-all-units'));
    await screen.findByTestId('home-unit-A-4');
    await fireEvent.press(screen.getByTestId('home-back'));
    expect(screen.queryByTestId('home-unit-A-4')).toBeNull();
    await result.unmount();
  } finally {
    useAuth.setState({ broker: previous });
  }
});

test.each([
  ['broker', 'en', 'practice-sara-4321', 'practice-match'],
  ['team_lead', 'ar', 'practice-broker-sara', 'practice-lead-2'],
  ['manager', 'ar', 'practice-assign', 'practice-unassigned-count'],
  ['owner', 'en', 'practice-bar-2', 'practice-deal-3'],
  ['data_entry', 'ar', 'practice-confirm', 'DEMO-04'],
] as const)('practice completes locally as %s in %s', async (role, lang, action, resultId) => {
  const previous = useAuth.getState().broker;
  useAuth.setState({ broker: { id: `practice-${role}`, role, name: 'Sara Hassan', lang } });
  try {
    const result = await wrap();
    await fireEvent.press(await screen.findByTestId('practice-start'));
    await fireEvent.press(screen.getByTestId('practice-example'));
    await fireEvent.press(screen.getByTestId('practice-go'));
    await fireEvent.press(await screen.findByTestId(action));
    expect(await screen.findByTestId(resultId)).toBeTruthy();
    expect(mocked.search).not.toHaveBeenCalled();
    expect(mocked.ask).not.toHaveBeenCalled();
    expect(mocked.voiceToText).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('practice-done'));
    expect(await screen.findByTestId('search-home')).toBeTruthy();
    expect(screen.queryByTestId('practice-start')).toBeNull();
    await fireEvent.press(screen.getByTestId('search-tools'));
    expect(screen.getByTestId('practice-replay')).toBeTruthy();
    await result.unmount();
  } finally {
    useAuth.setState({ broker: previous });
  }
});

test('Search home shows the original Today tasks automatically and keeps its composer', async () => {
  jest.mocked(api.today).mockResolvedValueOnce({
    counts: { followUpsToday: 1, viewings: 0, newLeads: 0 },
    tasks: [{ ref: 'L-0001', name: 'Fixture follow-up', kind: 'call', at: null, unitCode: null, phone: null, matches: null }],
    moreTasks: 0,
  });
  await wrap();
  expect(await screen.findByText('Fixture follow-up')).toBeTruthy();
  expect(screen.getByTestId('today-details')).toBeTruthy();
  expect(screen.getByTestId('search-input')).toBeTruthy();
});
