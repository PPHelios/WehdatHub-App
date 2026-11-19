import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import { ApiClientError, displayPhone, looksLikePhone, ltr, phoneSchema } from '@wehdathub/shared';
import type { CodeState, UnitFields, UploadFile } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang, useAuth } from '../auth';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { SmartImage } from '../components/SmartImage';
import { placeLabel } from '../components/UnitBox';
import { ALL_TYPES, FINISHING, FURNISHING, labelOf } from '../unitOptions';
import type { RootStackParams } from '../navigation';
import { toggleKeep } from '../photos';
import { uploadPhoto } from '../photoUpload';
import { withRetries } from '../retry';
import { compressPhotos } from '../compress';
import { reportError } from '../errorReport';
import { useRights } from '../rights';
import { newSaveKey, withSaveCheck } from '../saveKey';
import { radius, spacing, useTheme } from '../theme';
import { usage } from '../usage';
import { sendable, withImpliedFeatures } from '../unitRules';
import {
  advanceWatermark, buildImportPosts, changedFields, changesOf, codeBadge, countInRange, existingBlocker, importCounts, incomplete, keptOf, kindOf, lacksDealType, lacksOwnerPhone,
  loadAttached, loadWatermark, looksLikeZip, missingFor, missingOf, newestDecided, overlayUpdate, postTime, resolveRange, saveAttached, savable, stagePct, toExisting,
  updatePhotoRoom, withDealType, withDefaultTicks, withImpliedOwner, withOwnerPhone, withTextPhoneOnly,
} from '../whatsappImport';
import type { ChatInfo, CodeBadge, ExistingUnit, ImportPost, SinceKind } from '../whatsappImport';
import { fill, wi } from '../whatsappImportText';
import { applyMemory, diffDecisions, forgetAll, load as loadMemory, record as recordMemory, restore as restoreMemory } from '../whatsappImportMemory';
import type { Memory, Outcome } from '../whatsappImportMemory';
import { ZipImportError, cancelUnpack, cleanUp, openChat, readChat } from '../zipImport';
import { toast } from '../components/Toast';

/** Cards drawn on the first frame, and photos drawn per card before the "+N" chip (the rest load when it is tapped). */
const INITIAL_CARDS = 6;
const THUMB_CAP = 8;
const Gap = () => <View style={{ height: spacing.md }} />;

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
  const { colors, elev } = useTheme();
  const lang = currentLang();
  const W = wi(lang);
  const J = lang === 'en' ? ', ' : '، ';
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParams, 'WhatsAppImport'>>();
  const rights = useRights();
  const allowed = rights.manager || rights.agencyOwner || rights.dataEntry;
  const brokerId = String(useAuth.getState().broker?.id ?? 'me');

  const [zipName, setZipName] = useState<string>(route.params?.zip?.name ?? '');
  const [phase, setPhase] = useState<Phase>('pick');
  const [pct, setPct] = useState(0);
  const [stage, setStage] = useState<Stage>('list');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<ChatInfo | null>(null);
  const [watermark, setWatermark] = useState<number | null>(null);
  const [kind, setKind] = useState<SinceKind>('30');
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
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [result, setResult] = useState<{ saved: number; created: number; updated: number; unchanged: string[]; failed: number; photosFailed: string[] } | null>(null);
  // What was decided about this chat's posts in earlier imports (see whatsappImportMemory).
  const [priorSaved, setPriorSaved] = useState<ImportPost[]>([]);
  const [showPrior, setShowPrior] = useState(false);
  const [memCount, setMemCount] = useState(0);
  const [forgotNote, setForgotNote] = useState(false);
  const [earlierN, setEarlierN] = useState(0);
  const [moreOpen, setMoreOpen] = useState<Record<string, boolean>>({});
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
  const setPhotos = (id: string, fn: (photos: UploadFile[]) => UploadFile[]) => setList((l) => l.map((p) => (p.id === id ? { ...p, photos: fn(p.photos) } : p)));
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
      const wm = await loadWatermark(brokerId, o.info.fingerprint);
      setInfo(o.info);
      setWatermark(wm);
      setKind(wm ? 'last' : '30');
      setRangeError(null);
      setPhase('range');
    } catch (e) {
      usage('wa_import_read', false, Date.now() - t0, { reason: e instanceof ZipImportError ? e.reason : 'unexpected', stage: stageRef.current, ...(e instanceof ZipImportError && e.detail ? { detail: e.detail } : {}) });
      if (!(e instanceof ZipImportError)) reportError(e, 'WhatsAppImport.open');
      setPhase('pick');
      setError(reasonText(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, brokerId]);

  const read = useCallback(async () => {
    const o = opened.current;
    if (!o) return;
    const r = resolveRange({ kind, sinceText, untilText }, watermark);
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
      // A post for an existing unit is compared with that unit (its stored fields), so one with nothing really changed is "unchanged".
      // When the unit cannot be read the post is an error ("could not compare"), never an update.
      await Promise.all(posts.map(async (p, i) => {
        const b = codeBadge(posts, i, codeMap, codeState);
        if (b.kind !== 'update') return;
        try {
          p.existing = toExisting(await api.unitEditFields(b.code));
          p.blocker = p.fields ? existingBlocker(p.existing, p.fields, postTime(p.post)) : undefined;
        } catch { p.existing = null; p.blocker = 'compare_failed'; }
      }));
      setPct(100);
      setResult(null);
      const ticked = withDefaultTicks(posts, posts.map((_, i) => codeBadge(posts, i, codeMap, codeState)));
      const { decisions: mem } = await loadMemory(o.info.fingerprint);
      memory.current = mem;
      noRecord.current = false;
      const applied = applyMemory(ticked, mem);
      setMemCount(Object.keys(mem).length);
      setForgotNote(false);
      setShowPrior(false);
      setMoreOpen({});
      setPriorSaved(applied.priorSaved);
      setEarlierN(applied.list.filter((x) => x.discarded).length);
      setList(applied.list);
      setPhase('review');
    } catch (e) {
      // Why it failed (a zip problem, or something unexpected that is also reported as an error) goes to the usage log.
      usage('wa_import_read', false, Date.now() - t0, { reason: e instanceof ZipImportError ? e.reason : 'unexpected', stage: stageRef.current, since_kind: sinceKind, ...(e instanceof ZipImportError && e.detail ? { detail: e.detail } : {}) });
      if (!(e instanceof ZipImportError)) reportError(e, 'WhatsAppImport.read');
      setPhase('range');
      setError(reasonText(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, sinceText, untilText, watermark, lang]);

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
        patchPost(p.id, { fields, missing, note: undefined });
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
  const rows = useMemo(() => list.map((p, index) => ({ p, index })).filter(({ p }) => p.state !== 'saved' && !p.discarded), [list]);

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
      setList((l) => {
        const next = l.map((p, k) => {
          const r = rd.posts[k];
          if (!r) return p;
          const fields = withTextPhoneOnly(r.fields, p.post.orig || p.post.text);
          return { ...p, fields, missing: r.missing, blocker: p.existing && fields ? existingBlocker(p.existing, fields, postTime(p.post)) : p.blocker };
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
    nav.navigate('AddUnit', { text: p.post.orig || p.post.text, photos: ordered, fresh: true, noAi: true, fields: p.fields, ...(p.post.code ? { code: p.post.code } : {}), importId: p.id, ...(badge.kind === 'update' ? { edit: badge.code } : {}) });
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
    for (const file of files) {
      const link = links.shift();
      if (!link) throw new Error('links');
      await withRetries(() => uploadPhoto(file, link, () => undefined));
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
    let ex: ExistingUnit | null | undefined = p.existing;
    if (!ex) return 'needs_edit';
    const post = p.fields ?? {};
    const build = (e: ExistingUnit) => sendable(withImpliedFeatures(withImpliedOwner(overlayUpdate(e.fields, post))));
    const done = await loadAttached(brokerId, info?.fingerprint ?? '', code);
    const kept = keptOf(p).filter((f) => !done.includes(f.name)).slice(0, updatePhotoRoom(existingPhotos));
    let body = build(ex);
    const rv = await api.reviewUnit(body, kept.length, code);
    if (rv.blockers.length) { patchPost(p.id, { state: 'needs_edit', note: rv.blockers.map((b) => b.label).join(' · ') }); return 'needs_edit'; }
    let key = keyFor(p);
    try {
      await withSaveCheck(api.saveUnitEdit(code, ex.version, body, key), () => api.unitSaveStatus(key));
    } catch (e) {
      if (!(e instanceof ApiClientError && e.status === 409)) throw e;
      // The unit changed since the review: read it again and compare again before saving once more.
      ex = toExisting(await api.unitEditFields(code));
      const blocker = existingBlocker(ex, post, postTime(p.post));
      if (blocker || !changedFields(ex.fields, post).length) {
        patchPost(p.id, { existing: ex, blocker, state: 'idle', picked: false, saveKey: undefined, note: W.noteConflict });
        return 'needs_edit';
      }
      key = newSaveKey();
      patchPost(p.id, { existing: ex, saveKey: key });
      body = build(ex);
      await withSaveCheck(api.saveUnitEdit(code, ex.version, body, key), () => api.unitSaveStatus(key));
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
          const r = b.kind === 'update' ? await addUpdate(p, b.code, b.photos) : await addOne(p);
          usage('wa_import_add', r === 'saved', Date.now() - t0, { outcome: r, ai: false, photos });
          if (r === 'saved') tally[b.kind === 'update' ? 'updated' : 'created'] += 1; else tally.failed += 1;
          if (r === 'blocked') break;
        } catch (e) {
          usage('wa_import_add', false, Date.now() - t0, { outcome: 'failed', ai: false, photos, reason: e instanceof ApiClientError ? String(e.code || e.status) : 'unexpected' });
          if (!(e instanceof ApiClientError)) reportError(e, 'WhatsAppImport.add');
          tally.failed += 1;
          patchPost(p.id, { state: 'failed', note: e instanceof ApiClientError && e.code === 'plan_limit' ? undefined : W.noteFailed });
          if (e instanceof ApiClientError && e.code === 'plan_limit') { toast(lang === 'en' ? "You reached your plan's unit limit." : 'وصلت للحد الأقصى للوحدات في باقتك.', true); break; }
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

  const counts = importCounts(list, badges);
  const canSave = counts.willSave > 0;
  const buttonLabel = `${W.addSelected} (${counts.willSave})`;
  const changeName = (g: string) => (g === 'finishing' ? W.finishingName : (W as unknown as Record<string, string>)[`fc_${g}`] ?? g);

  // Leaving while a save runs, or with units still ticked, asks first (a save in progress stops at the next post).
  const dirty = useRef(false);
  dirty.current = adding || (phase === 'review' && counts.willSave > 0);
  useEffect(() => {
    const sub = (nav as unknown as { addListener?: (ev: string, fn: (e: { preventDefault: () => void; data: { action: never } }) => void) => () => void }).addListener?.('beforeRemove', (e) => {
      if (!dirty.current) return;
      e.preventDefault();
      Alert.alert(W.leaveTitle, W.leaveBody, [
        { text: W.leaveStay, style: 'cancel' },
        { text: W.leaveGo, style: 'destructive', onPress: () => { stopped.current = true; nav.dispatch(e.data.action); } },
      ]);
    });
    return sub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, lang]);

  // After a save the watermark moves to the newest post the person dealt with (saved, discarded or unchanged), for the next import of this chat.
  useEffect(() => {
    if (!result || !info) return;
    const t = newestDecided(listRef.current, badgesRef.current);
    if (t !== null) void advanceWatermark(brokerId, info.fingerprint, t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (!allowed) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg }, styles.center]}>
        <Text style={{ color: colors.text, textAlign: 'center' }}>{W.notAllowed}</Text>
        <Button label={W.addOne} onPress={() => nav.replace('AddUnit')} />
      </View>
    );
  }

  if (phase === 'reading') {
    const label = stage === 'list' ? W.stageList : stage === 'chat' ? W.stageChat : stage === 'photos' ? W.stagePhotos : stage === 'match' ? W.stageMatch : W.stageCodes;
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg }, styles.center]}>
        <ActivityIndicator color={colors.primary} />
        <Text testID="wa-stage" style={[styles.h, { color: colors.text }]}>{label} · {pct}%</Text>
        <View accessibilityRole="progressbar" accessibilityLabel={W.progressLabel} accessibilityValue={{ min: 0, max: 100, now: pct }} style={[styles.bar, { backgroundColor: colors.border }]}><View testID="wa-bar" style={[styles.barFill, { backgroundColor: colors.primary, width: `${pct}%` }]} /></View>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>{W.keepOpen}</Text>
        <Button label={W.cancel} variant="secondary" onPress={() => { signal.current.cancelled = true; cancelUnpack(); }} />
      </View>
    );
  }

  if (phase === 'pick') {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.muted }}>{W.intro}</Text>
        {error ? <Text testID="wa-error" style={{ color: colors.danger }}>{error}</Text> : null}
        <Text style={{ color: colors.muted }}>{W.rulesHint}</Text>
        <Button testID="wa-pick-zip" label={W.pick} onPress={choose} />
      </ScrollView>
    );
  }

  if (phase === 'range' && info) {
    const r = resolveRange({ kind, sinceText, untilText }, watermark);
    const inRange = r.ok ? countInRange(info.perDay, r.since, r.until) : null;
    const options: { k: SinceKind; label: string }[] = [
      ...(watermark !== null ? [{ k: 'last' as SinceKind, label: fill(W.sinceLast, { d: utcDay(watermark) }) }] : []),
      { k: '7', label: W.days7 }, { k: '30', label: W.days30 }, { k: '90', label: W.days90 }, { k: 'all', label: W.sinceAll }, { k: 'custom', label: W.sinceCustom },
    ];
    const err = rangeError === 'since' ? W.errSince : rangeError === 'until' ? W.errUntil : rangeError === 'order' ? W.errOrder : null;
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h, { color: colors.text }]}>{W.rangeTitle}</Text>
        {zipName ? <Text style={{ color: colors.muted }} numberOfLines={1}>{zipName}</Text> : null}
        {error ? <Text testID="wa-error" style={{ color: colors.danger }}>{error}</Text> : null}
        <Text testID="wa-chat-span" style={{ color: colors.text }}>{fill(W.chatSpan, { a: utcDay(info.firstAt) || '-', b: utcDay(info.lastAt) || '-', n: info.total })}</Text>
        <View style={styles.chips}>
          {options.map((o) => (
            <Pressable key={o.k} testID={`wa-range-${o.k}`} accessibilityRole="button" accessibilityState={{ selected: kind === o.k }} onPress={() => { setKind(o.k); setRangeError(null); }}
              style={[styles.chip, { borderColor: kind === o.k ? colors.primary : colors.border, backgroundColor: kind === o.k ? colors.primary : 'transparent' }]}>
              <Text style={{ color: kind === o.k ? colors.onPrimary : colors.text, fontWeight: kind === o.k ? '700' : '400' }}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
        {kind === 'custom' ? (
          <View style={{ gap: spacing.sm }}>
            <Field testID="wa-since-input" label={W.sinceInput} value={sinceText} onChangeText={(v: string) => { setSinceText(v); setRangeError(null); }} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
            <Field testID="wa-until-input" label={W.untilInput} value={untilText} onChangeText={(v: string) => { setUntilText(v); setRangeError(null); }} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
          </View>
        ) : null}
        {err ? <Text testID="wa-range-error" style={{ color: colors.danger }}>{err}</Text> : null}
        {inRange !== null ? <Text testID="wa-range-count" style={{ color: colors.muted }}>{fill(W.rangeCount, { n: inRange })}</Text> : null}
        <Button testID="wa-range-read" label={W.read} onPress={() => read()} />
      </ScrollView>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.p.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={INITIAL_CARDS}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
        ItemSeparatorComponent={Gap}
        extraData={[openText, adding, moreOpen, badges, showDiscarded, showPrior, priorSaved, memCount, forgotNote]}
        ListHeaderComponent={(
      <View style={styles.headerBox}>
        <Text testID="wa-summary" style={{ color: colors.text, fontWeight: '700' }}>{fill(W.summary, { n: counts.remaining, p: counts.photos })}</Text>
        {truncated ? <Text testID="wa-truncated" style={{ color: colors.accent }}>{fill(W.truncated, { n: truncated.shown, m: truncated.total, d: truncated.date })}</Text> : null}
        {videos ? <Text style={{ color: colors.muted }}>🎞 {fill(W.videos, { n: videos })}</Text> : null}
        {missing ? <Text style={{ color: colors.muted }}>{fill(W.missing, { n: missing })}</Text> : null}
        {counts.saved > 0 ? <Text testID="wa-saved-line" style={{ color: colors.text }}>{fill(W.doneLine, { a: counts.saved })}</Text> : null}
        {bulkCount.deal + bulkCount.owner > 0 ? (
          <View testID="wa-bulk" style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>🧰 {W.bulkTitle}</Text>
            {bulkCount.deal > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.text }}>{fill(W.bulkDeal, { n: bulkCount.deal })}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}><Button testID="wa-all-rent" label={W.allRent} variant="secondary" loading={bulkBusy} disabled={adding} onPress={() => applyBulk((f) => withDealType(f, 'rent'), lacksDealType)} /></View>
                  <View style={{ flex: 1 }}><Button testID="wa-all-sale" label={W.allSale} variant="secondary" loading={bulkBusy} disabled={adding} onPress={() => applyBulk((f) => withDealType(f, 'sale'), lacksDealType)} /></View>
                </View>
              </View>
            ) : null}
            {bulkCount.owner > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.text }}>{fill(W.bulkOwner, { n: bulkCount.owner })}</Text>
                <Field testID="wa-owner-all" label="" value={ownerAll} onChangeText={(v: string) => { setOwnerAll(v); setOwnerBad(false); }} keyboardType="phone-pad" placeholder={W.bulkOwnerPlaceholder} />
                {ownerBad ? <Text testID="wa-owner-bad" style={{ color: colors.danger }}>{W.bulkBadPhone}</Text> : null}
                <Button testID="wa-owner-apply" label={W.bulkOwnerApply} variant="secondary" loading={bulkBusy} disabled={adding} onPress={() => {
                  const ok = phoneSchema.safeParse(ownerAll.trim());
                  if (!ok.success) { setOwnerBad(true); return undefined; }
                  return applyBulk((f) => withOwnerPhone(f, ownerAll.trim()), lacksOwnerPhone);
                }} />
              </View>
            ) : null}
            {bulkNote ? <Text testID="wa-bulk-done" style={{ color: colors.muted }}>{bulkNote}</Text> : null}
          </View>
        ) : bulkNote ? <Text testID="wa-bulk-done" style={{ color: colors.muted }}>{bulkNote}</Text> : null}
        {readFailed ? (
          <View testID="wa-read-failed" style={[styles.card, { borderColor: colors.danger, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.danger, fontWeight: '700' }}>{W.readFailed}</Text>
            <Button testID="wa-read-retry" label={W.retry} variant="secondary" onPress={retryDetails} />
          </View>
        ) : null}
        {counts.discarded > 0 ? (
          <View testID="wa-discarded-bar" style={[styles.card, elev('md'), { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <Pressable testID="wa-discarded-toggle" accessibilityRole="button" style={styles.flex} onPress={() => { setShowDiscarded((v) => !v); }}>
                <Text style={{ color: colors.text }}>{fill(W.discardedLine, { n: counts.discarded })}</Text>
                {earlierN > 0 ? <Text testID="wa-earlier-line" style={[styles.small, { color: colors.muted }]}>{fill(W.earlierLine, { n: earlierN })}</Text> : null}
              </Pressable>
              <Pressable testID="wa-restore-all" accessibilityRole="button" disabled={adding} onPress={restoreAll}><Text style={{ color: colors.primaryInk, fontWeight: '700' }}>{W.restoreAll}</Text></Pressable>
            </View>
            {showDiscarded ? list.filter((p) => p.discarded && p.state !== 'saved').map((p) => (
              <View key={p.id} style={styles.row}>
                <Text style={[styles.flex, styles.small, { color: colors.muted }]} numberOfLines={1}>{p.post.code ? `${p.post.code} · ` : ''}{p.post.orig || p.post.text}</Text>
                <Pressable testID={`wa-restore-${p.id}`} accessibilityRole="button" accessibilityLabel={fill(W.restorePost, { c: p.post.code ?? p.id })} disabled={adding} style={styles.hit} onPress={() => restore(p.id)}><Text style={{ color: colors.primaryInk, fontWeight: '700' }}>{W.restore}</Text></Pressable>
              </View>
            )) : null}
          </View>
        ) : null}
        {result ? (
          <View testID="wa-result" style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{W.resultTitle}</Text>
            <Text style={{ color: colors.text }}>{fill(W.resultLine, { n: result.saved, a: result.created, b: result.updated, y: result.unchanged.length })}</Text>
            {result.unchanged.length ? <Text testID="wa-result-unchanged" style={{ color: colors.muted }}>{fill(W.resultUnchanged, { list: result.unchanged.join(J) })}</Text> : null}
            {result.photosFailed.length ? <Text testID="wa-result-photos" style={{ color: colors.danger }}>{fill(W.resultPhotosFailed, { list: result.photosFailed.join(J) })}</Text> : null}
            {result.failed ? <Text style={{ color: colors.danger }}>{fill(W.resultFailed, { n: result.failed })}</Text> : null}
          </View>
        ) : null}
        {counts.errors + counts.unchanged > 0 ? <Button testID="wa-discard-errors" label={fill(W.discardErrors, { n: counts.errors + counts.unchanged })} variant="secondary" size="sm" disabled={adding} onPress={discardErrors} /> : null}
        {counts.remaining > 0 ? <Button testID="wa-select-valid" label={W.selectValid} variant="secondary" size="sm" disabled={adding} onPress={selectValid} /> : null}
        {counts.remaining === 0 ? <Text testID="wa-all-added" style={{ color: colors.text, fontWeight: '700', textAlign: 'center' }}>{W.allAdded}</Text> : null}
        {priorSaved.length > 0 ? (
          <View testID="wa-prior-bar" style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <Text testID="wa-prior-line" style={[styles.flex, { color: colors.text }]}>{fill(W.priorLine, { n: priorSaved.length })}</Text>
              <Pressable testID="wa-prior-toggle" accessibilityRole="button" style={styles.hit} onPress={() => setShowPrior((v) => !v)}><Text style={{ color: colors.primaryInk, fontWeight: '700' }}>{showPrior ? W.priorHide : W.priorShow}</Text></Pressable>
            </View>
            {showPrior ? priorSaved.map((p) => (
              <View key={p.id} style={styles.row}>
                <Text style={[styles.flex, styles.small, { color: colors.muted }]} numberOfLines={1}>{p.post.code ? `${p.post.code} · ` : ''}{p.post.orig || p.post.text}</Text>
                <Pressable testID={`wa-bring-${p.id}`} accessibilityRole="button" accessibilityLabel={fill(W.restorePost, { c: p.post.code ?? p.id })} disabled={adding} style={styles.hit} onPress={() => bringBack(p.id)}><Text style={{ color: colors.primaryInk, fontWeight: '700' }}>{W.restore}</Text></Pressable>
              </View>
            )) : null}
          </View>
        ) : null}
        {memCount > 0 ? <Pressable testID="wa-forget" accessibilityRole="button" disabled={adding} style={styles.hit} onPress={forget}><Text style={{ color: colors.muted, textDecorationLine: 'underline' }}>{W.forget}</Text></Pressable> : null}
        {forgotNote ? <Text testID="wa-forgot-note" style={{ color: colors.muted }}>{W.forgotten}</Text> : null}
      </View>
        )}
        renderItem={({ item: { p, index: i } }) => {
          const badge = badges[i];
          const kept = keptOf(p).length;
          const kind = kindOf(p, badge);
          const changes = changesOf(p, badge);
          const locked = p.state === 'working' || adding;
          const open = Boolean(openText[p.id]);
          const label = p.post.code ?? p.id;
          const blockNote = p.blocker === 'other_unit' ? W.noteOtherUnit : p.blocker === 'older' ? W.noteOlder : p.blocker === 'compare_failed' || (badge.kind === 'update' && !p.existing) ? W.noteCompare : null;
          return (
            <View key={p.id} testID={`wa-post-${p.id}`} style={[styles.card, elev('md'), { borderColor: missingFor(p).length ? colors.danger : colors.border, backgroundColor: colors.card }]}>
              <View style={styles.row}>
                <Pressable testID={`wa-pick-${p.id}`} accessibilityRole="checkbox" accessibilityLabel={fill(W.selectPost, { c: label })} accessibilityState={{ checked: p.picked, disabled: kind === 'error' || locked }} disabled={kind === 'error' || locked} onPress={() => patchPost(p.id, { picked: !p.picked })} style={styles.hit}>
                  <View style={[styles.box, { borderColor: colors.primary, backgroundColor: p.picked ? colors.primary : 'transparent' }]}>
                    <Text style={{ color: p.picked ? colors.onPrimary : 'transparent' }}>✓</Text>
                  </View>
                </Pressable>
                <View style={styles.flex}>
                  <BadgeLine W={W} badge={badge} colors={colors} />
                  {kind === 'unchanged' ? <Text testID={`wa-unchanged-${p.id}`} style={{ color: colors.muted, fontWeight: '600' }}>{W.unchangedBadge}</Text> : null}
                  {kind === 'updated' && changes?.length ? <Text testID={`wa-changes-${p.id}`} style={{ color: colors.accent, fontWeight: '600' }}>{fill(W.changesLine, { list: changes.map(changeName).join(J) })}</Text> : null}
                  {blockNote ? <Text testID={`wa-blocker-${p.id}`} style={{ color: colors.danger, fontWeight: '600' }}>{blockNote}</Text> : null}
                  <Text style={[styles.small, { color: colors.muted }]} numberOfLines={1}>{[p.post.sender && looksLikePhone(p.post.sender) ? ltr(displayPhone(p.post.sender)) : p.post.sender, p.post.at].filter(Boolean).join('  ·  ')}</Text>
                </View>
                {p.state === 'working' ? <ActivityIndicator color={colors.primary} /> : null}
              </View>
              <SummaryGrid W={W} lang={lang} J={J} post={p} colors={colors} />
              <Pressable testID={`wa-desc-${p.id}`} accessibilityRole="button" onPress={() => setOpenText((o) => ({ ...o, [p.id]: !o[p.id] }))}>
                <Text style={[styles.small, styles.bold, { color: colors.muted }]}>💬 {W.originalTitle}</Text>
                <Text style={[styles.small, { color: colors.muted }]} numberOfLines={open ? undefined : 3}>{p.post.orig || p.post.text}</Text>
                <Text style={[styles.small, { color: colors.primaryInk }]}>{open ? W.showLess : W.showMore}</Text>
              </Pressable>
              {p.photos.length ? (
                <View style={styles.photos}>
                  <Text testID={`wa-count-${p.id}`} style={{ color: colors.muted }}>📷 {fill(W.kept, { k: kept })}{p.post.videos ? `  ·  ${fill(W.videosPost, { n: p.post.videos })}` : ''}</Text>
                  {p.photos.length > 15 ? <Text style={{ color: colors.accent }}>{W.pickNote}</Text> : null}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                    {(moreOpen[p.id] ? p.photos : p.photos.slice(0, THUMB_CAP)).map((f, n) => (
                      <Pressable key={f.uri} testID={`wa-photo-${p.id}-${n}`} accessibilityRole="button" accessibilityLabel={fill(W.photoN, { n: n + 1 })} accessibilityState={{ selected: !f.notKept, disabled: locked }} disabled={locked} onPress={() => setPhotos(p.id, (ph) => toggleKeep(ph, f.uri))} style={f.notKept ? styles.dim : undefined}>
                        <SmartImage uri={f.uri} style={styles.thumb} />
                        <Text style={[styles.tick, { color: colors.onPrimary, backgroundColor: f.notKept ? colors.border : colors.primary }]}>{f.notKept ? '–' : '✓'}</Text>
                      </Pressable>
                    ))}
                    {!moreOpen[p.id] && p.photos.length > THUMB_CAP ? (
                      <Pressable testID={`wa-more-${p.id}`} accessibilityRole="button" accessibilityLabel={fill(W.morePhotos, { n: p.photos.length - THUMB_CAP })} onPress={() => setMoreOpen((o) => ({ ...o, [p.id]: true }))} style={[styles.thumb, styles.moreChip, { borderColor: colors.border, backgroundColor: colors.card }]}>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>+{p.photos.length - THUMB_CAP}</Text>
                      </Pressable>
                    ) : null}
                  </ScrollView>
                </View>
              ) : null}
              {p.note ? <Text style={{ color: colors.danger }}>{p.state === 'needs_edit' ? `${W.stateNeedsEdit}: ` : ''}{p.note}</Text> : null}
              {p.state === 'failed' && !p.note ? <Text style={{ color: colors.danger }}>{W.stateFailed}</Text> : null}
              <Button label={badge.kind === 'update' ? W.editUpdate : W.edit} variant="secondary" disabled={locked || badge.kind === 'taken'} onPress={() => edit(p, badge)} />
              <Button testID={`wa-discard-${p.id}`} label={fill(W.discardPost, { c: label })} variant="secondary" size="sm" disabled={locked} onPress={() => discard(p, badge)} />
            </View>
          );
        }}
      />
      <View style={[styles.bottom, { borderColor: colors.border, backgroundColor: colors.bg }]}>
        <Text testID="wa-ready" style={{ color: colors.muted, textAlign: 'center' }}>{`${fill(W.willSave, { n: counts.willSave, a: counts.newCount, b: counts.updated, m: counts.skipped, x: counts.errors, y: counts.unchanged, z: counts.discarded })}${counts.unticked > 0 ? fill(W.willSaveUnticked, { u: counts.unticked }) : ''}`}</Text>
        <Button testID="wa-add" label={buttonLabel} progress={adding ? progress : undefined} disabled={adding || !canSave} onPress={addSelected} />
        {adding ? <Text style={{ color: colors.muted, textAlign: 'center' }}>{Math.round(progress * 100)}% · {W.leaveWarn}</Text> : null}
      </View>
    </View>
  );
}

type SummaryColors = { text: string; muted: string; border: string; danger: string; card: string; badSoft: string; badInk: string };
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** The unit read from the post as an organised summary (type, place, price, rooms, finishing...), the mandatory things it lacks in red. */
function SummaryGrid({ W, lang, J, post, colors }: { W: ReturnType<typeof wi>; lang: string; J: string; post: ImportPost; colors: SummaryColors }) {
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
    { k: 'land_area', label: L2 === 'en' ? 'Land' : 'الأرض', value: str(f.land_area) ? `${str(f.land_area)} ${W.sqm}` : '' },
    { k: 'garden_area', label: L2 === 'en' ? 'Garden' : 'الجنينة', value: str(f.garden_area) ? `${str(f.garden_area)} ${W.sqm}` : '' },
    { k: 'floor_level', label: L2 === 'en' ? 'Floor' : 'الدور', value: str(f.floor_level) },
    { k: 'rent_period', label: L2 === 'en' ? 'Rent' : 'الإيجار', value: f.rent_period === 'monthly' ? (L2 === 'en' ? 'Monthly' : 'شهري') : f.rent_period === 'yearly' ? (L2 === 'en' ? 'Yearly' : 'سنوي') : '' },
    { k: 'bedrooms', label: W.f_bedrooms, value: str(f.bedrooms) },
    { k: 'bathrooms', label: W.baths, value: str(f.bathrooms) },
    { k: 'finishing', label: L2 === 'en' ? 'Finishing' : 'التشطيب', value: labelOf(FINISHING, str(f.finishing), L2) ?? '' },
    { k: 'furnishing', label: L2 === 'en' ? 'Furnishing' : 'الفرش', value: labelOf(FURNISHING, str(f.furnishing), L2) ?? '' },
    { k: 'owner_phone', label: W.f_owner_phone, value: f.owner_phone ? ltr(displayPhone(str(f.owner_phone))) : '' },
  ];
  const alwaysShown = ['listing_type', 'property_type', 'compound', 'price_value', 'area_value', 'owner_phone'];
  const shown = cells.filter((c) => c.value || miss.has(c.k) || alwaysShown.includes(c.k));
  const missingNames = [...miss].map((k) => (W as unknown as Record<string, string>)[`f_${k}`] ?? k);
  return (
    <View testID={`wa-summary-${post.id}`} style={{ gap: 6 }}>
      <View style={styles.grid}>
        {shown.map((c) => {
          const bad = miss.has(c.k);
          return (
            <View key={c.k} testID={bad ? `wa-missing-${post.id}-${c.k}` : undefined} style={[styles.cell, { backgroundColor: bad ? colors.badSoft : colors.card, borderColor: bad ? colors.danger : colors.border }]}>
              <Text style={{ color: bad ? colors.badInk : colors.muted, fontSize: 11 }}>{c.label}</Text>
              <Text style={{ color: bad ? colors.badInk : colors.text, fontWeight: '700' }}>{bad && !c.value ? `⚠️ ${L2 === 'en' ? 'Missing' : 'ناقص'}` : c.value}</Text>
            </View>
          );
        })}
      </View>
      {missingNames.length ? <Text testID={`wa-missing-note-${post.id}`} style={{ color: colors.badInk, fontWeight: '600' }}>⛔ {fill(W.missingNote, { list: missingNames.join(J) })}</Text> : null}
    </View>
  );
}

function BadgeLine({ W, badge, colors }: { W: ReturnType<typeof wi>; badge: CodeBadge; colors: { muted: string; accent: string; danger: string; text: string } }) {
  if (badge.kind === 'none') return null;
  const [text, color] =
    badge.kind === 'update' ? [`🔄 ${fill(W.badgeUpdate, { c: badge.code })}${badge.photos ? ` · ${fill(W.badgeHas, { n: badge.photos })}` : ''}`, colors.accent]
    : badge.kind === 'new' ? [`🆕 ${fill(W.badgeNew, { c: badge.code })}`, colors.text]
    : badge.kind === 'taken' ? [`⛔ ${W.badgeTaken}`, colors.danger]
    : badge.kind === 'dup' ? [`⚠️ ${fill(W.badgeDup, { n: badge.of })}`, colors.danger]
    : badge.kind === 'checking' ? [W.badgeChecking, colors.muted]
    : [W.badgeFailed, colors.muted];
  return <Text testID={`wa-badge-${badge.kind}`} style={{ color, fontWeight: '600' }}>{text}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 220 },
  h: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, minWidth: 96 },
  bar: { height: 12, borderRadius: 6, alignSelf: 'stretch', overflow: 'hidden' },
  barFill: { height: 12 },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  hit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  box: { width: 26, height: 26, borderWidth: 2, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  headerBox: { gap: spacing.md, marginBottom: spacing.md },
  moreChip: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  strip: { gap: spacing.sm, paddingVertical: spacing.sm },
  photos: { gap: 4 },
  small: { fontSize: 12 },
  bold: { fontWeight: '700' },
  thumb: { width: 76, height: 76, borderRadius: 10 },
  dim: { opacity: 0.4 },
  tick: { position: 'absolute', top: 4, end: 4, fontSize: 12, paddingHorizontal: 5, borderRadius: 8, overflow: 'hidden' },
  bottom: { position: 'absolute', start: 0, end: 0, bottom: 0, padding: spacing.md, gap: spacing.sm, borderTopWidth: 1 },
});
