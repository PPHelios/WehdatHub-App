import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import type { ScrollViewInstance } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError, PlanLockedError } from '@wehdathub/shared';
import type { ReviewResult, UnitFields, UploadFile, VoiceFile } from '@wehdathub/shared';
import { usePlanLock } from '../planLock';
import { usePlanState } from '../planState';
import { api } from '../api';
import { currentLang } from '../auth';
import { KeyboardLift } from '../components/KeyboardLift';
import { Button } from '../components/Button';
import { useRights } from '../rights';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { UnitBox, readMessage, PASTE_MIN } from '../components/UnitBox';
import { featureKeys, placeLabel } from '../unitBoxRules';
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
import { VoiceBar } from '../components/VoiceBar';
import { featureChip } from '../featureLabels';
import { draftText, isAutoDraft } from '../unitDraft';
import { uf } from '../unitFormText';
import { sendable, stepOf, stepsFor, withFurnishingSync, withImpliedFeatures } from '../unitRules';
import type { Step } from '../unitRules';
import { toastError } from '../components/Toast';

const str = (v: UnitFields[string]): string => (typeof v === 'string' ? v : '');
const phoneDigits = (v: string) => { const d = v.replace(/\D/g, '').replace(/^00/, ''); return d.startsWith('20') ? d.slice(2).replace(/^0+/, '') : d.replace(/^0+/, ''); };
/** The server saves the phone as the owner name when "use phone as name" is on: show that as the toggle, not as a name. */
function unphoneName<T extends UnitFields>(f: T): T {
  const name = str(f.owner_name), phone = str(f.owner_phone);
  if (name && phone && phoneDigits(name) && phoneDigits(name) === phoneDigits(phone)) return { ...f, owner_name: '', owner_name_from_phone: '1' };
  return f;
}
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
  const [reviewing, setReviewing] = useState(true);
  const [failedCheck, setFailedCheck] = useState(false);
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const saveKey = useRef(newSaveKey());
  const dirty = useRef(false);
  const shared = useRef(route.params);
  const editCode = route.params?.edit;
  const planState = usePlanState();
  useEffect(() => {
    if (!editCode && planState.phase === 'readonly') {
      usePlanLock.getState().show(new PlanLockedError('plan_readonly'));
      if (nav.canGoBack()) nav.goBack();
    }
  }, [editCode, planState.phase, nav]);
  // Opened from the WhatsApp import: its own draft, not the person's saved one; saving goes back to the import list.
  const importId = route.params?.importId;
  const fresh = Boolean(route.params?.fresh);
  const [version, setVersion] = useState(0);
  const savedDetails = useRef<string | null>(null);
  const originalIds = useRef<string[]>([]);
  // Section positions let us scroll to a blocker returned during save.
  const scroll = useRef<ScrollViewInstance>(null);
  const anchors = useRef<Partial<Record<Step, number>>>({});
  // The client description follows the fields while it is empty or still the draft (web: unitFields.js).
  const descAuto = useRef(true);

  const patch = (p: UnitFields) => {
    dirty.current = true;
    setFields((f) => withImpliedFeatures(withFurnishingSync(f, { ...f, ...p })));
  };
  const set = (k: string, v: UnitFields[string]) => {
    if (k === 'clean_summary') descAuto.current = isAutoDraft(String(v ?? ''));
    patch({ [k]: v });
  };
  // A studio, shop, office or land has no bedrooms.
  const noBedrooms = ['studio', 'office', 'shop', 'clinic', 'commercial', 'land'].includes(str(fields.property_type));
  const REQUIRED = ['owner_phone', 'price_value', 'area_value', ...(noBedrooms ? [] : ['bedrooms']), ...(fields.owner_name_from_phone === '1' ? [] : ['owner_name'])];
  // The place (a compound, or an area) is mandatory: checked here at once, and again by the server's review.
  const placeMissing = !placeLabel(fields) && !str(fields.compound) && !str(fields.area_id) && !str(fields.subzone_id);
  const fromServer = blockers.length ? blockers : review?.blockers ?? [];
  const allBlockers: Blocker[] = [...(placeMissing && !fromServer.some((b) => b.field === 'location') ? [{ field: 'location', label: L.boxNoPlace }] : []), ...fromServer];
  const saveDisabled = !ready || reviewing || saving || allBlockers.length > 0 || Boolean(review?.warnings.length && !ack);
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
      // AI blocked or down: the server's free quick reader may still have filled fields from the typed text.
      const quick = e instanceof ApiClientError && (e.status === 402 || e.status === 503) ? (e.extra?.fields as UnitFields | undefined) : undefined;
      if (quick) {
        setFields((f) => withImpliedFeatures({ ...f, ...Object.fromEntries(Object.entries(quick).filter(([k, v]) => k !== 'code' && v !== '' && v !== undefined && v !== null)) }));
        const said = e instanceof ApiClientError ? e.extra?.message : undefined;
        setNotice(typeof said === 'string' && said.trim() ? said.trim() : t(lang, 'quickFilled'));
        return;
      }
      setError(toastError(e instanceof ApiClientError && (e.status === 402 || e.status === 503) ? t(lang, 'aiBlocked') : errorText(e, lang)));
    }
  }, [fields, lang]);

  // Start: restore a saved draft, then apply anything shared in from another app.
  useEffect(() => {
    (async () => {
      if (editCode) {
        try {
          const [r, u] = await Promise.all([api.unitEditFields(editCode), api.unit(editCode)]);
          setFields(unphoneName({ ...r.fields, code: r.code }));
          descAuto.current = isAutoDraft(str(r.fields.clean_summary));
          setVersion(r.version);
          setPhotos(u.images.map((i) => ({ uri: i.url, name: i.id, type: EXISTING })));
          originalIds.current = u.images.map((i) => i.id);
          // From the WhatsApp import: the post's photos join the unit's own (the first 15 are kept), and its message fills in.
          const sh = shared.current;
          if (sh?.photos?.length) setPhotos((p) => addPicked(p, sh.photos!));
          if (sh?.text) { setDescribe(sh.text); if (!sh.noAi) await runFill({ describe: sh.text }); }
          // Edit: the post only fills what the unit leaves empty; its values never replace the stored ones (a silent overwrite on save).
          if (sh?.fields) setFields((f) => withImpliedFeatures(unphoneName({ ...Object.fromEntries(Object.entries(sh.fields!).filter(([k, v]) => k !== 'code' && v !== '' && v !== undefined && v !== null)), ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v !== undefined && v !== null)) })));
        } catch (e) {
          setError(toastError(errorText(e, lang)));
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
      if (s?.fields) { const sf = unphoneName(s.fields as UnitFields); patch(Object.fromEntries(Object.entries(sf).filter(([, v]) => v !== '' && v !== undefined && v !== null))); setNotice(L.boxFromText); }
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
    setReviewing(true);
    setAck(false);
    let live = true;
    const h = setTimeout(() => {
      api.reviewUnit(sendable(fields), kept.length, editCode).then((r) => {
        if (!live) return;
        setReview(r);
        setBlockers([]);
      }).catch(() => undefined).finally(() => {
        if (live) setReviewing(false);
      });
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
      setError(toastError(errorText(e, lang)));
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
    if (saveDisabled) return;
    // A look-alike unit asks before anything is uploaded; accepting it once (the switch or Save anyway) is never asked again.
    const accepted = force || dupAck;
    if (!editCode && !accepted && review?.duplicate) return setDuplicate(review.duplicate);
    if (accepted) setDupAck(true);
    dirty.current = false;
    void track('unit_save_started', { edit: Number(Boolean(editCode)) });
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
        await Promise.all([qc.invalidateQueries({ queryKey: ['units'] }), qc.invalidateQueries({ queryKey: ['unit', editCode] }), qc.invalidateQueries({ queryKey: ['today'] })]);
        if (importId) // React Navigation 7: navigate() would push a second, empty import screen (the other posts would be lost); popTo returns to the one that is open.
        return nav.popTo('WhatsAppImport', { saved: { id: importId, code: editCode } });
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
      void track('unit_saved', { photos: files.length, edit: Number(Boolean(editCode)) });
      // A compound the list does not know is saved as pending on the server; show it on this phone straight away.
      if (fields.compound_new === '1' && str(fields.compound)) addPendingPlace(str(fields.compound)).catch(() => undefined);
      if (!fresh) await clearDraft();
      await qc.invalidateQueries({ queryKey: ['units'] });
      if (importId) return nav.popTo('WhatsAppImport', { saved: { id: importId, code: r.code } });
      nav.replace('Unit', { code: r.code });
    } catch (e) {
      void track('unit_save_refused', { status: e instanceof ApiClientError ? e.status : 0 });
      if (e instanceof SaveNotConfirmed) return setError(t(lang, 'saveNotConfirmed'));
      if (!(e instanceof ApiClientError)) return setError(toastError(errorText(e, lang)));
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
      if (e.code === 'photo_missing') {
        // Photos the server no longer has (uploaded earlier, kept too long) are deleted from the list; the others stay as they are.
        const gone = new Set(Array.isArray(e.extra.keys) ? (e.extra.keys as string[]) : []);
        setPhotos((p) => p.filter((x) => x.type === EXISTING || !x.key || (gone.size > 0 && !gone.has(x.key))));
        return setError(t(lang, 'photosExpired'));
      }
      setError(toastError(errorText(e, lang)));
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

  const anchor = (s: Step) => ({ onLayout: (e: { nativeEvent: { layout: { y: number } } }) => { anchors.current[s] = e.nativeEvent.layout.y; } });
  const panel = [styles.panel, { backgroundColor: colors.card, borderColor: colors.border }];

  return (
    <KeyboardLift style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={[styles.content, saving && styles.locked]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets scrollEnabled={!dragging} pointerEvents={saving ? 'none' : 'auto'}>
        {!editCode && !importId && canWhatsApp ? (
          <Button
            testID="add-from-whatsapp"
            label={t(lang, 'whatsappImport')}
            onPress={() => {
              if (planState.phase === 'readonly') {
                usePlanLock.getState().show(new PlanLockedError('plan_readonly'));
                return;
              }
              nav.navigate('WhatsAppImport');
            }}
          />
        ) : null}

        {ready && allBlockers.length > 0 ? (
          <View testID="blockers" style={[styles.box, { borderColor: colors.danger, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.danger, fontWeight: '700' }}>{t(lang, 'stillNeeded')}</Text>
            {allBlockers.map((b) => <Text key={b.field} style={{ color: colors.text }}>• {b.label}</Text>)}
          </View>
        ) : null}
        {(duplicate ?? (editCode ? null : review?.duplicate ?? null)) !== null ? (
          <View testID="duplicate" style={[styles.box, { borderColor: colors.accent, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{t(lang, 'duplicateAsk')} {duplicate ?? review?.duplicate}</Text>
            <SwitchRow label={t(lang, 'dupOk')} value={dupAck} onChange={setDupAck} testID="dup-ack" />
            <Button label={t(lang, 'saveAnyway')} onPress={() => save(true)} disabled={saveDisabled} />
            {duplicate !== null ? <Button label={t(lang, 'cancel')} variant="secondary" onPress={() => setDuplicate(null)} /> : null}
          </View>
        ) : null}

        <View style={panel} {...anchor(1)}>
          <SectionHead title={L.step1} />
          <Field testID="describe" label={importId ? (lang === 'en' ? '💬 Original message (to compare with the fields below)' : '💬 الرسالة الأصلية (للمقارنة مع البيانات تحت)') : t(lang, 'describePlaceholder')} value={describe} onChangeText={onDescribe} multiline />
          {importId ? null : (
            <>
              <Button testID="fill" label={t(lang, 'fillBtn')} onPress={() => runFill({ describe })} disabled={!describe.trim()} />
              <VoiceBar compact id="unit" label={t(lang, 'mic')} onFile={onVoice} onError={setError} />
            </>
          )}
          {notice ? (
            notice === t(lang, 'draftRestored')
              ? <View testID="unit-notice" style={[styles.box, { backgroundColor: colors.cardSubtle, borderColor: colors.border }]}><Text style={{ color: colors.text, fontWeight: '700' }}>↩ {notice}</Text></View>
              : <Text testID="unit-notice" style={{ color: colors.accentInk }}>{notice}</Text>
          ) : null}
          <UnitBox fields={fields} patch={patch} lang={lang} invalid={failedCheck && missing('location')} />
          {field('code', lang === 'en' ? 'Unit code (optional)' : 'كود الوحدة (اختياري)', { autoCapitalize: 'characters', autoCorrect: false })}
          {/* The server's pre-save check: a code another unit already uses is shown here, before Save. */}
          {allBlockers.find((b) => b.field === 'code') ? <Text testID="code-taken" style={{ color: colors.danger }}>{allBlockers.find((b) => b.field === 'code')?.label}</Text> : null}
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fDeal')}</Text>
          <Chips options={[{ value: 'sale', label: t(lang, 'sale') }, { value: 'rent', label: t(lang, 'rent') }]} value={str(fields.listing_type)} onChange={(v) => set('listing_type', v)} testID="f-listing_type" required invalid={failedCheck && missing('listing_type')} />
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fType')}</Text>
          <Chips options={options(PROPERTY_TYPES, lang)} value={str(fields.property_type)} onChange={(v) => set('property_type', v)} testID="f-property_type" required invalid={failedCheck && missing('property_type')} />
        </View>

        <View style={panel} {...anchor(2)}>
          <SectionHead title={L.step2} />
          <SizeSection fields={fields} set={set} field={field} lang={lang} />
        </View>

        {fields.listing_type !== 'rent' ? (
          <View style={panel} {...anchor(3)}>
            <SectionHead title={L.step3} />
            <DeliverySection fields={fields} set={set} field={field} lang={lang} />
          </View>
        ) : null}

        <View style={panel} {...anchor(4)}>
          <SectionHead title={L.step4} />
          <OwnerSection fields={fields} set={set} field={field} lang={lang} expanded={Boolean(fields.commission || fields.co_broker || fields.unit_no || fields.address || fields.pin)} onDescribeAgain={writeDraftAgain} />

          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'photosTitle')} ({kept.length}/{MAX_PHOTOS})</Text>
          <View style={styles.row}>
            <View style={styles.flex}><Button testID="add-photos" size="sm" label={t(lang, 'addPhotos')} variant="secondary" onPress={() => addPhotos(() => pickPhotos(MAX_POOL - photos.length))} /></View>
            <View style={styles.flex}><Button testID="take-photo" size="sm" label={t(lang, 'takePhoto')} variant="secondary" onPress={() => addPhotos(takePhoto)} disabled={photos.length >= MAX_POOL} /></View>
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
            <View testID="changes" style={[styles.box, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{t(lang, 'willChange')}</Text>
              {review.changes.map((c) => <Text key={c.field} style={{ color: colors.text }}>• {lang === 'ar' ? c.ar : c.en}: {(lang === 'ar' ? c.from_ar : c.from_en) ?? c.from ?? '—'} {lang === 'ar' ? '←' : '→'} {(lang === 'ar' ? c.to_ar : c.to_en) ?? c.to ?? '—'}</Text>)}
            </View>
          ) : null}
          {review && !reviewing && !allBlockers.length && !review.warnings.length ? <Text testID="no-warnings" style={{ color: colors.muted }}>✓ {t(lang, 'noWarnings')}</Text> : null}
          {!reviewing && review?.warnings.length && !allBlockers.length ? (
            <View testID="warnings" style={[styles.box, { borderColor: colors.accent, backgroundColor: colors.card }]}>
              {review.warnings.map((w) => <Text key={w.field + w.text} style={{ color: colors.text }}>• {w.text}</Text>)}
              <SwitchRow label={t(lang, 'warnOk')} value={ack} onChange={setAck} testID="ack" />
            </View>
          ) : null}
        </View>
        {error ? <Text testID="unit-error" style={{ color: colors.danger }}>{error}</Text> : null}
        {slow ? <Text testID="slow-net" style={{ color: colors.accentInk, fontWeight: '700' }}>🐢 {slow}</Text> : null}
        {editCode ? null : <Button label={t(lang, 'discardDraft')} variant="secondary" onPress={discard} />}
      </ScrollView>

      <View style={[styles.bar, { backgroundColor: colors.card, borderColor: colors.border }]} testID="unit-bar">
        <Button testID="save-unit" label={saving ? `${t(lang, 'saving')} ${Math.round(progress * 100)}%` : t(lang, 'saveUnit')} progress={saving ? progress : undefined} onPress={() => save(false)} loading={saving} disabled={saveDisabled} />
      </View>
    </KeyboardLift>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  panel: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.md },
  stack: { gap: spacing.md },
  h: { fontSize: 16, fontWeight: '700', marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  locked: { opacity: 0.6 },
  box: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  bar: { padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
