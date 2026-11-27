import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type ApiUnitListItem, type AssistantContext, type AssistantMode, type AssistantQueryResponse, type Lang, type SearchResult, type UnitStatus, type VoiceFile } from '@wehdathub/shared';
import { api } from '../api';
import { errorText } from '../errors';
import { parseSearchIntent, type SearchIntent } from '../searchCapabilities';
import { timed, usage } from '../usage';
import { track } from '../analytics';
import { needsVoiceConfirm } from '../voiceConfirm';
import { shouldUseAssistantEndpoint } from './routing';
import { contextOf, persistableTurns, PERSISTED_TURNS, threadReducer, type Turn, type TurnSource } from './thread';

const THREAD_KEY = 'wehdathub.thread.v1';
const MAX_PERSISTED_CHARS = 400000;

type SearchParams = { drop: boolean; status: UnitStatus; f?: string | null; market?: 'resale' | 'primary' | null; sort?: string | null };
type Req = { gen: number; q: string; kind: 'assistant' | 'search' | 'primary'; mode: AssistantMode; context: AssistantContext | null; search: SearchParams };

/** The full list behind "See all": paged results for one query, one status at a time. */
export interface FullList {
  turnId: string;
  q: string;
  params: SearchParams;
  data: SearchResult | null;
  extra: ApiUnitListItem[];
  pending: boolean;
  error: string | null;
  loadingMore: boolean;
  done: boolean;
}

const asTurnResponse = (units: SearchResult): AssistantQueryResponse => ({ intent: 'unit_search', headline: '', cards: [], aiUsed: false, units });

export function useAssistantThread({ brokerId, lang, onIntent, onRemember }: {
  brokerId?: string | null;
  lang: Lang;
  /** A request that is a report view (leads, deals...) rather than a chat answer. */
  onIntent: (intent: SearchIntent, clean: string) => void;
  onRemember: (clean: string) => void;
}) {
  const queries = useQueryClient();
  const [turns, dispatch] = useReducer(threadReducer, [] as Turn[]);
  const [full, setFull] = useState<FullList | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const generation = useRef(0);
  const reqs = useRef(new Map<string, Req>());
  const seq = useRef(0);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const key = brokerId ? `${THREAD_KEY}:${brokerId}` : null;
  const hydrated = useRef<string | null>(null);
  /** Set once the broker acts, so a slow restore never lands on top of a newer thread. */
  const dirty = useRef(false);
  const moreInFlight = useRef(false);
  const refreshCredits = () => { queries.invalidateQueries({ queryKey: ['search-credits'] }); };

  /** The one reset: new conversation, the Home tab, back button, and a different signed-in broker. */
  const reset = useCallback(() => {
    generation.current += 1;
    dirty.current = true;
    moreInFlight.current = false;
    reqs.current.clear();
    dispatch({ type: 'reset' });
    setFull(null);
    setTranscribing(false);
    setVoiceError(null);
  }, []);

  useEffect(() => {
    let active = true;
    reset();
    dirty.current = false;
    hydrated.current = null;
    if (!key) return undefined;
    AsyncStorage.getItem(key).then((raw) => {
      if (!active) return;
      hydrated.current = key;
      if (dirty.current) return;
      const saved: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(saved)) dispatch({ type: 'restore', turns: saved.filter((x): x is Turn => Boolean(x) && typeof x.id === 'string' && x.status === 'done' && Boolean(x.response)) });
    }).catch(() => { if (active) hydrated.current = key; });
    return () => { active = false; hydrated.current = null; };
  }, [key, reset]);

  useEffect(() => {
    if (!key || hydrated.current !== key) return;
    let kept = persistableTurns(turns).slice(-PERSISTED_TURNS);
    let json = JSON.stringify(kept);
    while (json.length > MAX_PERSISTED_CHARS && kept.length > 1) { kept = kept.slice(1); json = JSON.stringify(kept); }
    (kept.length ? AsyncStorage.setItem(key, json) : AsyncStorage.removeItem(key)).catch(() => undefined);
  }, [key, turns]);

  const execute = async (id: string) => {
    const req = reqs.current.get(id);
    if (!req) return;
    const alive = () => reqs.current.get(id) === req;
    const fail = (e: unknown) => { if (alive()) dispatch({ type: 'fail', id, error: errorText(e, lang) }); };
    try {
      if (req.kind === 'primary') {
        const a = await api.ask(req.q);
        if (alive()) dispatch({ type: 'resolve', id, response: { intent: 'primary_answer', headline: '', cards: [{ kind: 'text_answer', answer: a.answer, dataDates: a.dataDates ?? null, found: a.found, source: a.source ?? 'ai' }], aiUsed: false } });
      } else if (req.kind === 'search') {
        const { drop, status, f, market, sort } = req.search;
        const started = Date.now();
        track('search_started');
        const units = await timed('search', () => api.search(req.q, { drop, status, ...(f ? { f } : {}), ...(market ? { market } : {}), ...(sort ? { sort } : {}) })).catch((e) => { track('search_run', { outcome: 'error', duration_ms: Date.now() - started }); throw e; });
        track('search_run', { outcome: units.status, duration_ms: Date.now() - started });
        if (alive()) dispatch({ type: 'resolve', id, response: asTurnResponse(units) });
      } else {
        const res = await api.assistantQuery({ q: req.q, mode: req.mode, lang, ...(req.context ? { previousContext: req.context } : {}) });
        if (!alive()) return;
        usage('assistant_query_run', true, undefined, { mode: req.mode });
        if (res.intent === 'unit_search' && res.units && (res.units.items.length > 0 || res.units.status === 'ask')) onRemember(req.q);
        dispatch({ type: 'resolve', id, response: res });
      }
    } catch (e) {
      // An older server has no assistant endpoint: fall back to the built-in parser.
      const missing = req.kind === 'assistant' && (typeof api.assistantQuery !== 'function' || (e instanceof ApiClientError && (e.status === 404 || e.status === 501)));
      if (!missing) { fail(e); return; }
      if (!alive()) return;
      // A newer question was asked while this one waited: do not start an older search behind it.
      if (req.gen !== generation.current) { fail(e); return; }
      if (req.mode === 'auto') {
        const intent = parseSearchIntent(req.q);
        if (intent.kind !== 'search' && !(intent.kind === 'source' && intent.source === 'primary')) {
          dispatch({ type: 'discard', id });
          reqs.current.delete(id);
          onIntent(intent, req.q);
          return;
        }
        req.kind = intent.kind === 'source' ? 'primary' : 'search';
      } else req.kind = req.mode === 'primary' ? 'primary' : 'search';
      if (req.kind === 'search') onRemember(req.q);
      await execute(id);
    } finally {
      refreshCredits();
    }
  };

  const start = (q: string, source: TurnSource, req: Omit<Req, 'q' | 'context' | 'gen'>) => {
    const id = `${Date.now().toString(36)}-${(seq.current += 1)}`;
    reqs.current.set(id, { ...req, q, gen: generation.current, context: contextOf(turnsRef.current) });
    dispatch({ type: 'ask', id, question: q, source });
    execute(id);
  };

  /** A new question: a chat turn, or a report view through `onIntent`. */
  const send = (q: string, o: { source: TurnSource; mode: AssistantMode; report?: 'leads' | 'deals'; forceSearch?: boolean }) => {
    const clean = q.trim();
    if (!clean) return;
    generation.current += 1;
    dirty.current = true;
    setTranscribing(false);
    setVoiceError(null);
    setFull(null);
    const search: SearchParams = { drop: false, status: 'active' };
    if (!o.forceSearch && shouldUseAssistantEndpoint(clean, o.mode, Boolean(contextOf(turnsRef.current)))) { start(clean, o.source, { kind: 'assistant', mode: o.mode, search }); return; }
    const intent: SearchIntent = o.forceSearch ? { kind: 'search' } : parseSearchIntent(clean, o.report);
    if (intent.kind === 'search' || intent.kind === 'source') {
      const primary = intent.kind === 'source' && intent.source === 'primary';
      if (!primary) onRemember(clean);
      start(clean, o.source, { kind: primary ? 'primary' : 'search', mode: o.mode, search });
      return;
    }
    onIntent(intent, clean);
  };

  /** Asks the same question again; `change` re-runs a unit search differently (for example without the unknown words). */
  const retry = (id: string, change?: Partial<SearchParams>) => {
    const req = reqs.current.get(id);
    if (!req) return;
    req.gen = generation.current;
    if (change) { req.search = { ...req.search, ...change }; req.kind = 'search'; }
    dispatch({ type: 'retry', id });
    execute(id);
  };

  const fetchFull = (f: FullList, offset?: number) => {
    const { drop, status, f: token, market, sort } = f.params;
    return api.search(f.q, { drop, status, ...(offset ? { offset } : {}), ...(token ? { f: token } : {}), ...(market ? { market } : {}), ...(sort ? { sort } : {}) });
  };
  const loadFull = async (next: FullList) => {
    const gen = generation.current;
    try {
      const data = await timed('search', () => fetchFull(next));
      if (gen === generation.current) setFull((cur) => (cur && cur.turnId === next.turnId ? { ...cur, data, pending: false, error: null, done: data.items.length >= data.total } : cur));
    } catch (e) {
      if (gen === generation.current) setFull((cur) => (cur ? { ...cur, pending: false, error: errorText(e, lang) } : cur));
    } finally { refreshCredits(); }
  };

  /** Opens the full list for a turn, optionally on another status (Sold, Archived). */
  const openFull = (turn: Turn, status?: UnitStatus) => {
    const units = turn.response?.units;
    if (!units) return;
    const req = reqs.current.get(turn.id);
    const market = units.marketLock ?? (req?.mode === 'resale' ? 'resale' : undefined);
    const params: SearchParams = { drop: req?.search.drop ?? false, status: status ?? units.unitStatus ?? 'active', ...(units.f ? { f: units.f } : {}), ...(market ? { market } : {}), ...(units.sort ? { sort: units.sort } : {}) };
    const same = params.status === (units.unitStatus ?? 'active');
    const next: FullList = { turnId: turn.id, q: turn.question, params, data: same ? { ...units, counts: units.counts ?? turn.response?.statusCounts } : null, extra: [], pending: !same, error: null, loadingMore: false, done: same && units.items.length >= units.total };
    setFull(next);
    if (!same) loadFull(next);
  };
  const setFullStatus = (status: UnitStatus) => {
    if (!full) return;
    const next: FullList = { ...full, params: { ...full.params, status }, extra: [], pending: true, error: null, done: false };
    setFull(next);
    loadFull(next);
  };
  const rerunFull = () => { if (full) { const next = { ...full, pending: true, error: null }; setFull(next); loadFull(next); } };
  const loadMore = async () => {
    if (!full || !full.data || full.loadingMore || full.done || moreInFlight.current) return;
    moreInFlight.current = true;
    const gen = generation.current;
    const cur = full;
    setFull({ ...cur, loadingMore: true });
    try {
      const r = await fetchFull(cur, cur.data!.items.length + cur.extra.length);
      if (gen === generation.current) {
        setFull((f) => {
          if (!f || f.turnId !== cur.turnId || f.params.status !== cur.params.status) return f;
          const seen = new Set([...(f.data?.items ?? []), ...f.extra].map((u) => u.id));
          const fresh = r.items.filter((u) => !seen.has(u.id));
          return { ...f, loadingMore: false, done: !fresh.length, extra: [...f.extra, ...fresh] };
        });
      }
    } catch (e) {
      if (gen === generation.current) { setFull((f) => (f && f.turnId === cur.turnId && f.params.status === cur.params.status ? { ...f, loadingMore: false, done: true } : f)); setVoiceError(errorText(e, lang)); }
    } finally { moreInFlight.current = false; }
  };

  /** Voice note to text. `confirm` means the words look risky and the broker should check them before they run. */
  const transcribe = async (file: VoiceFile, mode: AssistantMode): Promise<{ text: string; confirm: boolean } | null> => {
    const gen = generation.current;
    setTranscribing(true);
    setVoiceError(null);
    try {
      const { q } = await api.voiceToText(file);
      if (gen !== generation.current) return null;
      const text = (q ?? '').trim();
      usage('voice_transcript_outcome', Boolean(text), undefined, { outcome: text ? 'sent_as_is' : 'empty', mode });
      refreshCredits();
      return { text, confirm: Boolean(text) && needsVoiceConfirm(text).confirm };
    } catch (e) {
      usage('voice_transcript_outcome', false, undefined, { outcome: 'error', mode });
      if (gen === generation.current) setVoiceError(errorText(e, lang));
      return null;
    } finally {
      if (gen === generation.current) setTranscribing(false);
    }
  };

  const busy = turns.some((x) => x.status === 'pending') || Boolean(full?.pending || full?.loadingMore);
  return { turns, full, busy, transcribing, voiceError, setVoiceError, send, retry, reset, openFull, closeFull: () => setFull(null), setFullStatus, rerunFull, loadMore, transcribe };
}
