import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchScreen } from '../src/screens/SearchScreen';
import { useAuth } from '../src/auth';
import { ApiClientError, type ApiBroker, type SearchHomeData } from '@wehdathub/shared';
import { api } from '../src/api';
import * as voice from '../src/voice';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

const mockNavigate = jest.fn();
jest.mock('../src/api', () => ({ api: { me: jest.fn(), searchCredits: jest.fn().mockResolvedValue({ personal: { limit: null, remaining: null, used: 0 } }), search: jest.fn(), voiceToText: jest.fn(), ask: jest.fn(), askResults: jest.fn(), assistantQuery: jest.fn(), assignLead: jest.fn(), nudgeLead: jest.fn(), searchHome: jest.fn().mockResolvedValue({ hour: 9 }), overdueUnits: jest.fn(), today: jest.fn().mockResolvedValue({ counts: { followUpsToday: 0, viewings: 0, newLeads: 0 }, tasks: [], moreTasks: 0 }), leads: jest.fn().mockResolvedValue({ items: [], more: false, total: 0, offset: 0, limit: 20 }), leadCounts: jest.fn().mockResolvedValue({ counts: {} }), team: jest.fn().mockResolvedValue({ items: [] }) } }));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn(), startRecording: jest.fn(), stopRecording: jest.fn(), cancelRecording: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }), useIsFocused: () => true }));
const mocked = api as unknown as { search: jest.Mock; voiceToText: jest.Mock; ask: jest.Mock; askResults: jest.Mock; assistantQuery: jest.Mock; assignLead: jest.Mock; nudgeLead: jest.Mock };
const v = voice as unknown as { ensureMic: jest.Mock; startRecording: jest.Mock; stopRecording: jest.Mock; cancelRecording: jest.Mock };

const wrap = (client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })) =>
  render(<QueryClientProvider client={client}><SearchScreen /></QueryClientProvider>);

beforeEach(async () => { await AsyncStorage.clear(); useAuth.setState({ broker: { id: 'search-test', lang: 'en' } as ApiBroker }); jest.restoreAllMocks(); jest.clearAllMocks(); mockNavigate.mockReset(); v.startRecording.mockReset(); });

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
    expect(screen.queryByTestId('search-source')).toBeNull();
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

test.each(['villa', 'Primary apartments'])('a recent search supersedes pending transcription (%s)', async (query) => {
  await AsyncStorage.setItem('wehdathub.recentSearches:search-test', JSON.stringify([query]));
  v.ensureMic.mockResolvedValue(true);
  v.stopRecording.mockResolvedValue({ uri: 'file:///a.m4a', name: 'search.m4a', type: 'audio/mp4' });
  let finishTranscription!: (result: { q: string }) => void;
  mocked.voiceToText.mockReturnValueOnce(new Promise((resolve) => { finishTranscription = resolve; }));
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  mocked.ask.mockResolvedValue({ answer: 'Matching projects', found: true, lang: 'en' });
  mocked.askResults.mockResolvedValue({ projects: [] });
  clock(3000);
  await wrap();
  await down();
  await started();
  await up();
  await waitFor(() => expect(mocked.voiceToText).toHaveBeenCalled());
  await fireEvent.press(screen.getByTestId('search-tools'));
  await fireEvent.press(await screen.findByTestId('searchRecent1'));
  await screen.findByText(query === 'villa' ? /No results/ : 'Matching projects');
  await act(async () => finishTranscription({ q: 'stale transcript' }));

  expect(screen.getByTestId('search-input').props.value).toBe(query);
  expect(screen.getByTestId('search-go')).toBeEnabled();
  expect(mocked.search.mock.calls.map(([text]) => text)).toEqual(query === 'villa' ? [query] : []);
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
  // The thread shows a muted "+ 2 sold" line; one tap opens the Sold list.
  await waitFor(() => expect(screen.getByText(/\+ 2 sold|\+ 2 مباعة/)).toBeTruthy());
  await fireEvent.press(screen.getByText(/\+ 2 sold|\+ 2 مباعة/));
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
  // The conversation comes back after a restart; a new one shows the home again.
  await fireEvent.press(await screen.findByTestId('new-conversation'));
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

test('priorities use the Today endpoint when the brief route is unavailable', async () => {
  jest.mocked(api.searchHome).mockRejectedValueOnce(new ApiClientError(404, 'not_found'));
  jest.mocked(api.today).mockResolvedValueOnce({
    counts: { followUpsToday: 3, viewings: 1, newLeads: 0 },
    tasks: [{ kind: 'late', ref: 'L-1', name: null, at: null, unitCode: null, phone: null, matches: null }],
    moreTasks: 0,
  });
  const result = await wrap();
  await screen.findByTestId('home-late');
  expect(screen.getByTestId('home-calls')).toBeTruthy();
  expect(screen.queryByTestId('home-retry')).toBeNull();
  await result.unmount();
});

test('Search home shows each shared priority once and keeps its actions and other tasks', async () => {
  const ops = { unassigned: 2, uncontactedOld: 1, overdue: 3, team: true };
  const viewing = { kind: 'viewing', ref: 'L-1', name: 'Fixture viewing', at: '2026-11-23T16:00:00Z', unitCode: 'HP-1', phone: '201000000000', matches: null } as const;
  jest.mocked(api.searchHome).mockResolvedValueOnce({ hour: 9, ops, calls: 1, nextViewing: viewing });
  jest.mocked(api.today).mockResolvedValueOnce({
    counts: { followUpsToday: 2, viewings: 1, newLeads: 0 },
    tasks: [viewing, { kind: 'call', ref: 'L-2', name: 'Fixture call', at: null, unitCode: null, phone: null, matches: null }],
    cards: { ops, oldUnits: null, target: null, commissions: null, approvals: null },
    moreTasks: 0,
  });
  await wrap();
  await screen.findByTestId('home-viewing');
  expect(screen.getAllByText(/Fixture viewing/)).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Call' })).toBeTruthy();
  expect(screen.getByTestId('home-late')).toBeTruthy();
  expect(screen.getByTestId('home-calls')).toBeTruthy();
  expect(screen.getByText('Fixture call')).toBeTruthy();
  expect(screen.queryByTestId('today-card-info')).toBeNull();
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
    expect(screen.getByTestId('old-active-A-3')).toBeTruthy();
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

test('owner Search home renders server priorities in order, deduplicates Today cards, and routes each tap', async () => {
  const previous = useAuth.getState().broker;
  useAuth.setState({ broker: { id: 'owner-1', role: 'owner', name: 'Tarek', lang: 'en' } });
  jest.mocked(api.searchHome).mockResolvedValueOnce({
    hour: 10,
    waitingOver1h: 3,
    missingPhotos: 2,
    intake: { disconnected: 1, failed: 2 },
    approvals: { access: 1, names: 2 },
    commissions: { overdue: 1, registrations: 0 },
    leasesSoon: 2,
    priorities: [
      { id: 'waiting-over-1h', urgency: 'high', count: 3, action: { kind: 'queue', queue: 'waiting-over-1h' }, extra: { over24h: 1 } },
      { id: 'intake', urgency: 'high', count: 3, action: { kind: 'screen', screen: 'Sources' }, extra: { disconnected: 1, failed: 2 } },
      { id: 'approvals', urgency: 'medium', count: 1, action: { kind: 'screen', screen: 'Requests' } },
      { id: 'owner-names', urgency: 'medium', count: 2, action: { kind: 'screen', screen: 'Owners' } },
      { id: 'commissions', urgency: 'medium', count: 1, action: { kind: 'screen', screen: 'Commissions' }, extra: { overdue: 1, registrations: 0 } },
      { id: 'leases-soon', urgency: 'low', count: 2, action: { kind: 'screen', screen: 'Leases' } },
      { id: 'missing-photos', urgency: 'low', count: 2, action: { kind: 'units_missing_photos' } },
    ],
  });
  jest.mocked(api.today).mockResolvedValueOnce({
    counts: { followUpsToday: 0, viewings: 0, newLeads: 0 },
    tasks: [],
    moreTasks: 0,
    leases: [{ code: 'L-9', tenant: 'Tenant X', end: '2026-12-30', daysLeft: 20 }],
    cards: { oldUnits: null, target: null, ops: null, commissions: { overdue: 1, registrations: 0 }, approvals: { access: 1, names: 2 } },
  });
  try {
    const result = await wrap();
    await screen.findByTestId('home-waiting-1h');
    expect(screen.getByTestId('home-urgent-badge')).toBeTruthy();
    expect(screen.getByText('Includes 1 over 24h')).toBeTruthy();
    expect(screen.getByTestId('home-intake')).toBeTruthy();
    expect(screen.getByTestId('home-approvals')).toBeTruthy();
    expect(screen.getByTestId('home-owner-names')).toBeTruthy();
    expect(screen.getByTestId('home-commissions')).toBeTruthy();
    expect(screen.getByTestId('home-leases')).toBeTruthy();
    expect(screen.getByTestId('home-missing-photos')).toBeTruthy();
    // Overlapping Today cards/leases are deduplicated below.
    expect(screen.queryByTestId('today-leases')).toBeNull();
    expect(screen.queryByTestId('today-card-info')).toBeNull();
    expect(screen.queryByTestId('today-card-access')).toBeNull();
    expect(screen.queryByTestId('today-card-names')).toBeNull();
    expect(screen.queryByTestId('today-card-commissions')).toBeNull();

    await fireEvent.press(screen.getByTestId('home-intake'));
    expect(mockNavigate).toHaveBeenCalledWith('Sources');
    await fireEvent.press(screen.getByTestId('home-approvals'));
    expect(mockNavigate).toHaveBeenCalledWith('Requests');
    await fireEvent.press(screen.getByTestId('home-owner-names'));
    expect(mockNavigate).toHaveBeenCalledWith('Owners');
    await fireEvent.press(screen.getByTestId('home-missing-photos'));
    expect(mockNavigate).toHaveBeenCalledWith('UnitsList', { missingPhotos: true });

    await fireEvent.press(screen.getByTestId('home-commissions'));
    await waitFor(() => expect(api.assistantQuery).toHaveBeenCalledWith(expect.objectContaining({ q: 'Developer commissions due' })));
    await result.unmount();
  } finally {
    useAuth.setState({ broker: previous });
  }
});

test('progressive Try asking tips adapt by role, execute, and retire once tried or dismissed', async () => {
  const previous = useAuth.getState().broker;
  useAuth.setState({ broker: { id: 'tips-mgr', role: 'manager', name: 'Nour', lang: 'en' } });
  await AsyncStorage.removeItem('wehdathub.learnedTips:tips-mgr:manager');
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(['me'], {
    rights: { addUnits: true, editUnits: true, leads: true, search: true, team: true, owners: true, manager: true, agencyOwner: false, dataEntry: false, teamLead: false },
    nav: {
      role: 'manager',
      tabs: [],
      groups: [{ key: 'reports', label: { ar: '', en: '' }, items: [{ key: 'sources', app: 'Sources', icon: 'funnel', label: { ar: '', en: 'Sources' } }] }],
    },
  });
  try {
    const first = await wrap(client);
    expect(await screen.findByTestId('try-asking-card')).toBeTruthy();
    expect(screen.getByTestId('try-tip-mgr-overdue')).toBeTruthy();
    expect(screen.getByTestId('try-tip-mgr-team')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('try-tip-dismiss-mgr-overdue'));
    await waitFor(() => expect(screen.queryByTestId('try-tip-mgr-overdue')).toBeNull());
    // Next role tip rotates in once one is dismissed (mgr-dashboard always available, mgr-sources when allowed).
    expect(screen.getByTestId('try-tip-mgr-dashboard')).toBeTruthy();

    mocked.assistantQuery.mockResolvedValueOnce({ intent: 'crm_team', headline: 'Team activity', aiUsed: false, cards: [] });
    await fireEvent.press(screen.getByTestId('try-tip-mgr-team'));
    await waitFor(() => expect(mocked.assistantQuery).toHaveBeenCalledWith({ q: 'team workload', mode: 'auto', lang: 'en' }));
    await first.unmount();

    // Solo/team without Sources nav should omit plan-gated Sources tip.
    const gatedClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    gatedClient.setQueryData(['me'], {
      rights: { addUnits: true, editUnits: true, leads: true, search: true, team: false, owners: false, manager: true, agencyOwner: false, dataEntry: false, teamLead: false },
      nav: { role: 'owner', tabs: [], groups: [] },
    });
    await AsyncStorage.removeItem('wehdathub.thread.v1:tips-mgr'); // the earlier conversation would come back otherwise
    const gated = await wrap(gatedClient);
    await screen.findByTestId('try-asking-card');
    expect(screen.queryByTestId('try-tip-mgr-sources')).toBeNull();
    expect(screen.queryByTestId('try-tip-mgr-losses')).toBeNull();
    await gated.unmount();
  } finally {
    useAuth.setState({ broker: previous });
  }
});

test('composer supports multiline, hides mode trigger while typing, opens ComposerPopover with gated shortcuts & mode lock', async () => {
  const previous = useAuth.getState().broker;
  useAuth.setState({ broker: { id: 'pop-mgr', role: 'manager', name: 'Nour', lang: 'en' } });
  await AsyncStorage.setItem('wehdathub.recentSearches:pop-mgr', JSON.stringify(['villa in Mivida']));
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(['me'], {
    rights: { addUnits: true, editUnits: true, leads: true, search: true, team: true, owners: true, manager: true, agencyOwner: false, dataEntry: false, teamLead: false },
    nav: {
      role: 'manager',
      tabs: [],
      groups: [{ key: 'reports', label: { ar: '', en: '' }, items: [{ key: 'sources', app: 'Sources', icon: 'funnel', label: { ar: '', en: 'Sources' } }] }],
    },
  });
  try {
    const view = await wrap(client);
    const input = screen.getByTestId('search-input');
    expect(input.props.multiline).toBe(true);
    expect(input.props.submitBehavior).toBe('submit');
    expect(screen.getByTestId('search-mode-trigger')).toBeTruthy();

    await fireEvent.changeText(input, 'villa');
    expect(screen.queryByTestId('search-mode-trigger')).toBeNull();
    await fireEvent.changeText(input, '');
    expect(screen.getByTestId('search-mode-trigger')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('search-mode-trigger'));
    expect(await screen.findByTestId('composer-popover')).toBeTruthy();
    expect(screen.getByTestId('popover-mode-resale')).toBeTruthy();
    expect(screen.getByTestId('popover-mode-reports')).toBeTruthy();
    expect(screen.getByTestId('popover-shortcut-sources')).toBeTruthy();
    expect(screen.getByTestId('popover-recent-1')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('popover-mode-resale'));
    expect(screen.queryByTestId('composer-popover')).toBeNull();
    expect(screen.getByTestId('mode-lock-chip')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('mode-lock-clear'));
    expect(screen.queryByTestId('mode-lock-chip')).toBeNull();
    await view.unmount();

    // Non-manager broker without Sources nav hides Reports mode & Sources shortcut.
    useAuth.setState({ broker: { id: 'pop-brk', role: 'broker', name: 'Mina', lang: 'en' } });
    const brkClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    brkClient.setQueryData(['me'], {
      rights: { addUnits: true, editUnits: true, leads: true, search: true, team: false, owners: false, manager: false, agencyOwner: false, dataEntry: false, teamLead: false },
      nav: { role: 'broker', tabs: [], groups: [] },
    });
    const brkView = await wrap(brkClient);
    await fireEvent.press(screen.getByTestId('search-mode-trigger'));
    await screen.findByTestId('composer-popover');
    expect(screen.queryByTestId('popover-mode-reports')).toBeNull();
    expect(screen.queryByTestId('popover-shortcut-sources')).toBeNull();
    await brkView.unmount();
  } finally {
    useAuth.setState({ broker: previous });
  }
});

test('voice transcript emits voice_transcript_outcome telemetry cleanly without raw text', async () => {
  const usageMod = require('../src/usage') as typeof import('../src/usage');
  const spy = jest.spyOn(usageMod, 'usage');
  v.ensureMic.mockResolvedValue(true);
  v.startRecording.mockResolvedValue(undefined);
  v.stopRecording.mockResolvedValue({ uri: 'file:///a.m4a', name: 'search.m4a', type: 'audio/mp4' });
  mocked.voiceToText.mockResolvedValue({ q: 'villa in Zayed' });
  mocked.search.mockResolvedValue({ status: 'none', source: 'parser', total: 0, items: [] });
  clock(3000);
  await wrap();
  await down();
  await started();
  await up();
  await waitFor(() => expect(spy).toHaveBeenCalledWith('voice_transcript_outcome', true, undefined, { outcome: 'sent_as_is', mode: 'auto' }));
});

test('SearchScreen routes accountability & reports-mode queries via api.assistantQuery and falls back on 404', async () => {
  mocked.assistantQuery.mockResolvedValueOnce({
    intent: 'crm_discipline',
    headline: '1 silent broker(s)',
    aiUsed: false,
    cards: [
      {
        kind: 'broker_discipline',
        summary: { consistent: 1, lagging: 0, silent: 1, totalNoNextStep: 1, totalMissed: 0 },
        rows: [{ id: 'b1', name: 'Omar', leads: 3, contacted: 1, forward: 0, deals: 0, commission: 0, updates48h: 0, noNextStep: 1, missed: 0, discipline: 'silent', telegramLinked: true }],
      },
    ],
  });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'who is not updating leads?');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.assistantQuery).toHaveBeenCalledWith({ q: 'who is not updating leads?', mode: 'auto', lang: 'en' }));
  expect(await screen.findByTestId('card-broker-discipline')).toBeTruthy();

  // Legacy 404 fallback in resale mode falls back cleanly to api.search.
  mocked.assistantQuery.mockRejectedValueOnce(new ApiClientError(404, 'not_found'));
  mocked.search.mockResolvedValueOnce({ status: 'none', source: 'parser', total: 0, items: [] });
  await fireEvent.changeText(screen.getByTestId('search-input'), '');
  await fireEvent.press(screen.getByTestId('search-mode-trigger'));
  await fireEvent.press(await screen.findByTestId('popover-mode-resale'));
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.search).toHaveBeenCalledWith('villa', { drop: false, status: 'active' }));
});

test('legacy 404 fallback in auto mode routes known lead queue commands instead of inventory search', async () => {
  const previous = useAuth.getState().broker;
  useAuth.setState({ broker: { id: 'fb-mgr', role: 'manager', lang: 'en' } as ApiBroker });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['me'], {
    rights: { addUnits: true, editUnits: true, leads: true, search: true, team: true, owners: true, manager: true, agencyOwner: false, dataEntry: false, teamLead: false },
  });
  mocked.assistantQuery.mockRejectedValueOnce(new ApiClientError(404, 'not_found'));
  try {
    const view = await wrap(client);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'overdue follow-ups');
    await fireEvent.press(screen.getByTestId('search-go'));
    await waitFor(() => expect(api.leads).toHaveBeenCalledWith(expect.objectContaining({ queue: 'overdue' })));
    expect(mocked.search).not.toHaveBeenCalled();
    await view.unmount();
  } finally {
    useAuth.setState({ broker: previous });
  }
});

test('reverse-order stale 404 fallback from request A does not overwrite newer search B or recents', async () => {
  let rejectA!: (e: Error) => void;
  mocked.assistantQuery.mockImplementationOnce(() => new Promise((_, rej) => { rejectA = rej; }));
  mocked.search.mockResolvedValueOnce({ status: 'none', source: 'parser', total: 0, items: [] });

  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'waiting over 1h');
  await fireEvent.press(screen.getByTestId('search-go'));

  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa in zayed');
  await fireEvent(screen.getByTestId('search-input'), 'submitEditing');
  await waitFor(() => expect(screen.getByText(/No results|مفيش نتايج/)).toBeTruthy());

  await act(async () => {
    rejectA(new ApiClientError(404, 'not_found'));
  });
  expect(mocked.search).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/No results|مفيش نتايج/)).toBeTruthy();
});

test('lead update and stage change commands by name or phone route to SearchLeadAction without hitting assistant', async () => {
  const previous = useAuth.getState().broker;
  useAuth.setState({ broker: { id: 'brk-1', role: 'broker', lang: 'en' } as ApiBroker });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['me'], {
    rights: { addUnits: true, editUnits: true, leads: true, search: true, team: false, owners: false, manager: false, agencyOwner: false, dataEntry: false, teamLead: false },
  });
  try {
    const view = await wrap(client);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'Move 01012345678 to viewing');
    await fireEvent.press(screen.getByTestId('search-go'));
    await waitFor(() => expect(screen.getByText(/Review lead update|راجع تعديل العميل/)).toBeTruthy());
    expect(mocked.assistantQuery).not.toHaveBeenCalled();
    await view.unmount();
  } finally {
    useAuth.setState({ broker: previous });
  }
});

test('assistant >20 resale matches hydrate native FlashList, SaveSearchButton, status chips, and f+market continuation', async () => {
  const items = Array.from({ length: 20 }, (_, i) => ({
    id: `u-${i + 1}`,
    code: `RS-${i + 1}`,
    status: 'active',
    title: null,
    propertyType: 'apartment',
    dealType: 'sale',
    price: 4_000_000 + i * 10_000,
    priceText: null,
    area: 150,
    bedrooms: 3,
    bathrooms: 2,
    compound: 'Hyde Park',
    district: 'New Cairo',
    city: 'Cairo',
    finishing: null,
    photo: null,
  }));
  mocked.assistantQuery.mockResolvedValueOnce({
    intent: 'unit_search',
    headline: '23 unit(s) found',
    windowLabel: 'apartment · resale · Hyde Park',
    cards: [],
    actions: [{ kind: 'pivot_mode', mode: 'primary', label: 'Search Primary projects instead?' }],
    aiUsed: false,
    suggestPrimary: true,
    units: {
      status: 'results',
      source: 'parser',
      total: 23,
      counts: { active: 23, sold: 2, archived: 1 },
      marketLock: 'resale',
      sort: 'cheap',
      f: 'tok-resale-1',
      reading: 'apartment · resale · Hyde Park',
      items,
    },
  });
  mocked.search.mockResolvedValue({
    status: 'results',
    source: 'filter_token',
    total: 3,
    items: items.slice(0, 3).map((x, i) => ({ ...x, id: `u-sold-${i}`, code: `SLD-${i + 1}`, status: 'sold' })),
    counts: { active: 23, sold: 2, archived: 1 },
    f: 'tok-resale-1',
  });

  await wrap();
  await fireEvent.press(screen.getByTestId('search-mode-trigger'));
  await fireEvent.press(await screen.findByTestId('popover-mode-resale'));
  await fireEvent.changeText(screen.getByTestId('search-input'), 'apartment in hyde park');
  await fireEvent.press(screen.getByTestId('search-go'));

  await waitFor(() => expect(screen.getByTestId('save-search')).toBeTruthy());
  // The thread shows the top cards; "See all" opens the paged list with the status chips.
  await fireEvent.press(screen.getByTestId('see-all'));
  expect(screen.getByText('Sold (2)')).toBeTruthy();

  await act(async () => {
    await fireEvent(screen.getByTestId('search-results-list'), 'endReached');
  });
  await waitFor(() => expect(mocked.search).toHaveBeenCalledWith(
    'apartment in hyde park',
    expect.objectContaining({ offset: 20, f: 'tok-resale-1', market: 'resale', sort: 'cheap', status: 'active' }),
  ));

  await fireEvent.press(screen.getByText('Sold (2)'));
  await waitFor(() => expect(mocked.search).toHaveBeenLastCalledWith(
    'apartment in hyde park',
    expect.objectContaining({ status: 'sold', f: 'tok-resale-1', market: 'resale', sort: 'cheap' }),
  ));
});

test('assistant 0 resale matches stay in assistant view and offer Primary pivot', async () => {
  mocked.assistantQuery.mockResolvedValueOnce({
    intent: 'unit_search',
    headline: 'No matching Resale units found',
    cards: [],
    actions: [{ kind: 'pivot_mode', mode: 'primary', label: 'Search Primary projects instead?' }],
    aiUsed: false,
    suggestPrimary: true,
    units: { status: 'none', source: 'parser', total: 0, counts: { active: 0, sold: 0, archived: 0 }, marketLock: 'resale', items: [] },
  });
  await wrap();
  await fireEvent.press(screen.getByTestId('search-mode-trigger'));
  await fireEvent.press(await screen.findByTestId('popover-mode-resale'));
  await fireEvent.changeText(screen.getByTestId('search-input'), 'penthouse');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(screen.getByTestId('assistant-pivot-primary')).toBeTruthy());
  expect(screen.queryByTestId('save-search')).toBeNull();
});

test('reassigning a lead from assistant cards invalidates leads, lead detail, today, and dashboard caches', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invSpy = jest.spyOn(client, 'invalidateQueries');
  (api as unknown as { assignLead: jest.Mock }).assignLead.mockResolvedValueOnce({ lead: { id: 'l1', ref: 'L-0041' } });
  mocked.assistantQuery.mockResolvedValueOnce({
    intent: 'crm_leads',
    headline: '1 lead waiting',
    aiUsed: false,
    cards: [{
      kind: 'stuck_leads',
      queue: 'waiting-over-1h',
      total: 1,
      canAssign: true,
      canNudge: false,
      recommendedBrokers: [{ id: 'b2', name: 'Nour', open: 1 }],
      items: [{ ref: 'L-0041', name: 'Ali', stage: 'new', version: 4, assignee: 'Sara', assigneeId: 'b1', createdAt: null }],
    }],
  });

  await wrap(client);
  await fireEvent.changeText(screen.getByTestId('search-input'), 'waiting over 1h');
  await fireEvent.press(screen.getByTestId('search-go'));
  await fireEvent.press(await screen.findByTestId('assistant-reassign-L-0041-b2'));

  await waitFor(() => expect(invSpy).toHaveBeenCalledWith({ queryKey: ['leads'] }));
  expect(invSpy).toHaveBeenCalledWith({ queryKey: ['lead', 'L-0041'] });
  expect(invSpy).toHaveBeenCalledWith({ queryKey: ['today'] });
  expect(invSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
});

test('Solo owner ComposerPopover and SearchHome keep personal shortcuts/My stats and hide team-only prompts', async () => {
  const previous = useAuth.getState().broker;
  useAuth.setState({ broker: { id: 'solo-pop', role: 'owner', name: 'Hany', lang: 'en' } });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(['me'], {
    rights: { addUnits: true, editUnits: true, leads: true, search: true, team: false, owners: true, manager: true, agencyOwner: true, dataEntry: false, teamLead: false },
    workspace: { tier: 'solo', mode: 'solo', members: 1, solo: true, teamStyle: 'shared', analytics: false },
    nav: { role: 'owner', tabs: [], groups: [] },
  });
  try {
    const view = await wrap(client);
    await screen.findByTestId('try-asking-card');
    expect(screen.queryByTestId('try-tip-mgr-team')).toBeNull();
    expect(screen.queryByTestId('try-tip-mgr-sources')).toBeNull();
    expect(screen.queryByText(/Agency dashboard/)).toBeNull();

    await fireEvent.press(screen.getByTestId('search-mode-trigger'));
    expect(await screen.findByTestId('composer-popover')).toBeTruthy();
    expect(screen.getByTestId('popover-mode-reports')).toBeTruthy();
    expect(screen.getByTestId('popover-shortcut-overdue')).toBeTruthy();
    expect(screen.queryByTestId('popover-shortcut-discipline')).toBeNull();
    expect(screen.queryByTestId('popover-shortcut-waiting')).toBeNull();
    expect(screen.queryByTestId('popover-shortcut-sources')).toBeNull();
    await view.unmount();
  } finally {
    useAuth.setState({ broker: previous });
  }
});

test('assistant Change search restores original query for editing and View all markets deliberately broadens resale search', async () => {
  mocked.assistantQuery.mockResolvedValue({
    intent: 'unit_search',
    headline: '0 Resale units matched',
    aiUsed: false,
    suggestPrimary: true,
    understood: {
      job: 'find_units',
      market: 'resale',
      appliedFilters: ['Market: Resale', 'Area: Zayed'],
      unsupportedFilters: [],
    },
    cards: [],
    actions: [
      { kind: 'view_all_markets', label: 'View all markets' },
      { kind: 'pivot_mode', mode: 'primary', label: 'Search Primary projects' },
    ],
    units: { status: 'none', source: 'parser', total: 0, counts: { active: 0, sold: 0, archived: 0 }, marketLock: 'resale', items: [] },
  });
  mocked.search.mockResolvedValueOnce({ status: 'results', source: 'parser', total: 1, items: [{ id: 'u1', code: 'A-1', status: 'active', title: null, propertyType: 'apartment', dealType: 'sale', price: 3000000, priceText: null, area: 140, bedrooms: 3, bathrooms: 2, compound: 'Zayed', district: 'Sheikh Zayed', city: 'Giza', finishing: null, photo: null }], counts: { active: 1, sold: 0, archived: 0 } });

  await wrap();
  await fireEvent.press(screen.getByTestId('search-mode-trigger'));
  await fireEvent.press(await screen.findByTestId('popover-mode-resale'));
  await fireEvent.changeText(screen.getByTestId('search-input'), 'apartments in zayed');
  await fireEvent.press(screen.getByTestId('search-go'));

  expect(await screen.findByTestId('assistant-understood')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('assistant-change-search'));
  expect(screen.getByTestId('search-input').props.value).toBe('apartments in zayed');

  await fireEvent.press(screen.getByTestId('search-go'));
  // The first answer stays in the thread; act on the newest one.
  await waitFor(() => expect(screen.getAllByTestId('assistant-view-all-markets')).toHaveLength(2));
  await fireEvent.press(screen.getAllByTestId('assistant-view-all-markets')[1]);
  await waitFor(() => expect(mocked.search).toHaveBeenCalledWith(
    'apartments in zayed',
    expect.objectContaining({ drop: false, status: 'active' }),
  ));
  expect(mocked.search.mock.calls[0]?.[1]?.market).toBeUndefined();
});

test('assistant project results seed AskResults without duplicate page-1 askResults fetch and search refreshes credits', async () => {
  const proj = {
    id: 'p-seed',
    name: 'Mivida Gardens',
    name_en: 'Mivida Gardens',
    developer: 'Emaar',
    place: 'New Cairo',
    governorate: 'Cairo',
    status: 'selling',
    delivery: null,
    price_from: 5000000,
    facts: [],
    offers: [],
    offers_total: 0,
    free_text: 'Seeded note',
    client_text: 'Seeded note',
  };
  mocked.assistantQuery.mockResolvedValueOnce({
    intent: 'primary_answer',
    headline: '1 project matched',
    aiUsed: false,
    cards: [{ kind: 'text_answer', answer: 'Emaar answer', dataDates: null, found: true, source: 'local' }],
    projects: {
      chips: [],
      dropped: [],
      sort: 'best',
      total_projects: 1,
      total_options: 1,
      page: 1,
      pages: 1,
      per_page: 10,
      projects: [proj],
      token: 'tok-p',
      log_id: 'log-p',
    },
  });
  mocked.search.mockResolvedValueOnce({ status: 'none', source: 'parser', total: 0, items: [] });

  await wrap();
  await fireEvent.press(screen.getByTestId('search-mode-trigger'));
  await fireEvent.press(await screen.findByTestId('popover-mode-primary'));
  await fireEvent.changeText(screen.getByTestId('search-input'), 'Mivida Emaar');
  await fireEvent.press(screen.getByTestId('search-go'));

  expect(await screen.findByText('Mivida Gardens')).toBeTruthy();
  expect(mocked.askResults).not.toHaveBeenCalled();

  const creditsSpy = (api as unknown as { searchCredits: jest.Mock }).searchCredits;
  const before = creditsSpy.mock.calls.length;
  await fireEvent.press(screen.getByTestId('mode-lock-clear'));
  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(creditsSpy.mock.calls.length).toBeGreaterThan(before));
});

test.each([
  ['en', 'overdue leads', 'Market: Resale', 'Which market did you mean?'],
  ['ar', 'عملاء متأخرين', 'السوق: ريسيل', 'تقصد أنهي سوق؟'],
] as const)('paired %s assistant clarify preserves Change search without showing noResults', async (lang, query, filterLabel, headline) => {
  const prev = useAuth.getState().broker;
  useAuth.setState({ broker: { id: 'pair-test', lang } as ApiBroker });
  try {
    mocked.assistantQuery.mockResolvedValueOnce({
      intent: 'clarify',
      headline,
      aiUsed: false,
      understood: { job: 'find_units', market: 'resale', appliedFilters: [filterLabel], unsupportedFilters: [] },
      cards: [],
      actions: [{ kind: 'pivot_mode', mode: 'primary', label: lang === 'ar' ? 'ابحث في مشاريع المطورين' : 'Search developer projects' }],
    });
    const view = await wrap();
    await fireEvent.press(screen.getByTestId('search-mode-trigger'));
    await fireEvent.press(await screen.findByTestId('popover-mode-primary'));
    await fireEvent.changeText(screen.getByTestId('search-input'), query);
    await fireEvent.press(screen.getByTestId('search-go'));
    expect(await screen.findByTestId('assistant-understood')).toBeTruthy();
    expect(screen.getByText(filterLabel)).toBeTruthy();
    expect(screen.getByTestId('assistant-change-search')).toBeTruthy();
    expect(screen.queryByText(/No results|مفيش نتايج/)).toBeNull();
    view.unmount();
  } finally {
    useAuth.setState({ broker: prev });
  }
});

test('SearchScreen forwards assistant nextContext as previousContext on follow-up and resets it on clearChat', async () => {
  const ctx = { job: 'deals_report', market: 'resale' as const };
  mocked.assistantQuery
    .mockResolvedValueOnce({ intent: 'crm_deals', headline: '5 deals', aiUsed: false, cards: [], nextContext: ctx })
    .mockResolvedValueOnce({ intent: 'crm_deals', headline: '2 deals by Sara', aiUsed: false, cards: [], nextContext: ctx })
    .mockResolvedValueOnce({ intent: 'clarify', headline: 'Write full question', aiUsed: false, cards: [], nextContext: null });

  await wrap();
  await fireEvent.press(screen.getByTestId('search-mode-trigger'));
  await fireEvent.press(await screen.findByTestId('popover-mode-resale'));
  await fireEvent.changeText(screen.getByTestId('search-input'), 'resale deals');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.assistantQuery).toHaveBeenNthCalledWith(1, expect.objectContaining({ q: 'resale deals' })));

  await fireEvent.changeText(screen.getByTestId('search-input'), 'بس بتوع سارة');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.assistantQuery).toHaveBeenNthCalledWith(2, expect.objectContaining({ q: 'بس بتوع سارة', previousContext: ctx })));

  await fireEvent.press(screen.getByTestId('search-clear-chat'));
  await fireEvent.press(screen.getByTestId('search-mode-trigger'));
  await fireEvent.press(await screen.findByTestId('popover-mode-resale'));
  await fireEvent.changeText(screen.getByTestId('search-input'), 'بس بتوع سارة');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.assistantQuery).toHaveBeenCalledTimes(3));
  expect((mocked.assistantQuery.mock.calls[2][0] as { previousContext?: unknown }).previousContext).toBeUndefined();
});

test('voice confirm bar pauses ambiguous unit-code transcripts for edit before submitting, while clean transcripts run directly', async () => {
  (v.ensureMic as jest.Mock).mockResolvedValue(true);
  clock(2200);
  v.stopRecording.mockResolvedValue({ uri: 'file://a.m4a', type: 'audio/m4a', name: 'a.m4a' });
  mocked.voiceToText.mockResolvedValueOnce({ q: 'A 42' });
  mocked.search.mockResolvedValueOnce({ status: 'none', source: 'parser', total: 0, items: [] });

  await wrap();
  await down();
  await started();
  await move(0, 0);
  await up();

  expect(await screen.findByTestId('voice-confirm-bar')).toBeTruthy();
  expect(mocked.search).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByTestId('search-input'), 'villa in Mivida');
  await fireEvent.press(screen.getByTestId('voice-confirm-send'));
  await waitFor(() => expect(mocked.search).toHaveBeenCalledWith('villa in Mivida', expect.objectContaining({ drop: false, status: 'active' })));
  expect(screen.queryByTestId('voice-confirm-bar')).toBeNull();
});

test('auto mode routes contextual follow-ups and Wave 2/3 queries to assistant, resets on View all markets and non-assistant search, and resets card error state across queries', async () => {
  const ctx = { job: 'deals_report', market: 'resale' as const };
  mocked.assistantQuery
    .mockResolvedValueOnce({ intent: 'crm_deals', headline: '5 resale deals', aiUsed: false, cards: [], nextContext: ctx })
    .mockResolvedValueOnce({ intent: 'crm_deals', headline: '2 deals by Sara', aiUsed: false, cards: [], nextContext: ctx })
    .mockResolvedValueOnce({
      intent: 'crm_leads',
      headline: '1 lead',
      aiUsed: false,
      cards: [{
        kind: 'stuck_leads',
        queue: 'overdue',
        total: 1,
        canAssign: false,
        canNudge: true,
        items: [{ id: '1', ref: 'L-0042', name: 'Mona', assigneeId: 'b1', assignee: 'Sara', stage: 'new', minutesWaiting: 90, version: 1 }],
        recommendedBrokers: [],
      }],
    })
    .mockResolvedValueOnce({
      intent: 'crm_leads',
      headline: '1 lead retry',
      aiUsed: false,
      cards: [{
        kind: 'stuck_leads',
        queue: 'overdue',
        total: 1,
        canAssign: false,
        canNudge: true,
        items: [{ id: '1', ref: 'L-0042', name: 'Mona', assigneeId: 'b1', assignee: 'Sara', stage: 'new', minutesWaiting: 90, version: 1 }],
        recommendedBrokers: [],
      }],
    })
    .mockResolvedValueOnce({
      intent: 'unit_search',
      headline: '0 Resale units',
      aiUsed: false,
      cards: [],
      actions: [{ kind: 'view_all_markets', label: 'View all markets' }],
      units: { status: 'none', source: 'parser', total: 0, counts: { active: 0, sold: 0, archived: 0 }, marketLock: 'resale', items: [] },
    });
  mocked.nudgeLead.mockRejectedValueOnce(new Error('Nudge failed'));
  mocked.search.mockResolvedValueOnce({ status: 'none', source: 'parser', total: 0, items: [] });

  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'resale deals');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.assistantQuery).toHaveBeenNthCalledWith(1, expect.objectContaining({ q: 'resale deals', mode: 'auto' })));

  // Follow-up in auto mode must hit assistantQuery with previousContext
  await fireEvent.changeText(screen.getByTestId('search-input'), 'only by Sara');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.assistantQuery).toHaveBeenNthCalledWith(2, expect.objectContaining({ q: 'only by Sara', mode: 'auto', previousContext: ctx })));

  // Trigger inline error then new assistant response -> stale row error resets
  await fireEvent.changeText(screen.getByTestId('search-input'), 'approaching sla');
  await fireEvent.press(screen.getByTestId('search-go'));
  await fireEvent.press(await screen.findByTestId('assistant-nudge-L-0042'));
  expect(await screen.findByTestId('assistant-row-error-L-0042')).toBeTruthy();

  await fireEvent.changeText(screen.getByTestId('search-input'), 'approaching sla');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.assistantQuery).toHaveBeenCalledTimes(4));
  // The first answer stays in the thread with its own error; the new answer starts clean.
  expect(screen.getAllByTestId('assistant-row-error-L-0042')).toHaveLength(1);

  // View all markets resets mode to auto and strips explicit resale keyword
  await fireEvent.press(screen.getByTestId('search-clear-chat'));
  await fireEvent.press(screen.getByTestId('search-mode-trigger'));
  await fireEvent.press(await screen.findByTestId('popover-mode-resale'));
  await fireEvent.changeText(screen.getByTestId('search-input'), 'resale villa in zayed');
  await fireEvent.press(screen.getByTestId('search-go'));
  await fireEvent.press(await screen.findByTestId('assistant-view-all-markets'));
  await waitFor(() => expect(mocked.search).toHaveBeenCalledWith('villa in zayed', expect.objectContaining({ drop: false, status: 'active' })));
  expect(screen.queryByTestId('mode-lock-chip')).toBeNull();
});

test('searching unassigned leads in Arabic or English routes to assistantQuery instead of SearchLeads', async () => {
  jest.clearAllMocks();
  const mocked = api as jest.Mocked<typeof api>;
  mocked.assistantQuery.mockResolvedValue({
    intent: 'crm_leads',
    headline: 'Unassigned leads · 1',
    cards: [{ kind: 'stuck_leads', queue: 'unassigned', total: 1, recommendedBrokers: [], canAssign: false, canNudge: false, items: [] }],
    actions: [],
    links: [],
    aiUsed: false,
  });

  await wrap();
  await fireEvent.changeText(screen.getByTestId('search-input'), 'عملاء من غير وسيط');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.assistantQuery).toHaveBeenCalledWith(expect.objectContaining({ q: 'عملاء من غير وسيط' })));
  expect(screen.queryByTestId('search-lead-lookup')).toBeNull();

  await fireEvent.press(screen.getByTestId('search-clear-chat'));
  await fireEvent.changeText(screen.getByTestId('search-input'), 'without broker');
  await fireEvent.press(screen.getByTestId('search-go'));
  await waitFor(() => expect(mocked.assistantQuery).toHaveBeenCalledWith(expect.objectContaining({ q: 'without broker' })));
  expect(screen.queryByTestId('search-lead-lookup')).toBeNull();
});
