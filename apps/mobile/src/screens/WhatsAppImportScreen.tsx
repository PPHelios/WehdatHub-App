import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import { ApiClientError, ChatParse, phoneSchema } from '@wehdathub/shared';
import type { CodeState, UnitFields, UploadFile } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { SmartImage } from '../components/SmartImage';
import { placeLabel } from '../components/UnitBox';
import { FINISHING, FURNISHING, PROPERTY_TYPES, labelOf } from '../unitOptions';
import type { RootStackParams } from '../navigation';
import { toggleKeep } from '../photos';
import { uploadPhoto } from '../photoUpload';
import { compressPhotos } from '../compress';
import { reportError } from '../errorReport';
import { useRights } from '../rights';
import { newSaveKey, withSaveCheck } from '../saveKey';
import { radius, spacing, useTheme } from '../theme';
import { usage } from '../usage';
import { sendable, withImpliedFeatures } from '../unitRules';
import { buildImportPosts, blockedByCode, codeBadge, incomplete, keptOf, lacksDealType, lacksOwnerPhone, looksLikeZip, missingOf, stagePct, withDealType, withOwnerPhone } from '../whatsappImport';
import type { CodeBadge, ImportPost } from '../whatsappImport';
import { fill, wi } from '../whatsappImportText';
import { ZipImportError, cancelUnpack, cleanUp, unpackChat } from '../zipImport';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Phase = 'pick' | 'reading' | 'review';
type Stage = 'list' | 'chat' | 'photos' | 'match' | 'codes';

const plainDate = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
const nonEmpty = (f: UnitFields): UnitFields => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v !== undefined && v !== null)) as UnitFields;

/**
 * A WhatsApp "Export chat" zip, read on the phone: the posts with their photos, the codes checked against the agency's units,
 * a unit per post that can be added at once or opened in the add-unit screen to edit, pick its 15 photos and put them in order.
 */
export function WhatsAppImportScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const W = wi(lang);
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParams, 'WhatsAppImport'>>();
  const rights = useRights();
  const allowed = rights.manager || rights.agencyOwner || rights.dataEntry;

  const [zip, setZip] = useState<UploadFile | null>(route.params?.zip ?? null);
  const [since, setSince] = useState(ChatParse.defaultSince());
  const [phase, setPhase] = useState<Phase>('pick');
  const [pct, setPct] = useState(0);
  const [stage, setStage] = useState<Stage>('list');
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<ImportPost[]>([]);
  const [videos, setVideos] = useState(0);
  const [missing, setMissing] = useState(0);
  const [codes, setCodes] = useState<Record<string, CodeState> | null>(null);
  const [codeStatus, setCodeStatus] = useState<'checking' | 'done' | 'failed'>('checking');
  const [adding, setAdding] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [openText, setOpenText] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState(0);
  const dir = useRef<string | null>(null);
  const started = useRef(false);
  const stopped = useRef(false);

  const patchPost = useCallback((id: string, change: Partial<ImportPost>) => setList((l) => l.map((p) => (p.id === id ? { ...p, ...change } : p))), []);
  const setPhotos = (id: string, fn: (photos: UploadFile[]) => UploadFile[]) => setList((l) => l.map((p) => (p.id === id ? { ...p, photos: fn(p.photos) } : p)));

  // Photos unpacked into the phone's cache are deleted when the screen closes.
  useEffect(() => () => { cancelUnpack(); cleanUp(dir.current); }, []);

  const reasonText = (e: unknown) => {
    const r = e instanceof ZipImportError ? e.reason : 'failed';
    return r === 'not_zip' ? W.errNotZip : r === 'password' ? W.errPassword : r === 'too_big' ? W.errBig : r === 'no_space' ? W.errSpace : r === 'no_chat' ? W.errNoChat : r === 'cancelled' ? W.errCancelled : W.errFailed;
  };

  const read = useCallback(async (file: UploadFile) => {
    setError(null);
    setPhase('reading');
    setPct(0);
    setStage('list');
    stopped.current = false;
    cleanUp(dir.current);
    const t0 = Date.now();
    try {
      const out = await unpackChat(file.uri, since, (p, s) => { setPct((cur) => Math.max(cur, p)); setStage(s); });
      dir.current = out.dir;
      const posts = buildImportPosts(out.posts, out.dir, out.present);
      setVideos(out.skipped);
      usage('wa_import_read', true, Date.now() - t0, { posts: posts.length, photos: posts.reduce((n, p) => n + p.photos.length, 0), videos: out.skipped, stage: 'done' });
      setMissing(out.missing);
      if (!posts.length) { setList([]); setPhase('pick'); return setError(W.noPosts); }
      // The codes the posts write are checked once, in one call, before the list opens: update, new or taken.
      setStage('codes');
      setPct(stagePct('codes', 0));
      setCodeStatus('checking');
      const wanted = [...new Set(posts.map((p) => p.post.code).filter(Boolean))] as string[];
      if (wanted.length) {
        const tc = Date.now();
        try {
          const r = await api.codeCheck(wanted);
          usage('wa_import_codes', true, Date.now() - tc, { count: wanted.length });
          setCodes(r.codes);
          setCodeStatus('done');
        } catch {
          usage('wa_import_codes', false, Date.now() - tc, { count: wanted.length });
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
        rd.posts.forEach((r, k) => { if (posts[k]) { posts[k].fields = r.fields; posts[k].missing = r.missing; } });
        setReadFailed(false);
        usage('wa_import_reader', true, Date.now() - tr, { posts: posts.length, incomplete: posts.filter(incomplete).length });
      } catch {
        setReadFailed(true);
        usage('wa_import_reader', false, Date.now() - tr, { posts: posts.length });
      }
      setPct(100);
      setList(posts);
      setPhase('review');
    } catch (e) {
      // Why it failed (a zip problem, or something unexpected that is also reported as an error) goes to the usage log.
      usage('wa_import_read', false, Date.now() - t0, { reason: e instanceof ZipImportError ? e.reason : 'unexpected', stage: stage, ...(e instanceof ZipImportError && e.detail ? { detail: e.detail } : {}) });
      if (!(e instanceof ZipImportError)) reportError(e, 'WhatsAppImport.read');
      setPhase('pick');
      setError(reasonText(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since, lang]);

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
          const rv = await api.reviewUnit(sendable(withImpliedFeatures(nonEmpty(fields))), keptOf(p).length);
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

  // A zip shared from WhatsApp starts reading at once.
  useEffect(() => {
    if (started.current || !allowed || !route.params?.zip) return;
    started.current = true;
    read(route.params.zip);
  }, [allowed, read, route.params?.zip]);

  // An edited post that was saved in the add-unit screen comes back here marked as added.
  useEffect(() => {
    const s = route.params?.saved;
    if (s) { patchPost(s.id, { state: 'saved', savedCode: s.code, note: undefined }); usage('wa_import_edit', true, undefined, { outcome: 'saved' }); }
  }, [route.params?.saved, patchPost]);

  const choose = async () => {
    try {
      const [f] = await pick({ type: [types.zip, types.allFiles] });
      if (!f) return;
      if (!looksLikeZip({ name: f.name, type: f.type })) return setError(W.errNotZip);
      setZip({ uri: f.uri, name: f.name || 'chat.zip', type: 'application/zip' });
    } catch (e) {
      if (!(isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED)) setError(W.errFailed);
    }
  };

  const badges = useMemo(() => list.map((_, i) => codeBadge(list, i, codes, codeStatus)), [list, codes, codeStatus]);
  const totalPhotos = list.reduce((n, p) => n + p.photos.length, 0);
  // The reader could not be reached (a network problem, or a server without it): the list says so and offers to try again.
  const retryDetails = async () => {
    try {
      const rd = await api.chatRead(list.map((p) => p.post.text));
      setList((l) => l.map((p, k) => (rd.posts[k] ? { ...p, fields: rd.posts[k].fields, missing: rd.posts[k].missing } : p)));
      setReadFailed(false);
    } catch {
      setReadFailed(true);
    }
  };
  // Added in bulk: picked, not added yet, a free code, and every mandatory field read (the rest is opened by hand in the edit screen).
  const addable = (p: ImportPost, i: number) => p.picked && p.state !== 'saved' && !blockedByCode(badges[i]) && badges[i].kind !== 'update' && !incomplete(p) && Boolean(p.fields);

  const edit = (p: ImportPost, badge: CodeBadge) => {
    usage('wa_import_edit', true, undefined, { kind: badge.kind, missing: p.missing?.length ?? 0 });
    const ordered = [...keptOf(p), ...p.photos.filter((x) => x.notKept)];
    nav.navigate('AddUnit', { text: p.post.orig || p.post.text, photos: ordered, fresh: true, noAi: true, fields: p.fields, ...(p.post.code ? { code: p.post.code } : {}), importId: p.id, ...(badge.kind === 'update' ? { edit: badge.code } : {}) });
  };

  // One post, added without opening it: read, review, upload its 15 photos, save. Anything that needs a person is left for the edit screen.
  const addOne = async (p: ImportPost): Promise<'saved' | 'needs_edit' | 'blocked'> => {
    const fields: UnitFields = { ...nonEmpty(p.fields ?? {}) };
    if (p.post.code && !fields.code) fields.code = p.post.code;
    const body = sendable(withImpliedFeatures(fields));
    const kept = keptOf(p);
    const rv = await api.reviewUnit(body, kept.length);
    if (rv.blockers.length) { patchPost(p.id, { state: 'needs_edit', note: rv.blockers.map((b) => b.label).join(' · ') }); return 'needs_edit'; }
    if (rv.duplicate) { patchPost(p.id, { state: 'needs_edit', note: fill(W.noteDuplicate, { c: rv.duplicate }) }); return 'needs_edit'; }
    const key = newSaveKey();
    let keys: string[] | undefined;
    let legacy: UploadFile[] = [];
    if (kept.length) {
      try {
        const links = (await api.photoUploadLinks(Math.max(1, Math.min(15, kept.length)))).uploads;
        keys = [];
        for (const file of kept) {
          const link = links.shift();
          if (!link) throw new Error('links');
          await uploadPhoto(file, link, () => undefined);
          keys.push(link.key);
        }
      } catch (e) {
        if (e instanceof ApiClientError && (e.status === 404 || e.status === 405)) { keys = undefined; legacy = await compressPhotos(kept); }
        else { patchPost(p.id, { state: 'needs_edit', note: W.noteUploadFailed }); return 'needs_edit'; }
      }
    }
    const res = await withSaveCheck(api.createUnit(body, legacy, key, keys), () => api.unitSaveStatus(key));
    patchPost(p.id, { state: 'saved', savedCode: (res as { code: string }).code, note: undefined });
    return 'saved';
  };

  const addSelected = async () => {
    const todo = list.filter(addable);
    if (!todo.length) return;
    setAdding(true);
    setProgress(0);
    stopped.current = false;
    let done = 0;
    for (const p of todo) {
      if (stopped.current) break;
      patchPost(p.id, { state: 'working', note: undefined });
      const t0 = Date.now();
      const photos = keptOf(p).length;
      try {
        const r = await addOne(p);
        usage('wa_import_add', r === 'saved', Date.now() - t0, { outcome: r, ai: false, photos });
        if (r === 'blocked') break;
      } catch (e) {
        usage('wa_import_add', false, Date.now() - t0, { outcome: 'failed', ai: false, photos, reason: e instanceof ApiClientError ? String(e.code || e.status) : 'unexpected' });
        if (!(e instanceof ApiClientError)) reportError(e, 'WhatsAppImport.add');
        patchPost(p.id, { state: 'failed', note: e instanceof ApiClientError && e.code === 'plan_limit' ? undefined : W.noteFailed });
        if (e instanceof ApiClientError && e.code === 'plan_limit') { Alert.alert(W.title, lang === 'en' ? "You reached your plan's unit limit." : 'وصلت للحد الأقصى للوحدات في باقتك.'); break; }
      }
      done += 1;
      setProgress(done / todo.length);
    }
    setAdding(false);
  };

  const readyCount = list.filter(addable).length;
  const incompleteCount = list.filter((p) => p.state !== 'saved' && incomplete(p)).length;
  const buttonLabel = `${W.addSelected} (${readyCount})`;

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
        <View style={[styles.bar, { backgroundColor: colors.border }]}><View testID="wa-bar" style={[styles.barFill, { backgroundColor: colors.primary, width: `${pct}%` }]} /></View>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>{W.keepOpen}</Text>
        <Button label={W.cancel} variant="secondary" onPress={() => { cancelUnpack(); }} />
      </View>
    );
  }

  if (phase === 'pick') {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.muted }}>{W.intro}</Text>
        {error ? <Text testID="wa-error" style={{ color: colors.danger }}>{error}</Text> : null}
        <Field label={W.from} value={since} onChangeText={setSince} autoCapitalize="none" />
        <View style={styles.chips}>
          {[[7, W.days7], [14, W.days14], [30, W.days30], [90, W.days90]].map(([d, label]) => (
            <Pressable key={String(d)} accessibilityRole="button" onPress={() => setSince(plainDate(Number(d)))} style={[styles.chip, { borderColor: colors.border }]}><Text style={{ color: colors.text }}>{label}</Text></Pressable>
          ))}
        </View>
        <Text style={{ color: colors.muted }}>{W.rulesHint}</Text>
        <Button label={zip ? zip.name : W.pick} variant="secondary" onPress={choose} />
        <Button testID="wa-read" label={W.read} disabled={!zip} onPress={() => (zip ? read(zip) : undefined)} />
      </ScrollView>
    );
  }

  const added = list.filter((p) => p.state === 'saved').length;
  const needs = list.filter((p) => p.state === 'needs_edit' || p.state === 'failed').length;
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text testID="wa-summary" style={{ color: colors.text, fontWeight: '700' }}>{fill(W.summary, { n: list.length, p: totalPhotos })}</Text>
        {videos ? <Text style={{ color: colors.muted }}>🎞 {fill(W.videos, { n: videos })}</Text> : null}
        {missing ? <Text style={{ color: colors.muted }}>{fill(W.missing, { n: missing })}</Text> : null}
        {added || needs ? <Text style={{ color: colors.text }}>{fill(W.doneLine, { a: added, b: needs })}</Text> : null}
        {bulkCount.deal + bulkCount.owner > 0 ? (
          <View testID="wa-bulk" style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>🧰 {W.bulkTitle}</Text>
            {bulkCount.deal > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.text }}>{fill(W.bulkDeal, { n: bulkCount.deal })}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}><Button testID="wa-all-rent" label={W.allRent} variant="secondary" loading={bulkBusy} onPress={() => applyBulk((f) => withDealType(f, 'rent'), lacksDealType)} /></View>
                  <View style={{ flex: 1 }}><Button testID="wa-all-sale" label={W.allSale} variant="secondary" loading={bulkBusy} onPress={() => applyBulk((f) => withDealType(f, 'sale'), lacksDealType)} /></View>
                </View>
              </View>
            ) : null}
            {bulkCount.owner > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.text }}>{fill(W.bulkOwner, { n: bulkCount.owner })}</Text>
                <Field testID="wa-owner-all" label="" value={ownerAll} onChangeText={(v: string) => { setOwnerAll(v); setOwnerBad(false); }} keyboardType="phone-pad" placeholder={W.bulkOwnerPlaceholder} />
                {ownerBad ? <Text testID="wa-owner-bad" style={{ color: colors.danger }}>{W.bulkBadPhone}</Text> : null}
                <Button testID="wa-owner-apply" label={W.bulkOwnerApply} variant="secondary" loading={bulkBusy} onPress={() => {
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
        {list.map((p, i) => {
          const badge = badges[i];
          const kept = keptOf(p).length;
          const locked = p.state === 'saved' || p.state === 'working';
          const open = Boolean(openText[p.id]);
          return (
            <View key={p.id} testID={`wa-post-${p.id}`} style={[styles.card, { borderColor: p.missing?.length ? colors.danger : colors.border, backgroundColor: colors.card }]}>
              <View style={styles.row}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: p.picked }} onPress={() => patchPost(p.id, { picked: !p.picked })} style={[styles.box, { borderColor: colors.primary, backgroundColor: p.picked ? colors.primary : 'transparent' }]}>
                  <Text style={{ color: p.picked ? colors.onPrimary : 'transparent' }}>✓</Text>
                </Pressable>
                <View style={styles.flex}>
                  <BadgeLine W={W} badge={badge} colors={colors} />
                  <Text style={[styles.small, { color: colors.muted }]} numberOfLines={1}>{[p.post.sender, p.post.at].filter(Boolean).join('  ·  ')}</Text>
                </View>
                {p.state === 'working' ? <ActivityIndicator color={colors.primary} /> : null}
                {p.state === 'saved' ? <Text style={[styles.bold, { color: colors.accent }]}>✓ {W.stateSaved}{p.savedCode ? ` ${p.savedCode}` : ''}</Text> : null}
              </View>
              <SummaryGrid W={W} lang={lang} post={p} colors={colors} />
              <Pressable testID={`wa-desc-${p.id}`} accessibilityRole="button" onPress={() => setOpenText((o) => ({ ...o, [p.id]: !o[p.id] }))}>
                <Text style={[styles.small, styles.bold, { color: colors.muted }]}>💬 {W.originalTitle}</Text>
                <Text style={[styles.small, { color: colors.muted }]} numberOfLines={open ? undefined : 3}>{p.post.orig || p.post.text}</Text>
                <Text style={[styles.small, { color: colors.primary }]}>{open ? W.showLess : W.showMore}</Text>
              </Pressable>
              {p.photos.length ? (
                <View style={styles.photos}>
                  <Text testID={`wa-count-${p.id}`} style={{ color: colors.muted }}>📷 {fill(W.kept, { k: kept })}{p.post.videos ? `  ·  ${fill(W.videosPost, { n: p.post.videos })}` : ''}</Text>
                  {p.photos.length > 15 ? <Text style={{ color: colors.accent }}>{W.pickNote}</Text> : null}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                    {p.photos.map((f) => (
                      <Pressable key={f.uri} disabled={locked} onPress={() => setPhotos(p.id, (ph) => toggleKeep(ph, f.uri))} style={f.notKept ? styles.dim : undefined}>
                        <SmartImage uri={f.uri} style={styles.thumb} />
                        <Text style={[styles.tick, { backgroundColor: f.notKept ? colors.border : colors.primary }]}>{f.notKept ? '–' : '✓'}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              {p.note ? <Text style={{ color: colors.danger }}>{p.state === 'needs_edit' ? `${W.stateNeedsEdit}: ` : ''}{p.note}</Text> : null}
              {p.state === 'failed' && !p.note ? <Text style={{ color: colors.danger }}>{W.stateFailed}</Text> : null}
              {p.state !== 'saved' ? <Button label={badge.kind === 'update' ? W.editUpdate : W.edit} variant="secondary" disabled={p.state === 'working' || badge.kind === 'taken'} onPress={() => edit(p, badge)} /> : <Button label={W.openUnit} variant="secondary" onPress={() => nav.navigate('Unit', { code: p.savedCode as string })} />}
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.bottom, { borderColor: colors.border, backgroundColor: colors.bg }]}>
        <Text testID="wa-ready" style={{ color: colors.muted, textAlign: 'center' }}>{fill(W.addableLine, { n: readyCount, m: incompleteCount })}</Text>
        <Button testID="wa-add" label={buttonLabel} progress={adding ? progress : undefined} disabled={adding || !list.some(addable)} onPress={addSelected} />
        {adding ? <Text style={{ color: colors.muted, textAlign: 'center' }}>{Math.round(progress * 100)}% · {W.leaveWarn}</Text> : null}
      </View>
    </View>
  );
}

type SummaryColors = { text: string; muted: string; border: string; danger: string; card: string };
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** The unit read from the post as an organised summary (type, place, price, rooms, finishing...), the mandatory things it lacks in red. */
function SummaryGrid({ W, lang, post, colors }: { W: ReturnType<typeof wi>; lang: string; post: ImportPost; colors: SummaryColors }) {
  const f = post.fields;
  if (!f) return null;
  const L2 = lang === 'en' ? 'en' : 'ar';
  const miss = new Set(post.missing ?? []);
  const lt = str(f.listing_type);
  const price = str(f.price_value);
  const cells: { k: string; label: string; value: string }[] = [
    { k: 'listing_type', label: W.f_listing_type, value: lt === 'sale' ? W.sale : lt === 'rent' ? W.rent : '' },
    { k: 'property_type', label: W.f_property_type, value: labelOf(PROPERTY_TYPES, str(f.property_type), L2) ?? '' },
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
    { k: 'owner_phone', label: W.f_owner_phone, value: str(f.owner_phone) },
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
            <View key={c.k} testID={bad ? `wa-missing-${post.id}-${c.k}` : undefined} style={[styles.cell, { backgroundColor: bad ? '#fdecec' : colors.card, borderColor: bad ? '#d64545' : colors.border }]}>
              <Text style={{ color: bad ? '#8f1d1d' : colors.muted, fontSize: 11 }}>{c.label}</Text>
              <Text style={{ color: bad ? '#8f1d1d' : colors.text, fontWeight: '700' }}>{bad && !c.value ? `⚠️ ${L2 === 'en' ? 'Missing' : 'ناقص'}` : c.value}</Text>
            </View>
          );
        })}
      </View>
      {missingNames.length ? <Text testID={`wa-missing-note-${post.id}`} style={{ color: '#8f1d1d', fontWeight: '600' }}>⛔ {fill(W.missingNote, { list: missingNames.join('، ') })}</Text> : null}
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
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  box: { width: 26, height: 26, borderWidth: 2, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  strip: { gap: spacing.sm, paddingVertical: spacing.sm },
  photos: { gap: 4 },
  small: { fontSize: 12 },
  bold: { fontWeight: '700' },
  thumb: { width: 76, height: 76, borderRadius: 10 },
  dim: { opacity: 0.4 },
  tick: { position: 'absolute', top: 4, end: 4, color: '#fff', fontSize: 12, paddingHorizontal: 5, borderRadius: 8, overflow: 'hidden' },
  bottom: { position: 'absolute', start: 0, end: 0, bottom: 0, padding: spacing.md, gap: spacing.sm, borderTopWidth: 1 },
});
