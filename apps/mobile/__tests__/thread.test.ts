import type { AssistantQueryResponse } from '@wehdathub/shared';
import { contextOf, MAX_TURNS, threadReducer, type Turn } from '../src/assistant/thread';

const res = (over: Partial<AssistantQueryResponse> = {}): AssistantQueryResponse => ({ intent: 'unit_search', headline: 'h', cards: [], aiUsed: false, ...over });
const ask = (turns: Turn[], id: string, source: Turn['source'] = 'text') => threadReducer(turns, { type: 'ask', id, question: `q-${id}`, source });

test('ask appends a pending turn and resolve completes it', () => {
  let s = ask([], 'a');
  expect(s).toEqual([{ id: 'a', question: 'q-a', source: 'text', status: 'pending' }]);
  s = ask(s, 'b', 'chip');
  s = threadReducer(s, { type: 'resolve', id: 'a', response: res() });
  expect(s.map((t) => t.status)).toEqual(['done', 'pending']);
  expect(s[1].source).toBe('chip');
});

test('fail then retry goes pending again and clears the error', () => {
  let s = ask([], 'a');
  s = threadReducer(s, { type: 'fail', id: 'a', error: 'boom' });
  expect(s[0]).toMatchObject({ status: 'error', error: 'boom' });
  s = threadReducer(s, { type: 'retry', id: 'a' });
  expect(s[0].status).toBe('pending');
  expect(s[0].error).toBeUndefined();
  s = threadReducer(s, { type: 'resolve', id: 'a', response: res() });
  expect(s[0].status).toBe('done');
});

test('context comes from the last done turn and skips disambiguation, pending and failed turns', () => {
  const ctx = { job: 'units', areaQuery: 'التجمع' };
  let s = ask([], 'a');
  s = threadReducer(s, { type: 'resolve', id: 'a', response: res({ nextContext: ctx }) });
  s = ask(s, 'b');
  expect(contextOf(s)).toEqual(ctx);
  s = threadReducer(s, { type: 'resolve', id: 'b', response: res({ intent: 'disambiguate', nextContext: { job: 'x' } }) });
  expect(contextOf(s)).toEqual(ctx);
  s = ask(s, 'c');
  s = threadReducer(s, { type: 'fail', id: 'c', error: 'x' });
  expect(contextOf(s)).toEqual(ctx);
  s = ask(s, 'd');
  s = threadReducer(s, { type: 'resolve', id: 'd', response: res() });
  expect(contextOf(s)).toBeNull();
  expect(contextOf([])).toBeNull();
});

test('keeps only the last 20 turns', () => {
  let s: Turn[] = [];
  for (let i = 0; i < MAX_TURNS + 5; i += 1) s = ask(s, String(i));
  expect(s).toHaveLength(MAX_TURNS);
  expect(s[0].id).toBe('5');
  expect(s[MAX_TURNS - 1].id).toBe(String(MAX_TURNS + 4));
});

test('reset empties, restore only fills an empty thread, resolve of an unknown id is ignored', () => {
  const saved: Turn[] = [{ id: 'z', question: 'q', source: 'text', status: 'done', response: res() }];
  expect(threadReducer([], { type: 'restore', turns: saved })).toEqual(saved);
  const started = ask([], 'a');
  expect(threadReducer(started, { type: 'restore', turns: saved })).toBe(started);
  expect(threadReducer(started, { type: 'resolve', id: 'gone', response: res() })).toEqual(started);
  expect(threadReducer(started, { type: 'reset' })).toEqual([]);
});
