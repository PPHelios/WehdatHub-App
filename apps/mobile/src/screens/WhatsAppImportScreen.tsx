import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { AppText as Text } from '../components/AppText';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import { ApiClientError, PlanLockedError, displayPhone, looksLikePhone, ltr, contactPhoneSchema } from '@wehdathub/shared';
import { usePlanLock } from '../planLock';
import { usePlanState } from '../planState';
import { phoneHelp } from '../readback';
import type { ChatPlanChange, ChatPlanPost, CodeState, UnitFields, UploadFile } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang, useAuth } from '../auth';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { enter, layout } from '../motion';
import { Field } from '../components/Field';
import { SmartImage } from '../components/SmartImage';
import { placeLabel } from '../unitBoxRules';
import { ALL_TYPES, FINISHING, FURNISHING, labelOf } from '../unitOptions';
import type { RootStackParams } from '../navigation';
import { toggleKeep } from '../photos';
import { uploadPhoto } from '../photoUpload';
import { withRetries } from '../retry';
import { compressAhead, compressPhotos } from '../compress';
import { reportError } from '../errorReport';
import { useRights } from '../rights';
import { newSaveKey, withSaveCheck } from '../saveKey';
import { useSelectionHighlight } from '../components/SelectionHighlight';
import { greenGradient, radius, spacing, useTheme } from '../theme';
import { usage } from '../usage';
import { sendable, withImpliedFeatures } from '../unitRules';
import {
  applyPlanPatch, buildImportPosts, changesOf, codeBadge, countInRange, importCounts, incomplete, keptOf, kindOf, lacksDealType, lacksOwnerPhone,
  loadAttached, looksLikeZip, missingFor, missingOf, planPosts, postTime, resolveRange, saveAttached, savable, stagePct,
  updatePhotoRoom, withDealType, withDefaultTicks, withImpliedOwner, withOwnerPhone, withPlan, withTextPhoneOnly,
} from '../whatsappImport';
import type { ChatInfo, CodeBadge, ImportPost, SinceKind } from '../whatsappImport';
import { fill, wi } from '../whatsappImportText';
import { applyMemory, diffDecisions, forgetAll, load as loadMemory, record as recordMemory, restore as restoreMemory } from '../whatsappImportMemory';
import type { Memory, Outcome } from '../whatsappImportMemory';
import { ZipImportError, cancelUnpack, cleanUp, openChat, readChat } from '../zipImport';
import { toast } from '../components/Toast';

/** Photos drawn per card before the "+N" chip (the rest load when it is tapped). */
const THUMB_CAP = 8;
const Gap = () => <View style={styles.sep} />;

type Nav = NativeStackNavigationProp<RootStackParams>;
type Phase = 'pick' | 'range' | 'reading' | 'review';
type Stage = 'list' | 'chat' | 'photos' | 'match' | 'codes';
type Opened = Awaited<ReturnType<typeof openChat>>;

const nonEmpty = (f: UnitFields): UnitFields => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v !== undefined && v !== null)) as UnitFields;
const utcDay = (ms: number | null) => (ms === null ? '' : new Date(ms).toISOString().slice(0, 10));

/**
 * A WhatsApp "Export chat" zip, read on the phone: the person picks the period, then the posts with their photos, the codes checked
 * against the agency's units, a unit per post that can be added at once or opened in the add-unit screen to edit, pick its 15 photos
 * and put them in order.
 */
export function WhatsAppImportScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const W = wi(lang);
  const J = lang === 'en' ? ', ' : '، ';
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParams, 'WhatsAppImport'>>();
  const rights = useRights();
  const allowed = rights.manager || rights.agencyOwner || rights.dataEntry;
  const brokerId = String(useAuth.getState().broker?.id ?? 'me');
  const planState = usePlanState();
  useEffect(() => {
    if (planState.phase === 'readonly') {
      usePlanLock.getState().show(new PlanLockedError('plan_readonly'));
      if (nav.canGoBack()) nav.goBack();
    }
  }, [planState.phase, nav]);

  const [zipName, setZipName] = useState<string>(route.params?.zip?.name ?? '');
  const [phase, setPhase] = useState<Phase>('pick');
  const [pct, setPct] = useState(0);
  const [stage, setStage] = useState<Stage>('list');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<ChatInfo | null>(null);
  const [lastImportAt, setLastImportAt] = useState<string | null>(null);
  const [kind, setKind] = useState<SinceKind>('30');
  const rangeSelection = useSelectionHighlight(kind, greenGradient);
  const [sinceText, setSinceText] = useState('');
  const [untilText, setUntilText] = useState('');
  const [rangeError, setRangeError] = useState<'since' | 'until' | 'order' | null>(null);
  const [list, setList] = useState<ImportPost[]>([]);
  const [videos, setVideos] = useState(0);
  const [missing, setMissing] = useState(0);
  const [truncated, setTruncated] = useState<{ shown: number; total: number; date: string } | null>(null);
  const [codes, setCodes] = useState<Record<string, CodeState> | null>(null);
  const [codeStatus, setCodeStatus] = useState<'checking' | 'done' | 'failed'>('checking');
  const [adding, setAdding] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [openText, setOpenText] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState(0);
  const [saveTotal, setSaveTotal] = useState(0);
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [result, setResult] = useState<{ saved: number; created: number; updated: number; unchanged: string[]; failed: number; photosFailed: string[] } | null>(null);
  // What was decided about this chat's posts in earlier imports (see whatsappImportMemory).
  const [priorSaved, setPriorSaved] = useState<ImportPost[]>([]);
  const [showPrior, setShowPrior] = useState(false);
  const [memCount, setMemCount] = useState(0);
  const [forgotNote, setForgotNote] = useState(false);
  const [earlierN, setEarlierN] = useState(0);
  const [moreOpen, setMoreOpen] = useState<Record<string, boolean>>({});
  // The confirm sheet (save, forget, leave): what it says and what its action does.
  const [ask, setAsk] = useState<{ title: string; body?: string; cancel: string; go: string; destructive?: boolean; onGo: () => void } | null>(null);
  const memory = useRef<Memory>({});
  const noRecord = useRef(false);
  const dir = useRef<string | null>(null);
  const started = useRef(false);
  const stopped = useRef(false);
  const unmounted = useRef(false);
  const opened = useRef<Opened | null>(null);
  const signal = useRef<{ cancelled: boolean }>({ cancelled: false });
  const stageRef = useRef<Stage>('list');
  const savingRef = useRef(false);
  const loop = useRef<Promise<void> | null>(null);
  const photoFails = useRef<string[]>([]);

  const patchPost = useCallback((id: string, change: Partial<ImportPost>) => setList((l) => l.map((p) => (p.id === id ? { ...p, ...change } : p))), []);
  const setPhotos = useCallback((id: string, fn: (photos: UploadFile[]) => UploadFile[]) => setList((l) => l.map((p) => (p.id === id ? { ...p, photos: fn(p.photos) } : p))), []);
  const goStage = (s: Stage) => { stageRef.current = s; setStage(s); };

  // The zip stays open while the screen is open. Closing waits for a save in progress (it is told to stop), then removes the photos and the zip copy.
  useEffect(() => () => {
    unmounted.current = true;
    stopped.current = true;
    signal.current.cancelled = true;
    const o = opened.current;
    opened.current = null;
    const d = dir.current;
    void (loop.current ?? Promise.resolve()).catch(() => undefined).then(async () => {
      cancelUnpack();
      if (o) await o.close().catch(() => undefined);
      await cleanUp(d);
    });
  }, []);

  const reasonText = (e: unknown) => {
    const r = e instanceof ZipImportError ? e.reason : 'failed';
    return r === 'not_zip' ? W.errNotZip : r === 'password' ? W.errPassword : r === 'too_big' ? W.errBig : r === 'no_space' ? W.errSpace : r === 'no_chat' ? W.errNoChat : r === 'cancelled' ? W.errCancelled : W.errFailed;
  };

  // A zip that arrives (shared from WhatsApp, or picked) is only opened: the person picks the period before anything is read.
  const openZip = useCallback(async (file: UploadFile) => {
    setError(null);
    setZipName(file.name);
    setPhase('reading');
    setPct(0);
    goStage('list');
    stopped.current = false;
    const previous = opened.current;
    opened.current = null;
    if (previous) await previous.close().catch(() => undefined);
    signal.current = { cancelled: false };
    const t0 = Date.now();
    try {
      const o = await openChat(file.uri, { signal: signal.current, onPct: (p: number) => setPct((cur) => Math.max(cur, p)) });
      if (unmounted.current) { await o.close().catch(() => undefined); return; }
      opened.current = o;
      // What the agency decided about this chat before (and when it was last imported) comes from the server.
      const remembered = await loadMemory(o.info.fingerprint);
      memory.current = remembered.decisions;
      noRecord.current = false;
      setInfo(o.info);
      setLastImportAt(remembered.lastImportAt);
      setKind(remembered.lastImportAt ? 'last' : '30');
      setRangeError(null);
      setPhase('range');
    } catch (e) {
      usage('wa_import_read', false, Date.now() - t0, { reason: e instanceof ZipImportError ? e.reason : 'unexpected', stage: stageRef.current });
      if (!(e instanceof ZipImportError)) reportError(e, 'WhatsAppImport.open');
      setPhase('pick');
      setError(reasonText(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, brokerId]);

  const read = useCallback(async () => {
    const o = opened.current;
    if (!o) return;
    const r = resolveRange({ kind, sinceText, untilText }, lastImportAt);
    if (!r.ok) { setRangeError(r.error); return; }
    setRangeError(null);
    setError(null);
    setPhase('reading');
    setPct(0);
    goStage('list');
    stopped.current = false;
    signal.current = { cancelled: false };
    const d = dir.current;
    dir.current = null;
    await cleanUp(d);
    const t0 = Date.now();
    const sinceKind: SinceKind = kind;
    try {
      const out = await readChat(o, { since: r.since ?? null, until: r.until ?? null, withMedia: true, signal: signal.current, onPct: (p: number, s: 'list' | 'chat' | 'photos' | 'match') => { setPct((cur) => Math.max(cur, p)); goStage(s); } });
      dir.current = out.dir;
      const posts = buildImportPosts(out.posts, out.dir, out.present);
      setVideos(out.skipped);
      const cut = Number((out.stats as { truncated?: number } | undefined)?.truncated ?? 0);
      const lastAt = posts.length ? postTime(posts[posts.length - 1].post, true) : null;
      setTruncated(cut > 0 ? { shown: posts.length, total: posts.length + cut, date: utcDay(lastAt) } : null);
      usage('wa_import_read', true, Date.now() - t0, { posts: posts.length, photos: posts.reduce((n, p) => n + p.photos.length, 0), videos: out.skipped, stage: 'done', since_kind: sinceKind });
      setMissing(out.missing);
      if (!posts.length) { setList([]); setPhase('range'); return setError(W.noPosts); }
      // The codes the posts write are checked once, in one call, before the list opens: update, new or taken.
      goStage('codes');
      setPct(stagePct('codes', 0));
      setCodeStatus('checking');
      const wanted = [...new Set(posts.map((p) => p.post.code).filter(Boolean))] as string[];
      let codeMap: Record<string, CodeState> | null = {};
      let codeState: 'checking' | 'done' | 'failed' = 'done';
      if (wanted.length) {
        const tc = Date.now();
        try {
          const rc = await api.codeCheck(wanted);
          usage('wa_import_codes', true, Date.now() - tc, { count: wanted.length });
          codeMap = rc.codes;
          setCodes(rc.codes);
          setCodeStatus('done');
        } catch {
          usage('wa_import_codes', false, Date.now() - tc, { count: wanted.length });
          codeMap = null;
          codeState = 'failed';
          setCodes(null);
          setCodeStatus('failed');
        }
      } else {
        setCodes({});
        setCodeStatus('done');
      }
      // Every post is read by the server's rules reader (the same one as the website's import: no AI, no credits), so the list
      // shows a summary and what is still missing, and a post that lacks a mandatory field is not added until it is edited.
      const tr = Date.now();
      try {
        const rd = await api.chatRead(posts.map((p) => p.post.text));
        rd.posts.forEach((rp, k) => { if (posts[k]) { posts[k].fields = withTextPhoneOnly(rp.fields, posts[k].post.orig || posts[k].post.text); posts[k].missing = rp.missing; } });
        setReadFailed(false);
        usage('wa_import_reader', true, Date.now() - tr, { posts: posts.length, incomplete: posts.filter(incomplete).length });
      } catch {
        setReadFailed(true);
        usage('wa_import_reader', false, Date.now() - tr, { posts: posts.length });
      }
      // What each post does to the agency's units (new, update, unchanged, another unit's, older...) is the server's plan. A post that
      // could not be planned is an error when it is an update (could not compare), never an update.
      const plans = await planPosts((b) => api.chatPlan(b), posts);
      plans.forEach((a, k) => { posts[k] = withPlan(posts[k], a); });
      setPct(100);
      setResult(null);
      const ticked = withDefaultTicks(posts, posts.map((_, i) => codeBadge(posts, i, codeMap, codeState)));
      const applied = applyMemory(ticked, memory.current);
      setMemCount(Object.keys(memory.current).length);
      setForgotNote(false);
      setShowPrior(false);
      setMoreOpen({});
      setPriorSaved(applied.priorSaved);
      setEarlierN(applied.list.filter((x) => x.discarded).length);
      setList(applied.list);
      setPhase('review');
    } catch (e) {
      // Why it failed (a zip problem, or something unexpected that is also reported as an error) goes to the usage log.
      usage('wa_import_read', false, Date.now() - t0, { reason: e instanceof ZipImportError ? e.reason : 'unexpected', stage: stageRef.current, since_kind: sinceKind });
      if (!(e instanceof ZipImportError)) reportError(e, 'WhatsAppImport.read');
      setPhase('range');
      setError(reasonText(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, sinceText, untilText, lastImportAt, lang]);

  // Fix many posts at once: one deal type for the posts that have none, or one owner phone for the posts that lack it. Each changed
  // post is checked again by the server's review, so what it still misses is shown on its card and it is added only when complete.
  const [ownerAll, setOwnerAll] = useState('');
  const [ownerBad, setOwnerBad] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNote, setBulkNote] = useState<string | null>(null);
  const bulkCount = { deal: list.filter(lacksDealType).length, owner: list.filter(lacksOwnerPhone).length };
  const applyBulk = async (change: (f: UnitFields) => UnitFields, which: (p: ImportPost) => boolean) => {
    const targets = list.filter(which);
    if (!targets.length) return;
    setBulkBusy(true);
    try {
      for (const p of targets) {
        const fields = change(p.fields ?? {});
        let missing: string[] | undefined = p.missing;
        try {
          // A post whose code is an existing unit is an update: it is reviewed as that unit's edit, so its own code is not "taken".
          const existing = p.post.code && codes?.[p.post.code]?.state === 'update' ? p.post.code : undefined;
          const rv = await api.reviewUnit(sendable(withImpliedFeatures(nonEmpty(fields))), keptOf(p).length, existing);
          missing = missingOf(rv.blockers);
        } catch { /* the card keeps its old list; Edit checks it again */ }
        patchPost(p.id, { fields, missing, note: undefined, ...(p.blocker === 'invalid' ? { blocker: undefined } : {}) });
      }
      setBulkNote(fill(W.bulkDone, { n: targets.length }));
      usage('wa_import_bulk', true, undefined, { posts: targets.length });
    } finally {
      setBulkBusy(false);
    }
  };

  // A zip shared from WhatsApp is opened at once (the period is chosen next).
  useEffect(() => {
    if (started.current || !allowed || !route.params?.zip) return;
    started.current = true;
    void openZip(route.params.zip);
  }, [allowed, openZip, route.params?.zip]);

  // An edited post that was saved in the add-unit screen comes back here marked as added.
  useEffect(() => {
    const s = route.params?.saved;
    if (s) { patchPost(s.id, { state: 'saved', savedCode: s.code, note: undefined, missing: undefined }); usage('wa_import_edit', true, undefined, { outcome: 'saved' }); }
  }, [route.params?.saved, patchPost]);

  const choose = async () => {
    try {
      const [f] = await pick({ type: [types.zip, types.allFiles] });
      if (!f) return;
      if (!looksLikeZip({ name: f.name, type: f.type })) return setError(W.errNotZip);
      void openZip({ uri: f.uri, name: f.name || 'chat.zip', type: 'application/zip' });
    } catch (e) {
      if (!(isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED)) setError(W.errFailed);
    }
  };

  const badges = useMemo(() => list.map((_, i) => codeBadge(list, i, codes, codeStatus)), [list, codes, codeStatus]);
  const listRef = useRef(list);
  listRef.current = list;
  const badgesRef = useRef(badges);
  badgesRef.current = badges;
  // Only the posts still to decide are listed (virtualized: the cards and their photo strips are made for what is on screen).
  // View filter only: it never touches discarded, ticks or what is saved.
  const [filter, setFilter] = useState<'all' | 'new' | 'updated' | 'fix'>('all');
  const filterSelection = useSelectionHighlight(filter, greenGradient);
  const [hideUnchanged, setHideUnchanged] = useState(true);
  const viewable = useMemo(() => list.map((p, index) => ({ p, index, k: kindOf(p, badges[index] ?? { kind: 'none' }) })).filter(({ p }) => p.state !== 'saved' && !p.discarded), [list, badges]);
  const viewCounts = useMemo(() => {
    const c = { new: 0, updated: 0, fix: 0, unchanged: 0 };
    viewable.forEach(({ k }) => { if (k === 'new') c.new++; else if (k === 'updated') c.updated++; else if (k === 'unchanged') c.unchanged++; else c.fix++; });
    return c;
  }, [viewable]);
  const kindsShown = [viewCounts.new, viewCounts.updated, viewCounts.fix, viewCounts.unchanged].filter((n) => n > 0).length;
  const rows = useMemo(() => viewable.filter(({ k }) => (k === 'unchanged' ? !hideUnchanged && filter === 'all' : filter === 'all' || (filter === 'fix' ? k === 'error' : k === filter))), [viewable, filter, hideUnchanged]);

  // What the person decides is remembered for the next import of this chat (saved, discarded, unchanged), written after a short pause.
  const flushMem = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (phase !== 'review' || !info || noRecord.current) return undefined;
    const fp = info.fingerprint;
    const decisions = list.flatMap((p, i) => {
      if (!p.pfp) return [];
      const k = kindOf(p, badges[i] ?? { kind: 'none' });
      const outcome: Outcome | null = k === 'saved' ? 'saved' : k === 'discarded' ? 'discarded' : k === 'unchanged' ? 'unchanged' : null;
      return [{ pfp: p.pfp, outcome }];
    });
    const run = () => {
      flushMem.current = null;
      if (noRecord.current) return;
      const r = diffDecisions(memory.current, decisions);
      if (!r.set.length && !r.cleared.length) return;
      memory.current = r.mem;
      setMemCount(Object.keys(r.mem).length);
      void (async () => { if (r.cleared.length) await restoreMemory(fp, r.cleared); if (r.set.length) await recordMemory(fp, r.set); })();
    };
    flushMem.current = run;
    const t = setTimeout(run, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, badges, phase, info]);
  useEffect(() => () => { flushMem.current?.(); }, []);

  const forget = async () => {
    if (!info) return;
    noRecord.current = true;
    flushMem.current = null;
    memory.current = {};
    setMemCount(0);
    setForgotNote(true);
    await forgetAll(info.fingerprint);
  };
  const confirmForget = () => setAsk({ title: W.forget, cancel: W.cancel, go: W.forgetGo, destructive: true, onGo: () => { void forget(); } });
  // A post that was imported before comes back to the list (not ticked).
  const bringBack = (id: string) => {
    const p = priorSaved.find((x) => x.id === id);
    if (!p) return;
    setPriorSaved((l) => l.filter((x) => x.id !== id));
    setList((l) => [...l, { ...p, picked: false }].sort((a, b) => a.post.i - b.post.i));
  };

  // The reader could not be reached (a network problem, or a server without it): the list says so and offers to try again.
  // Ticks the person already set are kept; only a post that had no reading yet is ticked when it turns out valid.
  const retryDetails = async () => {
    try {
      const rd = await api.chatRead(list.map((p) => p.post.text));
      const again = await planPosts((b) => api.chatPlan(b), list.map((p, k) => ({ ...p, fields: rd.posts[k] ? withTextPhoneOnly(rd.posts[k].fields, p.post.orig || p.post.text) : p.fields })));
      setList((l) => {
        const next = l.map((p, k) => {
          const r = rd.posts[k];
          if (!r) return p;
          const fields = withTextPhoneOnly(r.fields, p.post.orig || p.post.text);
          return withPlan({ ...p, fields, missing: r.missing }, again[k] ?? p.plan ?? null);
        });
        return next.map((p, k) => {
          if (l[k].fields) return p;
          const kd = kindOf(p, codeBadge(next, k, codes, codeStatus));
          return { ...p, picked: kd === 'new' || kd === 'updated' };
        });
      });
      setReadFailed(false);
    } catch {
      setReadFailed(true);
    }
  };
  // Saved in bulk: ticked, and a valid new or changed unit. Errors, unchanged and discarded units are skipped even when ticked.
  const discard = (p: ImportPost, badge: CodeBadge) => {
    patchPost(p.id, { discarded: true, picked: false });
    usage('wa_import_discard', true, undefined, { kind: badge.kind });
  };
  // A restored post is ticked only when it is a valid new or changed unit.
  const restore = (id: string) => {
    const i = list.findIndex((p) => p.id === id);
    const k = i < 0 ? 'error' : kindOf({ ...list[i], discarded: false }, badges[i]);
    patchPost(id, { discarded: false, picked: k === 'new' || k === 'updated' });
  };
  const restoreAll = () => { setList((l) => l.map((p, i) => (p.discarded ? { ...p, discarded: false, picked: ['new', 'updated'].includes(kindOf({ ...p, discarded: false }, badges[i])) } : p))); setShowDiscarded(false); };
  const discardErrors = () => {
    list.forEach((p, i) => { const k = kindOf(p, badges[i]); if (k === 'error' || k === 'unchanged') discard(p, badges[i]); });
  };
  const selectValid = () => setList((l) => l.map((p, i) => { const k = kindOf(p, badges[i]); return k === 'new' || k === 'updated' ? { ...p, picked: true } : p; }));

  const edit = (p: ImportPost, badge: CodeBadge) => {
    usage('wa_import_edit', true, undefined, { kind: badge.kind, missing: p.missing?.length ?? 0 });
    const ordered = [...keptOf(p), ...p.photos.filter((x) => x.notKept)];
    nav.push('AddUnit', { text: p.post.orig || p.post.text, photos: ordered, fresh: true, noAi: true, fields: p.fields, ...(p.post.code ? { code: p.post.code } : {}), importId: p.id, ...(badge.kind === 'update' ? { edit: badge.code } : {}) });
  };

  /** The post's save key: made once and kept on the post until it is saved, so a retry reuses it. */
  const keyFor = (p: ImportPost) => {
    if (p.saveKey) return p.saveKey;
    const k = newSaveKey();
    patchPost(p.id, { saveKey: k });
    return k;
  };

  /** Uploads the photos through signed links, one key each (each tried 3 times). */
  const uploadAll = async (files: UploadFile[]) => {
    const links = (await api.photoUploadLinks(Math.max(1, Math.min(15, files.length)))).uploads;
    const keys: string[] = [];
    // shortcut: uploads serial because Render + Supabase are on free plans, parallelize when upgraded to paid
    const shrunk = compressAhead(files); // only the shrinking runs ahead (2 at a time); the sending below stays one photo at a time, in order
    for (const [n, file] of files.entries()) {
      const link = links.shift();
      if (!link) throw new Error('links');
      await withRetries(() => uploadPhoto(file, link, () => undefined, shrunk[n]));
      keys.push(link.key);
    }
    return keys;
  };

  // One post, added without opening it: read, review, upload its 15 photos, save. Anything that needs a person is left for the edit screen.
  const addOne = async (p: ImportPost): Promise<'saved' | 'needs_edit' | 'blocked'> => {
    const fields: UnitFields = withImpliedOwner({ ...nonEmpty(p.fields ?? {}) });
    if (p.post.code && !fields.code) fields.code = p.post.code;
    const body = sendable(withImpliedFeatures(fields));
    const kept = keptOf(p);
    const rv = await api.reviewUnit(body, kept.length);
    if (rv.blockers.length) { patchPost(p.id, { state: 'needs_edit', note: rv.blockers.map((b) => b.label).join(' · ') }); return 'needs_edit'; }
    if (rv.duplicate) { patchPost(p.id, { state: 'needs_edit', note: fill(W.noteDuplicate, { c: rv.duplicate }) }); return 'needs_edit'; }
    const key = keyFor(p);
    let keys: string[] | undefined;
    let legacy: UploadFile[] = [];
    if (kept.length) {
      try {
        keys = await uploadAll(kept);
      } catch (e) {
        if (e instanceof ApiClientError && (e.status === 404 || e.status === 405)) { keys = undefined; legacy = await compressPhotos(kept); }
        else { patchPost(p.id, { state: 'needs_edit', note: W.noteUploadFailed }); return 'needs_edit'; }
      }
    }
    const res = await withSaveCheck(api.createUnit(body, legacy, key, keys), () => api.unitSaveStatus(key));
    patchPost(p.id, { state: 'saved', savedCode: (res as { code: string }).code, note: undefined, missing: undefined });
    return 'saved';
  };

  // One post for an existing unit that really changes: the stored unit with ONLY the fields the post changed on top (the post's note
  // appended to the stored notes), checked by the form rules, saved as an edit on the version read at the review, then the photos added.
  const addUpdate = async (p: ImportPost, code: string, existingPhotos: number): Promise<'saved' | 'needs_edit'> => {
    let plan = p.plan;
    if (!plan || plan.kind !== 'update' || !plan.existing) return 'needs_edit';
    const done = await loadAttached(brokerId, info?.fingerprint ?? '', code);
    const kept = keptOf(p).filter((f) => !done.includes(f.name)).slice(0, updatePhotoRoom(existingPhotos));
    // The stored unit's form fields with only the plan's patch on top (and the post's note appended to the stored notes).
    const build = async (pl: ChatPlanPost) => sendable(withImpliedFeatures(withImpliedOwner(applyPlanPatch((await api.unitEditFields(code)).fields, pl))));
    let body = await build(plan);
    const rv = await api.reviewUnit(body, kept.length, code);
    if (rv.blockers.length) { patchPost(p.id, { state: 'needs_edit', note: rv.blockers.map((b) => b.label).join(' · ') }); return 'needs_edit'; }
    let key = keyFor(p);
    try {
      await withSaveCheck(api.saveUnitEdit(code, plan.existing.version, body, key), () => api.unitSaveStatus(key));
    } catch (e) {
      if (!(e instanceof ApiClientError && e.status === 409)) throw e;
      // The unit changed since the plan: ask the server for the plan again before saving once more.
      const [again] = await planPosts((b) => api.chatPlan(b), [p]);
      if (!again || again.kind !== 'update' || !again.existing) {
        patchPost(p.id, { ...withPlan(p, again ?? p.plan ?? null), state: 'idle', picked: false, saveKey: undefined, note: W.noteConflict });
        return 'needs_edit';
      }
      key = newSaveKey();
      plan = again;
      patchPost(p.id, { plan: again, saveKey: key });
      body = await build(again);
      await withSaveCheck(api.saveUnitEdit(code, again.existing.version, body, key), () => api.unitSaveStatus(key));
    }
    if (kept.length) {
      try {
        const keys = await uploadAll(kept);
        await api.unitPhotos(code, { photoKeys: keys });
        await saveAttached(brokerId, info?.fingerprint ?? '', code, kept.map((f) => f.name));
      } catch {
        // The unit is saved; its photos can be added from the unit. The result says so (never silent).
        photoFails.current.push(code);
      }
    }
    patchPost(p.id, { state: 'saved', savedCode: code, note: undefined, missing: undefined });
    return 'saved';
  };

  const addSelected = async () => {
    if (savingRef.current) return;
    const todo = list.map((p, i) => ({ p, b: badges[i] })).filter(({ p, b }) => savable(p, b));
    if (!todo.length) return;
    savingRef.current = true;
    setSaveTotal(todo.length);
    const unchanged = list.map((p, i) => ({ p, b: badges[i] })).filter(({ p, b }) => kindOf(p, b) === 'unchanged').map(({ b }) => (b.kind === 'update' ? b.code : ''));
    const tally = { created: 0, updated: 0, failed: 0 };
    photoFails.current = [];
    setAdding(true);
    setProgress(0);
    stopped.current = false;
    const run = (async () => {
      let done = 0;
      for (const { p: first } of todo) {
        if (stopped.current) break;
        // The latest state of the post (the person may have discarded or unticked it meanwhile).
        const at = listRef.current.findIndex((x) => x.id === first.id);
        const p = listRef.current[at];
        const b = badgesRef.current[at];
        if (!p || !b || !savable(p, b)) { done += 1; if (!unmounted.current) setProgress(done / todo.length); continue; }
        patchPost(p.id, { state: 'working', note: undefined });
        const t0 = Date.now();
        const photos = keptOf(p).length;
        try {
          const r = b.kind === 'update' && p.plan?.kind === 'update' ? await addUpdate(p, b.code, b.photos) : await addOne(p);
          usage('wa_import_add', r === 'saved', Date.now() - t0, { outcome: r, ai: false, photos });
          if (r === 'saved') tally[b.kind === 'update' ? 'updated' : 'created'] += 1; else tally.failed += 1;
          if (r === 'blocked') break;
        } catch (e) {
          usage('wa_import_add', false, Date.now() - t0, { outcome: 'failed', ai: false, photos, reason: e instanceof ApiClientError ? String(e.code || e.status) : 'unexpected' });
          if (!(e instanceof ApiClientError)) reportError(e, 'WhatsAppImport.add');
          tally.failed += 1;
          patchPost(p.id, { state: 'failed', note: e instanceof ApiClientError && e.code === 'plan_limit' ? undefined : W.noteFailed });
          if (e instanceof ApiClientError && e.code === 'plan_limit') { toast(W.planLimit, true); break; }
        }
        done += 1;
        if (!unmounted.current) setProgress(done / todo.length);
      }
    })();
    loop.current = run;
    try { await run; } finally { savingRef.current = false; }
    if (unmounted.current) return;
    setAdding(false);
    setResult({ saved: tally.created + tally.updated, created: tally.created, updated: tally.updated, unchanged: unchanged.filter(Boolean), failed: tally.failed, photosFailed: [...photoFails.current] });
  };

  // The cards are memoized: every callback below is stable and takes the post's id, so a tick or a note on one card redraws only that card.
  const latest = useRef({ edit, discard });
  latest.current = { edit, discard };
  const onPick = useCallback((id: string) => setList((l) => l.map((p) => (p.id === id ? { ...p, picked: !p.picked } : p))), []);
  const onToggleText = useCallback((id: string) => setOpenText((o) => ({ ...o, [id]: !o[id] })), []);
  const onTogglePhoto = useCallback((id: string, uri: string) => setPhotos(id, (ph) => toggleKeep(ph, uri)), [setPhotos]);
  const onMore = useCallback((id: string) => setMoreOpen((o) => ({ ...o, [id]: true })), []);
  const onEdit = useCallback((id: string) => { const i = listRef.current.findIndex((p) => p.id === id); if (i >= 0) latest.current.edit(listRef.current[i], badgesRef.current[i]); }, []);
  const onDiscard = useCallback((id: string) => { const i = listRef.current.findIndex((p) => p.id === id); if (i >= 0) latest.current.discard(listRef.current[i], badgesRef.current[i]); }, []);
  const renderPost = useCallback(({ item: { p, index }, index: at }: { item: { p: ImportPost; index: number }; index: number }) => (
    <Animated.View layout={layout} entering={enter(Math.min(at, 7))}>
    <PostCard p={p} badge={badges[index]} open={Boolean(openText[p.id])} moreOpen={Boolean(moreOpen[p.id])} locked={p.state === 'working' || adding}
      onPick={onPick} onToggleText={onToggleText} onTogglePhoto={onTogglePhoto} onMore={onMore} onEdit={onEdit} onDiscard={onDiscard} />
    </Animated.View>
  ), [badges, openText, moreOpen, adding, onPick, onToggleText, onTogglePhoto, onMore, onEdit, onDiscard]);
  const listExtra = useMemo(() => [openText, adding, moreOpen, badges, showDiscarded, showPrior, priorSaved, memCount, forgotNote], [openText, adding, moreOpen, badges, showDiscarded, showPrior, priorSaved, memCount, forgotNote]);

  const counts = importCounts(list, badges);
  const canSave = counts.willSave > 0;
  const buttonLabel = `${counts.unticked > 0 ? W.saveTicked : W.addSelected} (${counts.willSave})`;
  const confirmSave = () => setAsk({ title: W.confirmTitle, body: fill(W.confirmBody, { n: counts.willSave, a: counts.newCount, b: counts.updated }), cancel: W.cancel, go: W.confirmGo, onGo: () => { void addSelected(); } });

  // Leaving while a save runs, or with units still ticked, asks first (a save in progress stops at the next post).
  const dirty = useRef(false);
  dirty.current = adding || (phase === 'review' && counts.willSave > 0);
  useEffect(() => {
    const sub = (nav as unknown as { addListener?: (ev: string, fn: (e: { preventDefault: () => void; data: { action: never } }) => void) => () => void }).addListener?.('beforeRemove', (e) => {
      if (!dirty.current) return;
      e.preventDefault();
      setAsk({ title: W.leaveTitle, body: W.leaveBody, cancel: W.leaveStay, go: W.leaveGo, destructive: true, onGo: () => { stopped.current = true; nav.dispatch(e.data.action); } });
    });
    return sub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, lang]);

  if (!allowed) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg }, styles.center]}>
        <Text style={[styles.tc, { color: colors.text }]}>{W.notAllowed}</Text>
        <Button label={W.addOne} onPress={() => nav.replace('AddUnit')} />
      </View>
    );
  }

  if (phase === 'reading') {
    const label = stage === 'list' ? W.stageList : stage === 'chat' ? W.stageChat : stage === 'photos' ? W.stagePhotos : stage === 'match' ? W.stageMatch : W.stageCodes;
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg }, styles.center]}>
        <Text testID="wa-stage" accessibilityLiveRegion="polite" variant="heading" style={{ color: colors.text }}>{label} · {pct}%</Text>
        <Text style={{ color: colors.muted }}>{fill(W.stepOf, { i: ['list', 'chat', 'photos', 'match'].indexOf(stage) + 1 || 5, n: 5 })}</Text>
        <View accessibilityRole="progressbar" accessibilityLabel={W.progressLabel} accessibilityValue={{ min: 0, max: 100, now: pct }} style={[styles.bar, { backgroundColor: colors.border }]}><View testID="wa-bar" style={[styles.barFill, { backgroundColor: colors.chartBar, width: `${pct}%` }]} /></View>
        <Text style={[styles.tc, { color: colors.muted }]}>{W.keepOpen}</Text>
        <Button label={W.cancel} variant="secondary" onPress={() => { signal.current.cancelled = true; cancelUnpack(); }} />
      </View>
    );
  }

  if (phase === 'pick') {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.muted }}>{W.intro}</Text>
        {error ? <Text accessibilityRole="alert" testID="wa-error" style={{ color: colors.danger }}>{error}</Text> : null}
        <Text style={{ color: colors.muted }}>{W.rulesHint}</Text>
        <Button testID="wa-pick-zip" label={W.pick} onPress={choose} />
      </ScrollView>
    );
  }

  if (phase === 'range' && info) {
    const r = resolveRange({ kind, sinceText, untilText }, lastImportAt);
    const inRange = r.ok ? countInRange(info.perDay, r.since, r.until) : null;
    const options: { k: SinceKind; label: string }[] = [
      ...(lastImportAt ? [{ k: 'last' as SinceKind, label: fill(W.sinceLast, { d: lastImportAt.slice(0, 10) }) }] : []),
      { k: '7', label: W.days7 }, { k: '30', label: W.days30 }, { k: '90', label: W.days90 }, { k: 'all', label: W.sinceAll }, { k: 'custom', label: W.sinceCustom },
    ];
    const err = rangeError === 'since' ? W.errSince : rangeError === 'until' ? W.errUntil : rangeError === 'order' ? W.errOrder : null;
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="heading" style={{ color: colors.text }}>{W.rangeTitle}</Text>
        {zipName ? <Text style={{ color: colors.muted }} numberOfLines={1}>{zipName}</Text> : null}
        {error ? <Text accessibilityRole="alert" testID="wa-error" style={{ color: colors.danger }}>{error}</Text> : null}
        <Text testID="wa-chat-span" style={{ color: colors.text }}>{fill(W.chatSpan, { a: utcDay(info.firstAt) || '-', b: utcDay(info.lastAt) || '-', n: info.total })}</Text>
        <View style={styles.chips}>
          {rangeSelection.highlight}
          {options.map((o) => (
            <Pressable key={o.k} onLayout={rangeSelection.measure(o.k)} testID={`wa-range-${o.k}`} accessibilityRole="button" accessibilityState={{ selected: kind === o.k }} onPress={() => { setKind(o.k); setRangeError(null); }}
              style={[styles.chip, { borderColor: kind === o.k ? colors.primary : colors.border }, kind === o.k && !rangeSelection.highlight && greenGradient]}>
              <Text weight={kind === o.k ? 'bold' : 'regular'} style={{ color: kind === o.k ? colors.onPrimary : colors.text }}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
        {kind === 'custom' ? (
          <View style={styles.gap}>
            <Field testID="wa-since-input" label={W.sinceInput} value={sinceText} onChangeText={(v: string) => { setSinceText(v); setRangeError(null); }} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
            <Field testID="wa-until-input" label={W.untilInput} value={untilText} onChangeText={(v: string) => { setUntilText(v); setRangeError(null); }} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
          </View>
        ) : null}
        {err ? <Text accessibilityRole="alert" testID="wa-range-error" style={{ color: colors.danger }}>{err}</Text> : null}
        {inRange !== null ? <Text testID="wa-range-count" style={{ color: colors.muted }}>{fill(W.rangeCount, { n: inRange })}</Text> : null}
        <Button testID="wa-range-read" label={W.read} onPress={() => read()} />
      </ScrollView>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <FlashList
        data={rows}
        keyExtractor={(r) => r.p.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={Gap}
        extraData={listExtra}
        ListHeaderComponent={(
      <View style={styles.headerBox}>
        <Text testID="wa-summary" weight="bold" style={{ color: colors.text }}>{fill(W.summary, { n: counts.remaining, p: counts.photos })}</Text>
        {truncated ? <Text testID="wa-truncated" style={{ color: colors.accent }}>{fill(W.truncated, { n: truncated.shown, m: truncated.total, d: truncated.date })}</Text> : null}
        {videos ? <Text style={{ color: colors.muted }}>🎞 {fill(W.videos, { n: videos })}</Text> : null}
        {missing ? <Text style={{ color: colors.muted }}>{fill(W.missing, { n: missing })}</Text> : null}
        {counts.saved > 0 ? <Text testID="wa-saved-line" style={{ color: colors.text }}>{fill(W.doneLine, { a: counts.saved })}</Text> : null}
        {bulkCount.deal + bulkCount.owner > 0 ? (
          <Card testID="wa-bulk" style={styles.card}>
            <View style={styles.iconRow}><Icon name="tools" size={16} color={colors.text} /><Text weight="bold" style={{ color: colors.text }}>{W.bulkTitle}</Text></View>
            {bulkCount.deal > 0 ? (
              <View style={styles.gap}>
                <Text style={{ color: colors.text }}>{fill(W.bulkDeal, { n: bulkCount.deal })}</Text>
                <View style={styles.row}>
                  <View style={styles.flex}><Button testID="wa-all-rent" label={W.allRent} variant="secondary" loading={bulkBusy} disabled={adding} onPress={() => applyBulk((f) => withDealType(f, 'rent'), lacksDealType)} /></View>
                  <View style={styles.flex}><Button testID="wa-all-sale" label={W.allSale} variant="secondary" loading={bulkBusy} disabled={adding} onPress={() => applyBulk((f) => withDealType(f, 'sale'), lacksDealType)} /></View>
                </View>
              </View>
            ) : null}
            {bulkCount.owner > 0 ? (
              <View style={styles.gap}>
                <Text style={{ color: colors.text }}>{fill(W.bulkOwner, { n: bulkCount.owner })}</Text>
                <Field testID="wa-owner-all" label="" value={ownerAll} onChangeText={(v: string) => { setOwnerAll(v); setOwnerBad(false); }} keyboardType="phone-pad" placeholder={W.bulkOwnerPlaceholder} hint={phoneHelp(lang)} />
                {ownerBad ? <Text accessibilityRole="alert" testID="wa-owner-bad" style={{ color: colors.danger }}>{W.bulkBadPhone}</Text> : null}
                <Button testID="wa-owner-apply" label={W.bulkOwnerApply} variant="secondary" loading={bulkBusy} disabled={adding} onPress={() => {
                  const ok = contactPhoneSchema.safeParse(ownerAll.trim());
                  if (!ok.success) { setOwnerBad(true); return undefined; }
                  return applyBulk((f) => withOwnerPhone(f, ownerAll.trim()), lacksOwnerPhone);
                }} />
              </View>
            ) : null}
            {bulkNote ? <Text testID="wa-bulk-done" style={{ color: colors.muted }}>{bulkNote}</Text> : null}
          </Card>
        ) : bulkNote ? <Text testID="wa-bulk-done" style={{ color: colors.muted }}>{bulkNote}</Text> : null}
        {readFailed ? (
          <Card testID="wa-read-failed" accentColor={colors.danger} variant="accent" style={styles.card}>
            <Text weight="bold" style={{ color: colors.danger }}>{W.readFailed}</Text>
            <Button testID="wa-read-retry" label={W.retry} variant="secondary" onPress={retryDetails} />
          </Card>
        ) : null}
        {counts.discarded > 0 ? (
          <Card testID="wa-discarded-bar" style={styles.card}>
            <View style={styles.row}>
              <Pressable testID="wa-discarded-toggle" accessibilityRole="button" style={styles.flex} onPress={() => { setShowDiscarded((v) => !v); }}>
                <Text style={{ color: colors.text }}>{fill(W.discardedLine, { n: counts.discarded })}</Text>
                {earlierN > 0 ? <Text testID="wa-earlier-line" variant="caption" style={{ color: colors.muted }}>{fill(W.earlierLine, { n: earlierN })}</Text> : null}
              </Pressable>
              <Pressable testID="wa-restore-all" accessibilityRole="button" disabled={adding} style={styles.hit} onPress={restoreAll}><Text weight="bold" style={{ color: colors.primaryInk }}>{W.restoreAll}</Text></Pressable>
            </View>
            {showDiscarded ? list.filter((p) => p.discarded && p.state !== 'saved').map((p) => (
              <View key={p.id} style={styles.row}>
                <Text variant="caption" style={[styles.flex, { color: colors.muted }]} numberOfLines={1}>{p.post.code ? `${p.post.code} · ` : ''}{p.post.orig || p.post.text}</Text>
                <Pressable testID={`wa-restore-${p.id}`} accessibilityRole="button" accessibilityLabel={fill(W.restorePost, { c: p.post.code ?? p.id })} disabled={adding} style={styles.hit} onPress={() => restore(p.id)}><Text weight="bold" style={{ color: colors.primaryInk }}>{W.restore}</Text></Pressable>
              </View>
            )) : null}
          </Card>
        ) : null}
        {result ? (
          <Card testID="wa-result" style={styles.card}>
            <Text weight="bold" style={{ color: colors.text }}>{W.resultTitle}</Text>
            <Text style={{ color: colors.text }}>{fill(W.resultLine, { n: result.saved, a: result.created, b: result.updated, y: result.unchanged.length })}</Text>
            {result.unchanged.length ? <Text testID="wa-result-unchanged" style={{ color: colors.muted }}>{fill(W.resultUnchanged, { list: result.unchanged.join(J) })}</Text> : null}
            {result.photosFailed.length ? <Text testID="wa-result-photos" style={{ color: colors.danger }}>{fill(W.resultPhotosFailed, { list: result.photosFailed.join(J) })}</Text> : null}
            {result.failed ? <Text style={{ color: colors.danger }}>{fill(W.resultFailed, { n: result.failed })} · {W.failedNext}</Text> : <Text style={{ color: colors.muted }}>{W.resultNext}</Text>}
          </Card>
        ) : null}
        {counts.errors + counts.unchanged > 0 ? <Button testID="wa-discard-errors" label={fill(W.discardErrors, { n: counts.errors + counts.unchanged })} variant="secondary" size="sm" disabled={adding} onPress={discardErrors} /> : null}
        {counts.remaining > 0 ? <Button testID="wa-select-valid" label={W.selectValid} variant="secondary" size="sm" disabled={adding} onPress={selectValid} /> : null}
        {kindsShown > 1 ? (
          <View style={styles.chips}>
            {filterSelection.highlight}
            {([['all', W.filterAll, viewCounts.new + viewCounts.updated + viewCounts.fix + (hideUnchanged ? 0 : viewCounts.unchanged)], ['new', W.filterNew, viewCounts.new], ['updated', W.filterUpdated, viewCounts.updated], ['fix', W.filterFix, viewCounts.fix]] as const).map(([k, label, n]) => (
              <Pressable key={k} onLayout={filterSelection.measure(k)} testID={`wa-filter-${k}`} accessibilityRole="button" accessibilityState={{ selected: filter === k }} onPress={() => setFilter(k)}
                style={[styles.chip, { borderColor: filter === k ? colors.primary : colors.border }, filter === k && !filterSelection.highlight && greenGradient]}>
                <Text weight={filter === k ? 'bold' : 'regular'} style={{ color: filter === k ? colors.onPrimary : colors.text }}>{label} ({n})</Text>
              </Pressable>
            ))}
            <Pressable testID="wa-hide-unchanged" accessibilityRole="checkbox" accessibilityState={{ checked: hideUnchanged }} onPress={() => setHideUnchanged((v) => !v)}
              style={[styles.chip, { borderColor: hideUnchanged ? colors.primary : colors.border }]}>
              <Text style={{ color: colors.text }}>{hideUnchanged ? '☑' : '☐'} {W.hideUnchanged}</Text>
            </Pressable>
          </View>
        ) : null}
        {counts.remaining === 0 ? <Text testID="wa-all-added" weight="bold" style={[styles.tc, { color: colors.text }]}>{W.allAdded}</Text> : null}
        {priorSaved.length > 0 ? (
          <Card testID="wa-prior-bar" style={styles.card}>
            <View style={styles.row}>
              <Text testID="wa-prior-line" style={[styles.flex, { color: colors.text }]}>{fill(W.priorLine, { n: priorSaved.length })}</Text>
              <Pressable testID="wa-prior-toggle" accessibilityRole="button" style={styles.hit} onPress={() => setShowPrior((v) => !v)}><Text weight="bold" style={{ color: colors.primaryInk }}>{showPrior ? W.priorHide : W.priorShow}</Text></Pressable>
            </View>
            {showPrior ? priorSaved.map((p) => (
              <View key={p.id} style={styles.row}>
                <Text variant="caption" style={[styles.flex, { color: colors.muted }]} numberOfLines={1}>{p.post.code ? `${p.post.code} · ` : ''}{p.post.orig || p.post.text}</Text>
                <Pressable testID={`wa-bring-${p.id}`} accessibilityRole="button" accessibilityLabel={fill(W.restorePost, { c: p.post.code ?? p.id })} disabled={adding} style={styles.hit} onPress={() => bringBack(p.id)}><Text weight="bold" style={{ color: colors.primaryInk }}>{W.restore}</Text></Pressable>
              </View>
            )) : null}
          </Card>
        ) : null}
        {memCount > 0 ? <Pressable testID="wa-forget" accessibilityRole="button" disabled={adding} style={styles.hit} onPress={confirmForget}><Text style={[styles.underline, { color: colors.muted }]}>{W.forget}</Text></Pressable> : null}
        {forgotNote ? <Text testID="wa-forgot-note" style={{ color: colors.muted }}>{W.forgotten}</Text> : null}
      </View>
        )}
        renderItem={renderPost}
        ListEmptyComponent={counts.remaining > 0 ? <Text testID="wa-empty-filter" style={[styles.tc, { color: colors.muted }]}>{W.emptyFilter}</Text> : undefined}
        ListFooterComponent={hideUnchanged && filter === 'all' && viewCounts.unchanged > 0 ? (
          <Pressable testID="wa-unchanged-hidden" accessibilityRole="button" style={styles.hit} onPress={() => setHideUnchanged(false)}>
            <Text style={[styles.tc, { color: colors.primaryInk }]}>{fill(W.unchangedHidden, { n: viewCounts.unchanged })}</Text>
          </Pressable>
        ) : undefined}
      />
      <View style={[styles.bottom, { borderColor: colors.border, backgroundColor: colors.bg }]}>
        <Text testID="wa-ready" style={[styles.tc, { color: colors.muted }]}>{`${fill(W.willSave, { n: counts.willSave, a: counts.newCount, b: counts.updated, m: counts.skipped, x: counts.errors, y: counts.unchanged, z: counts.discarded })}${counts.unticked > 0 ? fill(W.willSaveUnticked, { u: counts.unticked }) : ''}`}</Text>
        <Button testID="wa-add" label={buttonLabel} progress={adding ? progress : undefined} disabled={adding || !canSave} onPress={confirmSave} />
        {adding ? <Text style={[styles.tc, { color: colors.muted }]}>{fill(W.savingLine, { d: Math.round(progress * saveTotal), t: saveTotal })} · {W.leaveWarn}</Text> : null}
      </View>
      <Sheet visible={Boolean(ask)} onClose={() => setAsk(null)} title={ask?.title} testID="wa-ask">
        {ask?.body ? <Text style={{ color: colors.muted }}>{ask.body}</Text> : null}
        <Button testID="wa-ask-go" label={ask?.go ?? ''} variant={ask?.destructive ? 'danger' : 'primary'} onPress={() => { const go = ask?.onGo; setAsk(null); go?.(); }} />
        <Button testID="wa-ask-cancel" label={ask?.cancel ?? ''} variant="secondary" onPress={() => setAsk(null)} />
      </Sheet>
    </View>
  );
}

type SummaryColors = { text: string; muted: string; border: string; danger: string; card: string; badSoft: string; badInk: string; primary: string; primarySoft: string; primaryInk: string };
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** The unit read from the post as an organised summary (type, place, price, rooms, finishing...), the mandatory things it lacks in red. */
function SummaryGrid({ W, lang, J, post, colors, changed }: { W: ReturnType<typeof wi>; lang: string; J: string; post: ImportPost; colors: SummaryColors; changed: Set<string> }) {
  const f = post.fields;
  if (!f) return null;
  const L2 = lang === 'en' ? 'en' : 'ar';
  const miss = new Set(missingFor(post));
  const lt = str(f.listing_type);
  const price = str(f.price_value);
  const cells: { k: string; label: string; value: string }[] = [
    { k: 'listing_type', label: W.f_listing_type, value: lt === 'sale' ? W.sale : lt === 'rent' ? W.rent : '' },
    { k: 'property_type', label: W.f_property_type, value: labelOf(ALL_TYPES, str(f.property_type), L2) ?? '' },
    { k: 'compound', label: W.f_compound, value: placeLabel(f) },
    { k: 'price_value', label: W.f_price_value, value: price ? `${Number(price).toLocaleString('en')}${str(f.currency) === 'USD' ? ` ${W.usd}` : ''}` : '' },
    { k: 'area_value', label: W.f_area_value, value: str(f.area_value) ? `${str(f.area_value)} ${W.sqm}` : '' },
    { k: 'land_area', label: W.fLand, value: str(f.land_area) ? `${str(f.land_area)} ${W.sqm}` : '' },
    { k: 'garden_area', label: W.fGarden, value: str(f.garden_area) ? `${str(f.garden_area)} ${W.sqm}` : '' },
    { k: 'floor_level', label: W.fFloor, value: str(f.floor_level) },
    { k: 'rent_period', label: W.fRent, value: f.rent_period === 'monthly' ? W.monthly : f.rent_period === 'yearly' ? W.yearly : '' },
    { k: 'bedrooms', label: W.f_bedrooms, value: str(f.bedrooms) },
    { k: 'bathrooms', label: W.baths, value: str(f.bathrooms) },
    { k: 'finishing', label: W.fFinishing, value: labelOf(FINISHING, str(f.finishing), L2) ?? '' },
    { k: 'furnishing', label: W.fFurnishing, value: labelOf(FURNISHING, str(f.furnishing), L2) ?? '' },
    { k: 'owner_phone', label: W.f_owner_phone, value: f.owner_phone ? ltr(displayPhone(str(f.owner_phone))) : '' },
  ];
  const alwaysShown = ['listing_type', 'property_type', 'compound', 'price_value', 'area_value', 'owner_phone'];
  const shown = cells.filter((c) => c.value || miss.has(c.k) || alwaysShown.includes(c.k));
  const missingNames = [...miss].map((k) => (W as unknown as Record<string, string>)[`f_${k}`] ?? k);
  return (
    <View testID={`wa-summary-${post.id}`} style={styles.summary}>
      <View style={styles.grid}>
        {shown.map((c) => {
          const bad = miss.has(c.k);
          const diff = !bad && changed.has(c.k);
          return (
            <View key={c.k} testID={bad ? `wa-missing-${post.id}-${c.k}` : undefined} style={[styles.cell, { backgroundColor: bad ? colors.badSoft : diff ? colors.primarySoft : colors.card, borderColor: bad ? colors.danger : diff ? colors.primary : colors.border }]}>
              <Text variant="micro" style={{ color: bad ? colors.badInk : diff ? colors.text : colors.muted }}>{diff ? `✎ ${c.label}` : c.label}</Text>
              <Text weight="bold" style={{ color: bad ? colors.badInk : colors.text }}>{bad && !c.value ? `⚠️ ${W.missingCell}` : c.value}</Text>
            </View>
          );
        })}
      </View>
      {missingNames.length ? <Text testID={`wa-missing-note-${post.id}`} weight="bold" style={{ color: colors.badInk }}>⛔ {fill(W.missingNote, { list: missingNames.join(J) })}</Text> : null}
    </View>
  );
}

type Handler = (id: string) => void;
type PostCardProps = {
  p: ImportPost; badge: CodeBadge; open: boolean; moreOpen: boolean; locked: boolean;
  onPick: Handler; onToggleText: Handler; onTogglePhoto: (id: string, uri: string) => void; onMore: Handler; onEdit: Handler; onDiscard: Handler;
};

/** One post to decide on. Memoized: it redraws only when its own post, badge or flags change (the badge object is rebuilt on every list change, so it is compared by value). */
const PostCard = memo(function PostCardView({ p, badge, open, moreOpen, locked, onPick, onToggleText, onTogglePhoto, onMore, onEdit, onDiscard }: PostCardProps) {
  const { colors } = useTheme();
  const lang = currentLang();
  const W = wi(lang);
  const J = lang === 'en' ? ', ' : '، ';
  const changeName = (g: string) => (g === 'finishing' ? W.finishingName : (W as unknown as Record<string, string>)[`fc_${g}`] ?? g);
  const changeLine = (c: ChatPlanChange) => `${changeName(c.field)}: ${lang === 'en' ? c.from_en : c.from_ar} → ${lang === 'en' ? c.to_en : c.to_ar}`;
  const kept = keptOf(p).length;
  const kind = kindOf(p, badge);
  const changes = changesOf(p, badge);
  const label = p.post.code ?? p.id;
  const blockNote = p.blocker === 'other_unit' ? W.noteOtherUnit : p.blocker === 'older' ? W.noteOlder : p.blocker === 'invalid' ? W.noteInvalid : p.blocker === 'forbidden' ? W.noteForbidden : p.blocker === 'compare_failed' || (badge.kind === 'update' && !p.plan) ? W.noteCompare : null;
  return (
    <Card testID={`wa-post-${p.id}`} variant="accent" accentColor={missingFor(p).length ? colors.danger : colors.border} style={styles.card}>
      <View style={styles.row}>
        <Pressable testID={`wa-pick-${p.id}`} accessibilityRole="checkbox" accessibilityLabel={fill(W.selectPost, { c: label })} accessibilityState={{ checked: p.picked, disabled: kind === 'error' || locked }} disabled={kind === 'error' || locked} onPress={() => onPick(p.id)} style={styles.hit}>
          <View style={[styles.box, { borderColor: colors.primary }, p.picked && { backgroundColor: colors.primary }]}>
            {p.picked ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
          </View>
        </Pressable>
        <View style={styles.flex}>
          <BadgeLine W={W} badge={badge} colors={colors} willChange={p.plan?.kind === 'update'} />
          {kind === 'unchanged' ? <Text testID={`wa-unchanged-${p.id}`} weight="bold" style={{ color: colors.muted }}>{W.unchangedBadge}</Text> : null}
          {kind === 'updated' && changes?.length ? <Text testID={`wa-changes-${p.id}`} weight="bold" style={{ color: colors.accent }}>{fill(W.changesLine, { list: changes.map((c) => changeLine(c)).join(J) })}</Text> : null}
          {blockNote ? <Text testID={`wa-blocker-${p.id}`} weight="bold" style={{ color: colors.danger }}>{blockNote}</Text> : null}
          {p.blocker === 'other_unit' && changes?.length ? <Text testID={`wa-diff-${p.id}`} weight="bold" style={{ color: colors.primaryInk }}>{fill(W.otherDiff, { list: changes.map((c) => changeLine(c)).join(J) })}</Text> : null}
          <Text variant="caption" style={{ color: colors.muted }} numberOfLines={1}>{[p.post.sender && looksLikePhone(p.post.sender) ? ltr(displayPhone(p.post.sender)) : p.post.sender, p.post.at].filter(Boolean).join('  ·  ')}</Text>
        </View>
        {p.state === 'working' ? <ActivityIndicator color={colors.spinner} /> : null}
      </View>
      <SummaryGrid W={W} lang={lang} J={J} post={p} colors={colors} changed={new Set((changes ?? []).map((c) => c.field.replace(/^details./, '')))} />
      <Pressable testID={`wa-desc-${p.id}`} accessibilityRole="button" accessibilityLabel={`${W.originalTitle}: ${open ? W.showLess : W.showMore}`} accessibilityState={{ expanded: open }} onPress={() => onToggleText(p.id)}>
        <View style={styles.iconRow}><Icon name="chat" size={14} color={colors.muted} /><Text variant="caption" weight="bold" style={{ color: colors.muted }}>{W.originalTitle}</Text></View>
        <Text variant="caption" style={{ color: colors.muted }} numberOfLines={open ? undefined : 3}>{p.post.orig || p.post.text}</Text>
        <Text variant="caption" style={{ color: colors.primaryInk }}>{open ? W.showLess : W.showMore}</Text>
      </Pressable>
      {p.photos.length ? (
        <View style={styles.photos}>
          <Text testID={`wa-count-${p.id}`} style={{ color: colors.muted }}>📷 {fill(W.kept, { k: kept })}{p.post.videos ? `  ·  ${fill(W.videosPost, { n: p.post.videos })}` : ''}</Text>
          {p.photos.length > 15 ? <Text style={{ color: colors.accent }}>{W.pickNote}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {(moreOpen ? p.photos : p.photos.slice(0, THUMB_CAP)).map((f, n) => (
              <Pressable key={f.uri} testID={`wa-photo-${p.id}-${n}`} accessibilityRole="checkbox" accessibilityLabel={`${fill(W.photoN, { n: n + 1 })}: ${f.notKept ? W.photoOut : W.photoKept}`} accessibilityState={{ checked: !f.notKept, disabled: locked }} disabled={locked} onPress={() => onTogglePhoto(p.id, f.uri)} style={f.notKept ? styles.dim : undefined}>
                <SmartImage uri={f.uri} style={styles.thumb} />
                <Text variant="caption" style={[styles.tick, { color: colors.onPrimary, backgroundColor: f.notKept ? colors.border : colors.primary }]}>{f.notKept ? '–' : '✓'}</Text>
              </Pressable>
            ))}
            {!moreOpen && p.photos.length > THUMB_CAP ? (
              <Pressable testID={`wa-more-${p.id}`} accessibilityRole="button" accessibilityLabel={fill(W.morePhotos, { n: p.photos.length - THUMB_CAP })} onPress={() => onMore(p.id)} style={[styles.thumb, styles.moreChip, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text weight="bold" style={{ color: colors.text }}>+{p.photos.length - THUMB_CAP}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
      {p.note ? <Text style={{ color: colors.danger }}>{p.state === 'needs_edit' ? `${W.stateNeedsEdit}: ` : ''}{p.note}</Text> : null}
      {p.state === 'failed' && !p.note ? <Text style={{ color: colors.danger }}>{W.stateFailed}</Text> : null}
      <Button label={badge.kind === 'update' ? W.editUpdate : W.edit} variant="secondary" disabled={locked || badge.kind === 'taken'} onPress={() => onEdit(p.id)} />
      <Button testID={`wa-discard-${p.id}`} label={fill(W.discardPost, { c: label })} variant="secondary" size="sm" disabled={locked} onPress={() => onDiscard(p.id)} />
    </Card>
  );
}, (a, b) => {
  if (a.p !== b.p || a.open !== b.open || a.moreOpen !== b.moreOpen || a.locked !== b.locked) return false;
  if (a.onPick !== b.onPick || a.onToggleText !== b.onToggleText || a.onTogglePhoto !== b.onTogglePhoto || a.onMore !== b.onMore || a.onEdit !== b.onEdit || a.onDiscard !== b.onDiscard) return false;
  return a.badge === b.badge || JSON.stringify(a.badge) === JSON.stringify(b.badge);
});

function BadgeLine({ W, badge, colors, willChange }: { W: ReturnType<typeof wi>; badge: CodeBadge; colors: { muted: string; accent: string; danger: string; text: string }; willChange: boolean }) {
  if (badge.kind === 'none') return null;
  // The code check only says the unit exists; the 🔄 shows only when the server's plan says the post really changes it.
  const [text, color] =
    badge.kind === 'update' ? [`${willChange ? '🔄' : '✔'} ${fill(W.badgeUpdate, { c: badge.code })}${badge.photos ? ` · ${fill(W.badgeHas, { n: badge.photos })}` : ''}`, willChange ? colors.accent : colors.muted]
    : badge.kind === 'new' ? [`🆕 ${fill(W.badgeNew, { c: badge.code })}`, colors.text]
    : badge.kind === 'taken' ? [`⛔ ${W.badgeTaken}`, colors.danger]
    : badge.kind === 'dup' ? [`⚠️ ${fill(W.badgeDup, { n: badge.of })}`, colors.danger]
    : badge.kind === 'checking' ? [W.badgeChecking, colors.muted]
    : [W.badgeFailed, colors.muted];
  return <Text testID={`wa-badge-${badge.kind}`} weight="bold" style={{ color }}>{text}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 220 },
  tc: { textAlign: 'center' },
  underline: { textDecorationLine: 'underline' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  gap: { gap: spacing.sm },
  sep: { height: spacing.md },
  summary: { gap: spacing.xs + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  cell: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minWidth: 96 },
  bar: { height: 12, borderRadius: radius.sm, alignSelf: 'stretch', overflow: 'hidden' },
  barFill: { height: 12 },
  card: { padding: spacing.md, gap: spacing.sm },
  hit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  box: { width: 26, height: 26, borderWidth: 2, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  headerBox: { gap: spacing.md, marginBottom: spacing.md },
  moreChip: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  strip: { gap: spacing.sm, paddingVertical: spacing.sm },
  photos: { gap: spacing.xs },
  thumb: { width: 76, height: 76, borderRadius: radius.md },
  dim: { opacity: 0.4 },
  tick: { position: 'absolute', top: 4, end: 4, paddingHorizontal: 5, borderRadius: 8, overflow: 'hidden' },
  bottom: { position: 'absolute', start: 0, end: 0, bottom: 0, padding: spacing.md, gap: spacing.sm, borderTopWidth: 1 },
});
