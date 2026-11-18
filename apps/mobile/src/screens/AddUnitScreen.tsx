import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError } from '@wehdathub/shared';
import type { ReviewResult, UnitFields, UploadFile, VoiceFile } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { useRights } from '../rights';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { UnitBox, featureKeys, placeLabel, readMessage, PASTE_MIN } from '../components/UnitBox';
import { DeliverySection, OwnerSection, SectionHead, SizeSection, SwitchRow } from '../components/UnitSections';
import { addPendingPlace } from '../placeList';
import { SortablePhotos } from '../components/SortablePhotos';
import { clearDraft, isEmptyDraft, loadDraft, saveDraft } from '../draft';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { MAX_PHOTOS, MAX_POOL, addPicked, pickPhotos, takePhoto, toggleKeep } from '../photos';
import { compressPhotos } from '../compress';
import { usePhotoUploads } from '../usePhotoUploads';
import { SaveNotConfirmed, newSaveKey, withSaveCheck } from '../saveKey';
import { ALL_TYPES, FINISHING, FURNISHING, PROPERTY_TYPES, labelOf, options } from '../unitOptions';
import { radius, spacing, useTheme } from '../theme';
import { tick } from '../haptics';
import { track } from '../analytics';
import { HoldMic } from '../components/HoldMic';
import { featureChip } from '../featureLabels';
import { draftText, isAutoDraft } from '../unitDraft';
import { uf } from '../unitFormText';
import { sendable, stepOf, stepsFor, withImpliedFeatures } from '../unitRules';
import type { Step } from '../unitRules';

const str = (v: UnitFields[string]): string => (typeof v === 'string' ? v : '');
/** In edit mode a photo already on the unit is listed with this type and its image id as name. */
export const EXISTING = 'existing';
export const photoChanges = (original: string[], list: UploadFile[]) => {
  const kept = list.filter((p) => p.type === EXISTING).map((p) => p.name);
  const add = list.filter((p) => p.type !== EXISTING);
  const remove = original.filter((id) => !kept.includes(id));
  const reordered = kept.join() !== original.filter((id) => kept.includes(id)).join();
  return { add, remove, order: kept, changed: add.length > 0 || remove.length > 0 || reordered };
};

type Blocker = { field: string; label: string };

export function AddUnitScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const L = uf(lang);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const rights = useRights();
  const canWhatsApp = (rights.manager || rights.agencyOwner || rights.dataEntry) && rights.addUnits; // the same people the server menu gives the WhatsApp import
  const route = useRoute<RouteProp<RootStackParams, 'AddUnit'>>();
  const qc = useQueryClient();
  const [fields, setFields] = useState<UnitFields>({ listing_type: 'sale' });
  const [describe, setDescribe] = useState('');
  const [photos, setPhotos] = useState<UploadFile[]>([]);
  const uploads = usePhotoUploads(photos, setPhotos);
  // Only the kept photos (at most 15) are ever uploaded or saved, and only when Save is pressed.
  const kept = photos.filter((p) => !p.notKept);
  const [slow, setSlow] = useState<string | null>(null);
  const [dupAck, setDupAck] = useState(false);
  const saved = useRef(false);
  const [photoAi, setPhotoAi] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [failedCheck, setFailedCheck] = useState(false);
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const saveKey = useRef(newSaveKey());
  const dirty = useRef(false);
  const shared = useRef(route.params);
  const editCode = route.params?.edit;
  // Opened from the WhatsApp import: its own draft, not the person's saved one; saving goes back to the import list.
  const importId = route.params?.importId;
  const fresh = Boolean(route.params?.fresh);
  const [version, setVersion] = useState(0);
  const savedDetails = useRef<string | null>(null);
  const originalIds = useRef<string[]>([]);
  // One page with four sections: the links on top scroll to them.
  const scroll = useRef<ScrollViewInstance>(null);
  const anchors = useRef<Partial<Record<Step, number>>>({});
  // The client description follows the fields while it is empty or still the draft (web: unitFields.js).
  const descAuto = useRef(true);

  const patch = (p: UnitFields) => {
    dirty.current = true;
    setAck(false);
    setFields((f) => withImpliedFeatures({ ...f, ...p }));
  };
  const set = (k: string, v: UnitFields[string]) => {
    if (k === 'clean_summary') descAuto.current = isAutoDraft(String(v ?? ''));
    patch({ [k]: v });
  };
  // Mandatory fields have their own border (blue, red once a check has failed). A studio, shop, office or land has no bedrooms.
  const noBedrooms = ['studio', 'office', 'shop', 'clinic', 'commercial', 'land'].includes(str(fields.property_type));
  const REQUIRED = ['owner_phone', 'price_value', 'area_value', ...(noBedrooms ? [] : ['bedrooms']), ...(fields.owner_name_from_phone === '1' ? [] : ['owner_name'])];
  // The place (a compound, or an area) is mandatory: checked here at once, and again by the server's review.
  const placeMissing = !placeLabel(fields) && !str(fields.compound) && !str(fields.area_id) && !str(fields.subzone_id);
  const fromServer = review?.blockers ?? blockers;
  const allBlockers: Blocker[] = [...(placeMissing && !fromServer.some((b) => b.field === 'location') ? [{ field: 'location', label: L.boxNoPlace }] : []), ...fromServer];
  const missing = (k: string) => allBlockers.some((b) => b.field === k);
  const field = (k: string, label: string, extra: object = {}) => <Field key={k} testID={`f-${k}`} label={label} value={str(fields[k])} onChangeText={(v) => set(k, v)} required={REQUIRED.includes(k)} invalid={failedCheck && missing(k)} {...extra} />;

  const draftLabels = (f: UnitFields) => ({
    type: labelOf(ALL_TYPES, str(f.property_type), lang) ?? '',
    place: placeLabel(f),
    finishing: labelOf(FINISHING, str(f.finishing), lang) ?? '',
    furnishing: labelOf(FURNISHING, str(f.furnishing), lang) ?? '',
    features: featureKeys(f).map((k) => featureChip(k, lang).label),
  });
  useEffect(() => {
    if (!ready || !descAuto.current) return;
    const text = draftText(fields, draftLabels(fields), lang === 'en');
    if (text !== str(fields.clean_summary)) setFields((f) => ({ ...f, clean_summary: text }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, ready, lang]);
  const writeDraftAgain = () => {
    descAuto.current = true;
    patch({ clean_summary: draftText(fields, draftLabels(fields), lang === 'en') });
  };

  // Fill from a message and/or a voice note. What the form already says is sent along and kept.
  const runFill = useCallback(async (o: { describe?: string; voice?: UploadFile }) => {
    setError(null);
    setNotice(null);
    try {
      const r = await api.extractUnit({ describe: o.describe, voice: o.voice, fields: sendable(fields) });
      setFields((f) => withImpliedFeatures({ ...f, ...Object.fromEntries(Object.entries(r.fields).filter(([, v]) => v !== '' && v !== undefined && v !== null)) }));
      setNotice(t(lang, 'filled'));
    } catch (e) {
      setError(e instanceof ApiClientError && (e.status === 402 || e.status === 503) ? t(lang, 'aiBlocked') : errorText(e, lang));
    }
  }, [fields, lang]);

  // Start: restore a saved draft, then apply anything shared in from another app.
  useEffect(() => {
    (async () => {
      if (editCode) {
        try {
          const [r, u] = await Promise.all([api.unitEditFields(editCode), api.unit(editCode)]);
          setFields(r.fields);
          descAuto.current = isAutoDraft(str(r.fields.clean_summary));
          setVersion(r.version);
          setPhotos(u.images.map((i) => ({ uri: i.url, name: i.id, type: EXISTING })));
          originalIds.current = u.images.map((i) => i.id);
          // From the WhatsApp import: the post's photos join the unit's own (the first 15 are kept), and its message fills in.
          const sh = shared.current;
          if (sh?.photos?.length) setPhotos((p) => addPicked(p, sh.photos!));
          if (sh?.text) { setDescribe(sh.text); if (!sh.noAi) await runFill({ describe: sh.text }); }
          if (sh?.fields) setFields((f) => withImpliedFeatures({ ...f, ...Object.fromEntries(Object.entries(sh.fields!).filter(([k, v]) => k !== 'code' && v !== '' && v !== undefined && v !== null)) }));
        } catch (e) {
          setError(errorText(e, lang));
        }
        setReady(true);
        return;
      }
      const d = await loadDraft();
      if (!fresh && d && !isEmptyDraft(d)) {
        setFields(d.fields);
        descAuto.current = isAutoDraft(str(d.fields.clean_summary));
        setDescribe(d.describe);
        setPhotos(d.photos);
        setPhotoAi(d.photoAi);
        setNotice(t(lang, 'draftRestored'));
      }
      const s = shared.current;
      if (s) {
        setNotice(t(lang, 'sharedIn'));
        if (s.photos?.length) setPhotos((p) => addPicked(p, s.photos!));
        if (s.text) setDescribe((cur) => (cur ? `${cur}\n${s.text}` : s.text!));
      }
      setReady(true);
      if (s?.fields) { patch(Object.fromEntries(Object.entries(s.fields).filter(([, v]) => v !== '' && v !== undefined && v !== null))); setNotice(L.boxFromText); }
      if (s?.code && !s.fields?.code && !s.edit) patch({ code: s.code });
      else if (s?.noAi && s.text) readMessage(s.text, {}).then((p) => { if (Object.keys(p).length) { patch(p); setNotice(L.boxFromText); } }).catch(() => undefined);
      else if (s?.text || s?.voice) await runFill({ describe: s.text, voice: s.voice });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save the draft as the broker types (after a short pause).
  useEffect(() => {
    if (!ready || editCode || fresh) return;
    const h = setTimeout(() => saveDraft({ fields, photos, describe, photoAi }), 600);
    return () => clearTimeout(h);
  }, [fields, photos, describe, photoAi, ready, editCode, fresh]);

  // The server checks the form as the broker types: what is missing, warnings, a duplicate and (edit) what changes.
  useEffect(() => {
    if (!ready) return;
    let live = true;
    const h = setTimeout(() => {
      api.reviewUnit(sendable(fields), kept.length, editCode).then((r) => { if (live) setReview(r); }).catch(() => undefined);
    }, 700);
    return () => { live = false; clearTimeout(h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, kept.length, ready, editCode]);

  // Leaving with unsaved edits asks first (a new unit keeps its draft, so only edits ask).
  useEffect(() => nav.addListener?.('beforeRemove', (e) => {
    if (!editCode || !dirty.current || saving || saved.current) return;
    e.preventDefault();
    Alert.alert(t(lang, 'leaveTitle'), t(lang, 'leaveBody'), [
      { text: t(lang, 'stay'), style: 'cancel' },
      { text: t(lang, 'leave'), style: 'destructive', onPress: () => nav.dispatch(e.data.action) },
    ]);
  }), [nav, editCode, saving, lang]);

  const onVoice = async (file: VoiceFile) => {
    setError(null);
    try {
      await runFill({ voice: file });
    } catch (e) {
      setError(errorText(e, lang));
    }
  };

  // Pasting a message into the top box reads its place and features at once (no AI); the text stays for "Fill".
  const onDescribe = (v: string) => {
    const pasted = v.length - describe.length >= PASTE_MIN;
    setDescribe(v);
    if (pasted) readMessage(v, fields).then((p) => { if (Object.keys(p).length) { patch(p); setNotice(L.boxFromText); } }).catch(() => undefined);
  };

  const addPhotos = async (fn: () => Promise<UploadFile[]>) => {
    try {
      const got = await fn();
      setPhotos((p) => addPicked(p, got));
    } catch {
      setError(t(lang, 'serverError'));
    }
  };

  // A rental has no delivery and payment section.
  const flow = stepsFor(fields);
  const jump = (s: Step) => scroll.current?.scrollTo({ y: anchors.current[s] ?? 0, animated: true });

  // After a refused save, scrolls to the earliest section that still has a blocker, so the person lands where the fix is.
  const toBlocked = (list: Blocker[]) => {
    if (!list.length) return;
    const first = Math.min(...list.map((x) => stepOf(x.field))) as Step;
    jump(flow.includes(first) ? first : flow[flow.length - 1]);
  };

  const save = async (force = false) => {
    if (saving) return;
    if (allBlockers.length) { setFailedCheck(true); setBlockers(allBlockers); toBlocked(allBlockers); return; }
    // A look-alike unit asks before anything is uploaded; accepting it once (the switch or Save anyway) is never asked again.
    const accepted = force || dupAck;
    if (!editCode && !accepted && review?.duplicate) return setDuplicate(review.duplicate);
    if (accepted) setDupAck(true);
    dirty.current = false;
    setSaving(true);
    setProgress(0);
    setSlow(null);
    // Photos prepared first (60%), then the wait for the server creeps toward 95% until the answer.
    const creep = setInterval(() => setProgress((p) => (p >= 0.6 && p < 0.95 ? p + 0.01 : p)), 600);
    try {
      // A new unit uploads its photos first (the live review already checked the form). An edit saves its details first, so a
      // changed-elsewhere refusal costs no upload, and uploads inside doSave.
      const files = editCode ? kept : await sendPhotos();
      if (!files) { dirty.current = true; return setError(t(lang, 'photosRetry')); }
      await doSave(accepted, files);
    } finally { clearInterval(creep); setSaving(false); setSlow(null); }
  };

  // The kept photos go to storage now, with their own % on the Save button and a note when the connection is slow.
  const sendPhotos = () => {
    const t0 = Date.now();
    return uploads.uploadAll((_done, _total, frac) => {
      setProgress(0.6 * frac);
      const spent = (Date.now() - t0) / 1000;
      const eta = frac > 0.02 ? (spent * (1 - frac)) / frac : 0;
      setSlow(spent > 4 && eta > 40 ? t(lang, 'slowNet').replace('{m}', String(Math.max(1, Math.round(eta / 60)))) : null);
    });
  };

  const doSave = async (force: boolean, files: UploadFile[]) => {
    setError(null);
    setBlockers([]);
    setFailedCheck(false);
    setDuplicate(null);
    const body = sendable(fields);
    try {
      if (editCode) {
        // The details and the photos are two calls. If the photos fail, the details are already saved: a second Save then only
        // retries the photos, so it never meets "changed elsewhere" from its own first save.
        const key = JSON.stringify(body);
        if (savedDetails.current !== key) {
          const saved = await api.saveUnitEdit(editCode, version, body, saveKey.current);
          setVersion(saved.version);
          savedDetails.current = key;
        }
        const sent = await sendPhotos();
        if (!sent) { dirty.current = true; return setError(t(lang, 'photosRetry')); }
        const ph = photoChanges(originalIds.current, sent);
        if (ph.changed) {
          try {
            const keyed = ph.add.length > 0 && ph.add.every((p) => p.key);
            await api.unitPhotos(editCode, keyed ? { photoKeys: ph.add.map((p) => p.key as string), remove: ph.remove, order: ph.order } : { add: await compressPhotos(ph.add), remove: ph.remove, order: ph.order });
          } catch {
            return setError(t(lang, 'photosRetry'));
          }
        }
        tick();
        saved.current = true;
        await Promise.all([qc.invalidateQueries({ queryKey: ['units'] }), qc.invalidateQueries({ queryKey: ['unit', editCode] })]);
        if (importId) return nav.navigate('WhatsAppImport', { saved: { id: importId, code: editCode } });
        return nav.goBack();
      }
      const sent = { ...body, photo_ai: photoAi ? '1' : '', ...(force ? { force: '1' } : {}) };
      // Photos already stored by their own upload go as keys; on an old server they are prepared and sent here as before.
      const keyed = files.length > 0 && files.every((p) => p.key);
      const prepared = keyed ? [] : await compressPhotos(files, (d, n) => setProgress(0.6 * (d / Math.max(1, n))));
      setProgress(0.6);
      const r = await withSaveCheck(api.createUnit(sent, prepared, saveKey.current, keyed ? files.map((p) => p.key as string) : undefined), () => api.unitSaveStatus(saveKey.current));
      setProgress(1);
      saveKey.current = newSaveKey();
      saved.current = true;
      tick();
      track('unit_saved', { photos: files.length });
      // A compound the list does not know is saved as pending on the server; show it on this phone straight away.
      if (fields.compound_new === '1' && str(fields.compound)) addPendingPlace(str(fields.compound)).catch(() => undefined);
      if (!fresh) await clearDraft();
      await qc.invalidateQueries({ queryKey: ['units'] });
      if (importId) return nav.navigate('WhatsAppImport', { saved: { id: importId, code: r.code } });
      nav.replace('Unit', { code: r.code });
    } catch (e) {
      track('unit_save_refused', { reason: e instanceof ApiClientError ? String(e.code || e.status) : 'error' });
      if (e instanceof SaveNotConfirmed) return setError(t(lang, 'saveNotConfirmed'));
      if (!(e instanceof ApiClientError)) return setError(errorText(e, lang));
      if (editCode && e.code === 'conflict') return setError(t(lang, 'changedElsewhere'));
      if (editCode && e.code === 'incomplete') { setFailedCheck(true); return setBlockers((e.extra.blockers as Blocker[]) ?? []); }
      if (e.code === 'incomplete') {
        const rv = await api.reviewUnit(body, files.length).catch(() => null);
        setFailedCheck(true);
        toBlocked(rv?.blockers ?? []);
        return setBlockers(rv?.blockers ?? []);
      }
      if (e.code === 'duplicate') {
        const rv = await api.reviewUnit(body, files.length).catch(() => null);
        return setDuplicate(rv?.duplicate ?? '');
      }
      if (e.code === 'owner_name_required') return setError(t(lang, 'ownerNameNeeded'));
      if (e.code === 'compound_unknown') {
        const like = ((e.extra.suggestions as { name: string }[]) ?? []).map((x) => x.name).filter(Boolean);
        return setError(like.length ? `${t(lang, 'compoundUnknown')} ${t(lang, 'didYouMean')} ${like.join(' / ')}` : t(lang, 'compoundUnknown'));
      }
      if (e.code === 'plan_limit') return setError(t(lang, 'planLimit'));
      if (e.code === 'photo_missing') { setPhotos((p) => p.map((x) => (x.type === EXISTING ? x : { ...x, key: undefined, pct: undefined, failed: false }))); return setError(t(lang, 'photosExpired')); }
      setError(errorText(e, lang));
    }
  };

  const discard = async () => {
    await clearDraft();
    setFields({ listing_type: 'sale' });
    descAuto.current = true;
    setDescribe('');
    setPhotos([]);
    setNotice(null);
  };

  const stepName = (s: Step) => (s === 1 ? L.step1 : s === 2 ? L.step2 : s === 3 ? L.step3 : L.step4);
  const anchor = (s: Step) => ({ onLayout: (e: { nativeEvent: { layout: { y: number } } }) => { anchors.current[s] = e.nativeEvent.layout.y; } });
  const saveDisabled = saving || Boolean(review?.warnings.length && !review.blockers.length && !ack);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView ref={scroll} style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.content, saving && styles.locked]} keyboardShouldPersistTaps="handled" scrollEnabled={!dragging} pointerEvents={saving ? 'none' : 'auto'}>
        <View style={styles.jump}>
          {flow.map((n) => <Pressable key={n} testID={`jump-${n}`} accessibilityRole="link" onPress={() => jump(n)} style={[styles.jumpChip, { borderColor: colors.border }]}><Text style={{ color: colors.text, fontWeight: '600' }}>{stepName(n)}</Text></Pressable>)}
        </View>

        {!editCode && !importId && canWhatsApp ? <Button testID="add-from-whatsapp" variant="secondary" label={`💬 ${t(lang, 'whatsappImport')}`} onPress={() => nav.navigate('WhatsAppImport')} /> : null}

        {/* A refused save and a look-alike unit show at the top. */}
        {failedCheck && allBlockers.length ? (
          <View testID="blockers" style={[styles.box, { borderColor: colors.danger }]}>
            <Text style={{ color: colors.danger, fontWeight: '700' }}>{t(lang, 'stillNeeded')}</Text>
            {allBlockers.map((b) => <Text key={b.field} style={{ color: colors.text }}>• {b.label}</Text>)}
          </View>
        ) : null}
        {(duplicate ?? (editCode ? null : review?.duplicate ?? null)) !== null ? (
          <View testID="duplicate" style={[styles.box, { borderColor: colors.accent }]}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{t(lang, 'duplicateAsk')} {duplicate ?? review?.duplicate}</Text>
            <SwitchRow label={t(lang, 'dupOk')} value={dupAck} onChange={setDupAck} testID="dup-ack" />
            <Button label={t(lang, 'saveAnyway')} onPress={() => save(true)} />
            {duplicate !== null ? <Button label={t(lang, 'cancel')} variant="secondary" onPress={() => setDuplicate(null)} /> : null}
          </View>
        ) : null}

        <View style={styles.stack} {...anchor(1)}>
          <SectionHead n={1} title={L.step1} />
          <Field testID="describe" label={importId ? (lang === 'en' ? '💬 Original message (to compare with the fields below)' : '💬 الرسالة الأصلية (للمقارنة مع البيانات تحت)') : t(lang, 'describePlaceholder')} value={describe} onChangeText={onDescribe} multiline />
          {importId ? null : (
            <View style={styles.row}>
              <View style={styles.flex}><Button testID="fill" label={t(lang, 'fillBtn')} onPress={() => runFill({ describe })} disabled={!describe.trim()} /></View>
              <View style={styles.flex}><HoldMic testID="unit-mic" label={t(lang, 'mic')} onFile={onVoice} onError={setError} /></View>
            </View>
          )}
          {notice ? <Text testID="unit-notice" style={{ color: colors.accent }}>{notice}</Text> : null}
          <UnitBox fields={fields} patch={patch} lang={lang} invalid={failedCheck && missing('location')} />
          {editCode ? null : field('code', lang === 'en' ? 'Unit code (optional)' : 'كود الوحدة (اختياري)', { autoCapitalize: 'characters', autoCorrect: false })}
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fDeal')}</Text>
          <Chips options={[{ value: 'sale', label: t(lang, 'sale') }, { value: 'rent', label: t(lang, 'rent') }]} value={str(fields.listing_type)} onChange={(v) => set('listing_type', v)} testID="f-listing_type" required invalid={failedCheck && missing('listing_type')} />
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fType')}</Text>
          <Chips options={options(PROPERTY_TYPES, lang)} value={str(fields.property_type)} onChange={(v) => set('property_type', v)} testID="f-property_type" required invalid={failedCheck && missing('property_type')} />
        </View>

        <View style={styles.stack} {...anchor(2)}>
          <SectionHead n={2} title={L.step2} />
          <SizeSection fields={fields} set={set} field={field} lang={lang} />
        </View>

        {fields.listing_type !== 'rent' ? (
          <View style={styles.stack} {...anchor(3)}>
            <SectionHead n={3} title={L.step3} />
            <DeliverySection fields={fields} set={set} field={field} lang={lang} />
          </View>
        ) : null}

        <View style={styles.stack} {...anchor(4)}>
          <SectionHead n={4} title={L.step4} />
          <OwnerSection fields={fields} set={set} field={field} lang={lang} expanded={Boolean(fields.commission || fields.co_broker || fields.unit_no || fields.address || fields.pin)} onDescribeAgain={writeDraftAgain} />

          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'photosTitle')} ({kept.length}/{MAX_PHOTOS})</Text>
          <View style={styles.row}>
            <View style={styles.flex}><Button testID="add-photos" label={t(lang, 'addPhotos')} variant="secondary" onPress={() => addPhotos(() => pickPhotos(MAX_POOL - photos.length))} /></View>
            <View style={styles.flex}><Button testID="take-photo" label={t(lang, 'takePhoto')} variant="secondary" onPress={() => addPhotos(takePhoto)} disabled={photos.length >= MAX_POOL} /></View>
          </View>
          {photos.length > 1 ? <Text style={{ color: colors.muted }}>{t(lang, 'dragHint')}</Text> : null}
          {photos.length > kept.length ? <Text testID="photos-picked" style={{ color: colors.muted }}>{t(lang, 'photosPicked').replace('{n}', String(photos.length)).replace('{k}', String(kept.length))}</Text> : null}
          <SortablePhotos
            photos={photos}
            onChange={setPhotos}
            onDragging={setDragging}
            removeLabel={t(lang, 'removePhoto')}
            onRetry={uploads.retry}
            keepLabel={t(lang, 'keepOn')}
            skipLabel={t(lang, 'keepOff')}
            onToggle={(uri) => {
              const next = toggleKeep(photos, uri);
              if (next === photos) setNotice(t(lang, 'photosFull'));
              else setPhotos(next);
            }}
          />
          {editCode ? null : <SwitchRow label={t(lang, 'aiOrder')} value={photoAi} onChange={setPhotoAi} />}
        </View>

        <View style={styles.stack}>
          {editCode && review?.changes?.length ? (
            <View testID="changes" style={[styles.box, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{t(lang, 'willChange')}</Text>
              {review.changes.map((c) => <Text key={c.field} style={{ color: colors.text }}>• {lang === 'ar' ? c.ar : c.en}: {c.from || '—'} ← {c.to || '—'}</Text>)}
            </View>
          ) : null}
          {review && !review.warnings.length && !review.blockers.length ? <Text testID="no-warnings" style={{ color: colors.muted }}>✓ {t(lang, 'noWarnings')}</Text> : null}
          {review?.warnings.length && !review.blockers.length ? (
            <View testID="warnings" style={[styles.box, { borderColor: colors.accent }]}>
              {review.warnings.map((w) => <Text key={w.field + w.text} style={{ color: colors.text }}>• {w.text}</Text>)}
              <SwitchRow label={t(lang, 'warnOk')} value={ack} onChange={setAck} testID="ack" />
            </View>
          ) : null}
        </View>
        {error ?<Text testID="unit-error" style={{ color: colors.danger }}>{error}</Text> : null}
        {slow ? <Text testID="slow-net" style={{ color: colors.accent, fontWeight: '700' }}>🐢 {slow}</Text> : null}
        {editCode ? null : <Button label={t(lang, 'discardDraft')} variant="secondary" onPress={discard} />}
      </ScrollView>

      {/* The fixed Save bar. */}
      <View style={[styles.bar, { backgroundColor: colors.card, borderTopColor: colors.border }]} testID="unit-bar">
        <View style={[styles.barBtn, styles.barSave]}>
          <Button testID="save-unit" label={saving ? `${t(lang, 'saving')} ${Math.round(progress * 100)}%` : t(lang, 'saveUnit')} progress={saving ? progress : undefined} onPress={() => save(false)} loading={saving} disabled={saveDisabled} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  stack: { gap: spacing.md },
  h: { fontSize: 16, fontWeight: '700', marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  locked: { opacity: 0.6 },
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  jump: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  jumpChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  barBtn: { flex: 1 },
  barSave: { flex: 1 },
});
