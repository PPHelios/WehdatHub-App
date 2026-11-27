import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiClientError, type ApiBroker, type AssistantQueryResponse } from '@wehdathub/shared';
import { api } from '../src/api';
import { useAuth } from '../src/auth';
import { useAssistantThread } from '../src/assistant/useAssistantThread';

jest.mock('../src/api', () => ({ api: { assistantQuery: jest.fn(), search: jest.fn(), ask: jest.fn(), searchCredits: jest.fn(), assistantFeedback: jest.fn() } }));
const mocked = api as unknown as Record<'assistantQuery' | 'search' | 'ask' | 'assistantFeedback', jest.Mock>;
const KEY = 'wehdathub.thread.v1:b1';

const unit = (id: string) => ({ id, code: id } as never);
const units = (ids: string[], total = 50) => ({ status: 'ok', source: 'parser', total, items: ids.map(unit) });
const answer = (over: Partial<AssistantQueryResponse> = {}): AssistantQueryResponse => ({ intent: 'unit_search', headline: 'h', cards: [], aiUsed: false, units: units(['u1', 'u2']) as never, ...over });
const deferred = <T,>() => { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const notFound = () => new ApiClientError(404, 'NOT_FOUND');

const setup = async (brokerId: string | null = 'b1') => {
  const onIntent = jest.fn();
  const onRemember = jest.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
  const hook = await renderHook(() => useAssistantThread({ brokerId, lang: 'en', onIntent, onRemember }), { wrapper });
  return { ...hook, onIntent, onRemember };
};
const ask = (h: Awaited<ReturnType<typeof setup>>, q: string) => act(async () => { h.result.current.send(q, { source: 'text', mode: 'resale' }); });

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mocked.search.mockResolvedValue(units(['s1']));
  mocked.assistantFeedback.mockResolvedValue(undefined);
  useAuth.setState({ broker: { id: 'b1', lang: 'en' } as ApiBroker });
});

test('retry of a failed turn asks the same question again on the same turn', async () => {
  mocked.assistantQuery.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(answer());
  const h = await setup();
  await ask(h, 'villa in zayed');
  await waitFor(() => expect(h.result.current.turns[0]?.status).toBe('error'));
  const id = h.result.current.turns[0].id;
  await act(async () => { h.result.current.retry(id); });
  await waitFor(() => expect(h.result.current.turns[0].status).toBe('done'));
  expect(h.result.current.turns).toHaveLength(1);
  expect(h.result.current.turns[0]).toMatchObject({ id, question: 'villa in zayed', error: undefined });
  expect(mocked.assistantQuery.mock.calls.map((c) => c[0].q)).toEqual(['villa in zayed', 'villa in zayed']);
});

test('a stale 404 from an older question does not start its search; a retry does', async () => {
  const first = deferred<AssistantQueryResponse>();
  mocked.assistantQuery.mockReturnValueOnce(first.promise).mockResolvedValueOnce(answer());
  const h = await setup();
  await ask(h, 'old question');
  await ask(h, 'new question');
  await act(async () => { first.reject(notFound()); });
  await waitFor(() => expect(h.result.current.turns[0].status).toBe('error'));
  expect(mocked.search).not.toHaveBeenCalledWith('old question', expect.anything());
  mocked.assistantQuery.mockRejectedValueOnce(notFound());
  await act(async () => { h.result.current.retry(h.result.current.turns[0].id); });
  await waitFor(() => expect(mocked.search).toHaveBeenCalledWith('old question', expect.anything()));
  await waitFor(() => expect(h.result.current.turns[0].status).toBe('done'));
});

test('a response that lands after a reset is dropped', async () => {
  const slow = deferred<AssistantQueryResponse>();
  mocked.assistantQuery.mockReturnValueOnce(slow.promise);
  const h = await setup();
  await ask(h, 'villa');
  await act(async () => { h.result.current.reset(); });
  await act(async () => { slow.resolve(answer()); });
  expect(h.result.current.turns).toEqual([]);
});

describe('See all paging', () => {
  const openList = async () => {
    mocked.assistantQuery.mockResolvedValueOnce(answer());
    const h = await setup();
    await ask(h, 'villa');
    await waitFor(() => expect(h.result.current.turns[0].status).toBe('done'));
    await act(async () => { h.result.current.openFull(h.result.current.turns[0]); });
    expect(h.result.current.full?.done).toBe(false);
    return h;
  };

  test('a second loadMore while one is in flight is ignored and the page is added once', async () => {
    const h = await openList();
    const page = deferred<unknown>();
    mocked.search.mockReturnValueOnce(page.promise);
    // onEndReached can fire twice in one frame, before React re-renders.
    await act(async () => { const { loadMore } = h.result.current; loadMore(); loadMore(); });
    expect(mocked.search).toHaveBeenCalledTimes(1);
    expect(mocked.search).toHaveBeenCalledWith('villa', expect.objectContaining({ offset: 2 }));
    await act(async () => { page.resolve(units(['u3', 'u4'])); });
    await waitFor(() => expect(h.result.current.full?.loadingMore).toBe(false));
    expect(h.result.current.full?.extra.map((u) => u.id)).toEqual(['u3', 'u4']);
  });

  test('repeated rows are not added twice and a page with nothing new ends the list', async () => {
    const h = await openList();
    mocked.search.mockResolvedValueOnce(units(['u2', 'u3']));
    await act(async () => { await h.result.current.loadMore(); });
    expect(h.result.current.full?.extra.map((u) => u.id)).toEqual(['u3']);
    mocked.search.mockResolvedValueOnce(units(['u3']));
    await act(async () => { await h.result.current.loadMore(); });
    expect(h.result.current.full?.done).toBe(true);
    await act(async () => { await h.result.current.loadMore(); });
    expect(mocked.search).toHaveBeenCalledTimes(2);
  });

  test('a page that lands after a reset is dropped', async () => {
    const h = await openList();
    const page = deferred<unknown>();
    mocked.search.mockReturnValueOnce(page.promise);
    await act(async () => { h.result.current.loadMore(); });
    await act(async () => { h.result.current.reset(); });
    await act(async () => { page.resolve(units(['u3'])); });
    expect(h.result.current.full).toBeNull();
  });
});

describe('saved thread', () => {
  const textAnswer = (text: string) => answer({ units: undefined, cards: [{ kind: 'text_answer', answer: text } as never] });
  const saved = JSON.stringify([{ id: 'old', question: 'saved q', source: 'text', status: 'done', response: textAnswer('a') }]);

  test('restores what was saved', async () => {
    await AsyncStorage.setItem(KEY, saved);
    const h = await setup();
    await waitFor(() => expect(h.result.current.turns.map((x) => x.id)).toEqual(['old']));
  });

  test('a restore that lands late does not overwrite a newer question', async () => {
    const read = deferred<string | null>();
    jest.spyOn(AsyncStorage, 'getItem').mockReturnValueOnce(read.promise);
    mocked.assistantQuery.mockResolvedValueOnce(answer());
    const h = await setup();
    await ask(h, 'fresh');
    await waitFor(() => expect(h.result.current.turns[0]?.status).toBe('done'));
    await act(async () => { read.resolve(saved); });
    expect(h.result.current.turns.map((x) => x.question)).toEqual(['fresh']);
  });

  test('only inventory answers are saved; lead answers never reach the phone', async () => {
    mocked.assistantQuery.mockResolvedValueOnce(textAnswer('ok')).mockResolvedValueOnce({ ...textAnswer('Ahmed 0100'), intent: 'lead_lookup' });
    const h = await setup();
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
    await ask(h, 'zayed');
    await ask(h, 'ahmed lead');
    await waitFor(() => expect(h.result.current.turns.every((x) => x.status === 'done')).toBe(true));
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
    const stored = JSON.parse(String((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)![1]));
    expect(stored.map((x: { question: string }) => x.question)).toEqual(['zayed']);
    expect(JSON.stringify(stored)).not.toContain('Ahmed');
  });

  test('signing out removes the saved thread', async () => {
    const store = AsyncStorage as unknown as Record<string, unknown>;
    store.getAllKeys = jest.fn(async () => [KEY, 'other']);
    store.removeMany = jest.fn(async () => undefined);
    await useAuth.getState().signOut();
    expect(store.removeMany).toHaveBeenCalledWith([KEY]);
  });
});

test('a thumbs-down is sent once with the reason and marks the turn rated', async () => {
  mocked.assistantQuery.mockResolvedValueOnce(answer({ modeUsed: 'resale' }));
  const h = await setup();
  await ask(h, 'villa');
  await waitFor(() => expect(h.result.current.turns[0].status).toBe('done'));
  const id = h.result.current.turns[0].id;
  await act(async () => { h.result.current.rate(id, 'wrong'); });
  await act(async () => { h.result.current.rate(id, 'other'); });
  expect(h.result.current.turns[0].rated).toBe(true);
  expect(mocked.assistantFeedback).toHaveBeenCalledTimes(1);
  expect(mocked.assistantFeedback).toHaveBeenCalledWith({ q: 'villa', lang: 'en', intent: 'unit_search', route: 'resale', verdict: 'down', reason: 'wrong' });
});
