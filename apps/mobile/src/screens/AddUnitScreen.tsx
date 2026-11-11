import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError } from '@wehdathub/shared';
import type { PlaceSuggestion, UnitFields, UploadFile, VoiceFile } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { PlaceInput } from '../components/PlaceInput';
import { SortablePhotos } from '../components/SortablePhotos';
import { clearDraft, isEmptyDraft, loadDraft, saveDraft } from '../draft';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { MAX_PHOTOS, pickPhotos, takePhoto } from '../photos';
import { FINISHING, FURNISHING, PROPERTY_TYPES, options } from '../unitOptions';
import { radius, spacing, useTheme } from '../theme';
import { tick } from '../haptics';
import { HoldMic } from '../components/HoldMic';

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

export function AddUnitScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const route = useRoute<RouteProp<RootStackParams, 'AddUnit'>>();
  const qc = useQueryClient();
  const [fields, setFields] = useState<UnitFields>({ listing_type: 'sale', market: 'resale' });
  const [describe, setDescribe] = useState('');
  const [photos, setPhotos] = useState<UploadFile[]>([]);
  const [photoAi, setPhotoAi] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<{ field: string; label: string }[]>([]);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const shared = useRef(route.params);
  const editCode = route.params?.edit;
  const [version, setVersion] = useState(0);
  const originalIds = useRef<string[]>([]);
  const [toUnit, setToUnit] = useState('');

  const set = (k: string, v: UnitFields[string]) => setFields((f) => ({ ...f, [k]: v }));
  // A compound picked from the list brings its own area; an area or sub-zone fills the area and leaves the compound empty.
  const pickPlace = (p: PlaceSuggestion) =>
    setFields((f) => ({
      ...f,
      compound: p.kind === 'compound' ? (p.name_ar || p.name_en || '') : '',
      area_id: p.area_id ?? '',
      subzone_id: p.subzone_id ?? '',
      area_path: p.kind === 'compound' ? p.path : [p.path, p.name_ar || p.name_en].filter(Boolean).join(' › '),
    }));
  const field = (k: string, label: string, extra: object = {}) => <Field key={k} testID={`f-${k}`} label={label} value={str(fields[k])} onChangeText={(v) => set(k, v)} {...extra} />;

  // Fill from a message and/or a voice note. What the form already says is sent along and kept.
  const fill = useCallback(async (o: { describe?: string; voice?: UploadFile }) => {
    setError(null);
    setNotice(null);
    try {
      const r = await api.extractUnit({ describe: o.describe, voice: o.voice, fields });
      setFields((f) => ({ ...f, ...Object.fromEntries(Object.entries(r.fields).filter(([, v]) => v !== '' && v !== undefined && v !== null)) }));
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
          setVersion(r.version);
          setPhotos(u.images.map((i) => ({ uri: i.url, name: i.id, type: EXISTING })));
          originalIds.current = u.images.map((i) => i.id);
        } catch (e) {
          setError(errorText(e, lang));
        }
        setReady(true);
        return;
      }
      const d = await loadDraft();
      if (d && !isEmptyDraft(d)) {
        setFields(d.fields);
        setDescribe(d.describe);
        setPhotos(d.photos);
        setPhotoAi(d.photoAi);
        setNotice(t(lang, 'draftRestored'));
      }
      const s = shared.current;
      if (s) {
        setNotice(t(lang, 'sharedIn'));
        if (s.photos?.length) setPhotos((p) => [...p, ...s.photos!].slice(0, MAX_PHOTOS));
        if (s.text) setDescribe((cur) => (cur ? `${cur}\n${s.text}` : s.text!));
      }
      setReady(true);
      if (s?.text || s?.voice) await fill({ describe: s.text, voice: s.voice });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save the draft as the broker types (after a short pause).
  useEffect(() => {
    if (!ready || editCode) return;
    const h = setTimeout(() => saveDraft({ fields, photos, describe, photoAi }), 600);
    return () => clearTimeout(h);
  }, [fields, photos, describe, photoAi, ready, editCode]);

  const onVoice = async (file: VoiceFile) => {
    setError(null);
    try {
      await fill({ voice: file });
    } catch (e) {
      setError(errorText(e, lang));
    }
  };

  const addPhotos = async (fn: () => Promise<UploadFile[]>) => {
    try {
      const got = await fn();
      setPhotos((p) => [...p, ...got].slice(0, MAX_PHOTOS));
    } catch {
      setError(t(lang, 'serverError'));
    }
  };

  const save = async (force = false) => {
    setError(null);
    setBlockers([]);
    setDuplicate(null);
    try {
      if (editCode) {
        await api.saveUnitEdit(editCode, version, fields);
        const ph = photoChanges(originalIds.current, photos);
        if (ph.changed) await api.unitPhotos(editCode, { add: ph.add, remove: ph.remove, order: ph.order });
        tick();
        await Promise.all([qc.invalidateQueries({ queryKey: ['units'] }), qc.invalidateQueries({ queryKey: ['unit', editCode] })]);
        return nav.goBack();
      }
      const sent = { ...fields, photo_ai: photoAi ? '1' : '', ...(force ? { force: '1' } : {}) };
      const r = await api.createUnit(sent, photos);
      tick();
      await clearDraft();
      await qc.invalidateQueries({ queryKey: ['units'] });
      nav.replace('Unit', { code: r.code });
    } catch (e) {
      if (!(e instanceof ApiClientError)) return setError(errorText(e, lang));
      if (editCode && e.code === 'conflict') return setError(t(lang, 'changedElsewhere'));
      if (editCode && e.code === 'incomplete') return setBlockers((e.extra.blockers as { field: string; label: string }[]) ?? []);
      if (e.code === 'incomplete') {
        const rv = await api.reviewUnit(fields, photos.length).catch(() => null);
        return setBlockers(rv?.blockers ?? []);
      }
      if (e.code === 'duplicate') {
        const rv = await api.reviewUnit(fields, photos.length).catch(() => null);
        return setDuplicate(rv?.duplicate ?? '');
      }
      if (e.code === 'owner_name_required') return setError(t(lang, 'ownerNameNeeded'));
      if (e.code === 'compound_unknown') {
        const like = ((e.extra.suggestions as { name: string }[]) ?? []).map((x) => x.name).filter(Boolean);
        return setError(like.length ? `${t(lang, 'compoundUnknown')} ${t(lang, 'didYouMean')} ${like.join(' / ')}` : t(lang, 'compoundUnknown'));
      }
      if (e.code === 'plan_limit') return setError(t(lang, 'planLimit'));
      setError(errorText(e, lang));
    }
  };

  // Photos shared in (or picked) can go to a unit that already exists instead of a new one.
  const addToExisting = async () => {
    setError(null);
    try {
      const code = toUnit.trim();
      await api.unitPhotos(code, { add: photos });
      await clearDraft();
      await qc.invalidateQueries({ queryKey: ['unit', code] });
      nav.replace('Unit', { code });
    } catch (e) {
      setError(e instanceof ApiClientError && e.status === 404 ? t(lang, 'unitMissing') : e instanceof ApiClientError && e.code === 'too_many_photos' ? t(lang, 'tooManyPhotos') : errorText(e, lang));
    }
  };

  const discard = async () => {
    await clearDraft();
    setFields({ listing_type: 'sale', market: 'resale' });
    setDescribe('');
    setPhotos([]);
    setNotice(null);
  };

  const resale = fields.market !== 'primary';
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEnabled={!dragging}>
      {(
        <>
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fillFrom')}</Text>
          <Field testID="describe" label={t(lang, 'describePlaceholder')} value={describe} onChangeText={setDescribe} multiline />
          <View style={styles.row}>
            <View style={styles.flex}><Button testID="fill" label={t(lang, 'fillBtn')} onPress={() => fill({ describe })} disabled={!describe.trim()} /></View>
            <View style={styles.flex}><HoldMic testID="unit-mic" label={t(lang, 'mic')} onFile={onVoice} onError={setError} /></View>
          </View>
        </>
      )}
      {notice ? <Text testID="unit-notice" style={{ color: colors.accent }}>{notice}</Text> : null}

      <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fDeal')}</Text>
      <Chips options={[{ value: 'sale', label: t(lang, 'sale') }, { value: 'rent', label: t(lang, 'rent') }]} value={str(fields.listing_type)} onChange={(v) => set('listing_type', v)} />
      <Chips options={[{ value: 'resale', label: t(lang, 'resale') }, { value: 'primary', label: t(lang, 'primary') }]} value={str(fields.market)} onChange={(v) => set('market', v)} />
      <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fType')}</Text>
      <Chips options={options(PROPERTY_TYPES, lang)} value={str(fields.property_type)} onChange={(v) => set('property_type', v)} />

      <Text style={{ color: colors.muted }}>{t(lang, 'placeRule')}</Text>
      <PlaceInput testID="f-compound" label={t(lang, 'fCompound')} value={str(fields.compound)} onChangeText={(v) => set('compound', v)} onPick={pickPlace} />
      {fields.area_id ? (
        <View style={styles.switchRow}>
          <Text testID="picked-area" style={[styles.flex, { color: colors.text }]}>{t(lang, 'fPlaceArea')}: {str(fields.area_path)}</Text>
          <Button testID="clear-area" label={t(lang, 'clear')} variant="secondary" onPress={() => setFields((f) => ({ ...f, area_id: '', subzone_id: '', area_path: '' }))} />
        </View>
      ) : null}
      <View style={styles.row}><View style={styles.flex}>{field('city', t(lang, 'fCity'))}</View><View style={styles.flex}>{field('district', t(lang, 'fDistrict'))}</View></View>
      {field('price_value', t(lang, 'fPrice'), { keyboardType: 'numbers-and-punctuation' })}
      <View style={styles.row}><View style={styles.flex}>{field('area_value', t(lang, 'fArea'), { keyboardType: 'decimal-pad' })}</View><View style={styles.flex}>{field('floor_level', t(lang, 'fFloor'), { keyboardType: 'number-pad' })}</View></View>
      <View style={styles.row}><View style={styles.flex}>{field('bedrooms', t(lang, 'fBedrooms'), { keyboardType: 'number-pad' })}</View><View style={styles.flex}>{field('bathrooms', t(lang, 'fBathrooms'), { keyboardType: 'number-pad' })}</View></View>
      <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fFinishing')}</Text>
      <Chips options={options(FINISHING, lang)} value={str(fields.finishing)} onChange={(v) => set('finishing', v)} />
      <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fFurnishing')}</Text>
      <Chips options={options(FURNISHING, lang)} value={str(fields.furnishing)} onChange={(v) => set('furnishing', v)} />
      <View style={styles.switchRow}><Text style={{ color: colors.text }}>{t(lang, 'fReady')}</Text><Switch value={fields.is_ready === '1'} onValueChange={(v) => set('is_ready', v ? '1' : '')} /></View>
      {fields.is_ready === '1' ? null : field('delivery_year', t(lang, 'fDelivery'), { keyboardType: 'number-pad' })}
      {resale && fields.listing_type !== 'rent' ? <View style={styles.row}><View style={styles.flex}>{field('down_payment_value', t(lang, 'fDown'), { keyboardType: 'numbers-and-punctuation' })}</View><View style={styles.flex}>{field('remaining_amount', t(lang, 'fRemaining'), { keyboardType: 'numbers-and-punctuation' })}</View></View> : null}
      {field('owner_name', t(lang, 'fOwnerName'))}
      {field('owner_phone', t(lang, 'fOwnerPhone'), { keyboardType: 'phone-pad' })}
      <View style={styles.switchRow}><Text style={{ color: colors.text }}>{t(lang, 'usePhoneAsName')}</Text><Switch value={fields.owner_name_from_phone === '1'} onValueChange={(v) => set('owner_name_from_phone', v ? '1' : '')} /></View>
      <View style={styles.switchRow}><Text style={{ color: colors.text }}>{t(lang, 'compoundNew')}</Text><Switch value={fields.compound_new === '1'} onValueChange={(v) => set('compound_new', v ? '1' : '')} /></View>
      {field('notes', t(lang, 'fNotes'), { multiline: true })}

      {(
        <>
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'photosTitle')} ({photos.length}/{MAX_PHOTOS})</Text>
          <View style={styles.row}>
            <View style={styles.flex}><Button testID="add-photos" label={t(lang, 'addPhotos')} variant="secondary" onPress={() => addPhotos(() => pickPhotos(MAX_PHOTOS - photos.length))} /></View>
            <View style={styles.flex}><Button testID="take-photo" label={t(lang, 'takePhoto')} variant="secondary" onPress={() => addPhotos(takePhoto)} disabled={photos.length >= MAX_PHOTOS} /></View>
          </View>
          {photos.length > 1 ? <Text style={{ color: colors.muted }}>{t(lang, 'dragHint')}</Text> : null}
          <SortablePhotos photos={photos} onChange={setPhotos} onDragging={setDragging} removeLabel={t(lang, 'removePhoto')} />
          {editCode ? null : <View style={styles.switchRow}><Text style={[styles.flex, { color: colors.text }]}>{t(lang, 'aiOrder')}</Text><Switch value={photoAi} onValueChange={setPhotoAi} /></View>}
          {!editCode && photos.length ? (
            <View style={[styles.box, { borderColor: colors.border }]}>
              <Field testID="to-unit" label={t(lang, 'addToExisting')} value={toUnit} onChangeText={setToUnit} autoCapitalize="characters" autoCorrect={false} />
              <Button testID="to-unit-go" variant="secondary" label={t(lang, 'addPhotosToUnit')} disabled={!toUnit.trim()} onPress={addToExisting} />
            </View>
          ) : null}
        </>
      )}

      {blockers.length ? (
        <View testID="blockers" style={[styles.box, { borderColor: colors.danger }]}>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>{t(lang, 'stillNeeded')}</Text>
          {blockers.map((b) => <Text key={b.field} style={{ color: colors.text }}>• {b.label}</Text>)}
        </View>
      ) : null}
      {duplicate !== null ? (
        <View testID="duplicate" style={[styles.box, { borderColor: colors.accent }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{t(lang, 'duplicateAsk')} {duplicate}</Text>
          <Button label={t(lang, 'saveAnyway')} onPress={() => save(true)} />
          <Button label={t(lang, 'cancel')} variant="secondary" onPress={() => setDuplicate(null)} />
        </View>
      ) : null}
      {error ? <Text testID="unit-error" style={{ color: colors.danger }}>{error}</Text> : null}
      <Button testID="save-unit" label={t(lang, 'saveUnit')} onPress={() => save(false)} />
      {editCode ? null : <Button label={t(lang, 'discardDraft')} variant="secondary" onPress={discard} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  h: { fontSize: 16, fontWeight: '700', marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
});
