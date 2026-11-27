import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import type { ScrollViewInstance } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError } from '@wehdathub/shared';
import type { UploadFile } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { Chips } from '../components/Chips';
import { DeveloperBox } from '../components/DeveloperBox';
import { Field } from '../components/Field';
import { ProjectPlaceBox } from '../components/ProjectPlaceBox';
import { SortablePhotos } from '../components/SortablePhotos';
import { SectionHead } from '../components/UnitSections';
import { compressPhotos } from '../compress';
import { errorText } from '../errors';
import { tick } from '../haptics';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { MAX_PROJECT_PHOTOS, PROJECT_TYPES, STATUSES, STATUS_TEXT, applyRead, BEDROOM_CHOICES, fieldsOfProject, foundLabels, projectBlockers, projectBody, stepsOf } from '../projectRules';
import type { ProjectFields } from '../projectRules';
import { fill, pt } from '../projectText';
import { pickPhotos, takePhoto } from '../photos';
import { plain, withCommas } from '../readback';
import { greenGradient, radius, spacing, typeScale, useTheme } from '../theme';
import { ALL_TYPES, labelOf } from '../unitOptions';
import { toast, toastError } from '../components/Toast';
import { sx } from '../sharedStyles';

/** A message pasted this long all at once is read at once (the website reads it too); the broker still checks every field. */
const PASTE_MIN = 40;
const str = (v: ProjectFields[string]): string => (typeof v === 'string' ? v : '');
const list = (v: ProjectFields[string]): string[] => (Array.isArray(v) ? v : []);

/** Several choices at once (bedrooms, unit types). */
function Pills({ options, value, onChange, testID }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.pills} testID={testID}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
            style={[styles.pill, { borderColor: on ? colors.primary : colors.border }, on && { backgroundColor: colors.primary }]}>
            <Text style={{ color: on ? colors.onPrimary : colors.text, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Add or edit a project (managers). Three sections like add unit: new walks them with a step bar and a fixed bar, edit shows all of them. */
export function ProjectFormScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const T = pt(lang);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const qc = useQueryClient();
  const editId = useRoute<RouteProp<RootStackParams, 'ProjectForm'>>().params?.id;
  const editing = Boolean(editId);
  const [fields, setFields] = useState<ProjectFields>({ status: 'selling' });
  const [paste, setPaste] = useState('');
  const [photos, setPhotos] = useState<UploadFile[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [ready, setReady] = useState(!editing);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);
  const [existing, setExisting] = useState<{ id: string; name: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [leaveAsk, setLeaveAsk] = useState<(() => void) | null>(null);
  const dirty = useRef(false);
  const saved = useRef(false);
  const scroll = useRef<ScrollViewInstance>(null);

  const patch = (p: ProjectFields) => { dirty.current = true; setFields((f) => ({ ...f, ...p })); };
  const set = (k: string, v: string | string[]) => patch({ [k]: v });

  useEffect(() => {
    if (!editId) return;
    api.project(editId).then((d) => { setFields(fieldsOfProject(d.project, d.developer)); setPaste(typeof d.project.source_text === 'string' ? d.project.source_text : ''); setReady(true); }).catch((e) => { setError(toastError(errorText(e, lang))); setReady(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // Leaving an edit with unsaved changes asks first.
  useEffect(() => nav.addListener?.('beforeRemove', (e) => {
    if (!editing || !dirty.current || saving || saved.current) return;
    e.preventDefault();
    setLeaveAsk(() => () => nav.dispatch(e.data.action));
  }), [nav, editing, saving, lang, T]);

  // Reads the pasted message (free, no AI): fills what is still empty and says what it found.
  const read = useCallback(async (text: string) => {
    const body = text.trim();
    if (!body) return;
    setReading(true);
    setReadNote(null);
    try {
      const r = await api.readProject(body.slice(0, 8000));
      setFields((f) => ({ ...f, ...applyRead(f, r) }));
      dirty.current = true;
      setExisting(r.existing);
      const names = foundLabels(r.found, lang);
      setReadNote(names.length ? fill(T.readFound, { s: names.join('، ') }) : T.readNone);
    } catch {
      setReadNote(T.readFailed);
    } finally {
      setReading(false);
    }
  }, [lang, T]);
  const onPaste = (v: string) => {
    const pasted = v.length - paste.length >= PASTE_MIN;
    setPaste(v);
    if (pasted) read(v);
  };

  const blockers = projectBlockers(fields, lang, editing);
  const missing = (k: string) => failed && blockers.some((b) => b.field === k);
  const steps = stepsOf(lang);
  const go = (s: 1 | 2 | 3) => { setStep(s); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const shows = (s: 1 | 2 | 3) => editing || step === s;

  const next = () => {
    if (step === 1 && blockers.length) { setFailed(true); return; }
    go(Math.min(3, step + 1) as 1 | 2 | 3);
  };

  const addPhotos = async (fn: () => Promise<UploadFile[]>) => {
    try {
      const got = await fn();
      setPhotos((p) => [...p, ...got].slice(0, MAX_PROJECT_PHOTOS));
    } catch {
      setError(t(lang, 'serverError'));
    }
  };

  const save = async () => {
    if (saving) return;
    if (blockers.length) { setFailed(true); go(Math.min(...blockers.map((b) => b.step)) as 1 | 2 | 3); return; }
    setSaving(true);
    setError(null);
    try {
      const r = await api.saveProject(projectBody(fields, paste, !editing), editId);
      const id = r.id ?? editId ?? null;
      saved.current = true;
      tick();
      // The project is saved first; its photos (all shared) follow. A photo that fails does not undo the save.
      let photoFailed = false;
      if (id && photos.length) {
        try { await api.projectPhotos(id, await compressPhotos(photos)); } catch { photoFailed = true; }
      }
      await Promise.all([qc.invalidateQueries({ queryKey: ['catalogue'] }), qc.invalidateQueries({ queryKey: ['project'] })]);
      if (photoFailed) toast(`${T.saved} ${T.photosAfter}`, true);
      if (editing || !id) return nav.goBack();
      nav.replace('Project', { id, name: str(fields.name) });
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'invalid') {
        setFailed(true);
        const field = String(e.extra.field ?? '');
        setError(fill(T.invalid, { s: foundLabels([field], lang)[0] ?? field }));
      } else if (e instanceof ApiClientError && e.code === 'forbidden') setError(T.forbidden);
      else setError(toastError(errorText(e, lang)));
    } finally {
      setSaving(false);
    }
  };

  const num = (k: string, label: string, extra: object = {}) => (
    <Field key={k} testID={`pf-${k}`} label={`${label} ${T.optional}`} value={str(fields[k])} onChangeText={(v) => set(k, v)} keyboardType="decimal-pad" {...extra} />
  );
  const typeOptions = PROJECT_TYPES.map((k) => ({ value: k, label: labelOf(ALL_TYPES, k, lang) ?? k }));

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView ref={scroll} style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.content, saving && styles.locked]} keyboardShouldPersistTaps="handled" scrollEnabled={!dragging} pointerEvents={saving || !ready ? 'none' : 'auto'}>
        <Text style={{ color: colors.muted }}>{T.legend}</Text>
        {!editing ? (
          <View style={styles.steps} testID="step-bar">
            {steps.map((s, i) => {
              const n = (i + 1) as 1 | 2 | 3;
              const on = n === step;
              return (
                <Pressable key={s} testID={`step-${n}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => (n > 1 && blockers.length ? setFailed(true) : go(n))} style={[styles.stepChip, { borderColor: on ? colors.primary : colors.border }, on && greenGradient]}>
                  <Text style={{ color: on ? colors.onPrimary : colors.text, fontWeight: '700' }}>{n}. {s}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {failed && blockers.length ? (
          <View testID="blockers" style={[styles.box, { borderColor: colors.danger }]}>
            <Text style={[{ color: colors.danger }, sx.fontWeight700]}>{T.stillNeeded}</Text>
            {blockers.map((b) => <Text key={b.field} style={{ color: colors.text }}>• {b.label}</Text>)}
          </View>
        ) : null}
        {error ? <Text testID="pf-error" style={{ color: colors.danger }}>{error}</Text> : null}

        {shows(1) ? (
          <View style={styles.stack} testID="pf-section-1">
            <SectionHead n={1} title={T.pStep1} hint={T.pasteHint} />
            <Field testID="pf-paste" label={`${T.pasteLabel} ${T.optional}`} value={paste} onChangeText={onPaste} multiline maxLength={8000} />
            <Button testID="pf-read" label={T.readBtn} variant="secondary" loading={reading} disabled={!paste.trim()} onPress={() => read(paste)} />
            {readNote ? <Text testID="pf-read-note" style={{ color: colors.accentInk }}>{readNote}</Text> : null}
            {existing ? (
              <Pressable testID="pf-known" accessibilityRole="button" onPress={() => nav.navigate('Project', { id: existing.id, name: existing.name })} style={[styles.box, { borderColor: colors.accent }]}>
                <Text style={{ color: colors.text }}>{T.known}: {existing.name} · <Text style={[{ color: colors.primaryInk }, sx.fontWeight700]}>{T.open}</Text></Text>
              </Pressable>
            ) : null}
            <Field testID="pf-name" label={`${T.name}`} value={str(fields.name)} onChangeText={(v) => set('name', v)} required invalid={missing('name')} maxLength={120} />
            <Field testID="pf-name_en" label={`${T.nameEn} ${T.optional}`} value={str(fields.name_en)} onChangeText={(v) => set('name_en', v)} autoCapitalize="words" maxLength={120} />
            <ProjectPlaceBox fields={fields} patch={patch} lang={lang} invalid={missing('place')} />
          </View>
        ) : null}

        {shows(2) ? (
          <View style={styles.stack} testID="pf-section-2">
            <SectionHead n={2} title={T.pStep2} hint={T.blankHint} />
            <Text style={[styles.h, { color: colors.text }]}>{T.status} {T.optional}</Text>
            <Chips<string> testID="pf-status" options={STATUSES.map((s) => ({ value: s, label: STATUS_TEXT[s][lang] }))} value={str(fields.status)} onChange={(v) => set('status', v)} />
            {num('price_from', T.priceFromF, { keyboardType: 'number-pad', value: withCommas(str(fields.price_from)), onChangeText: (v: string) => set('price_from', plain(v)), placeholder: '2,000,000' })}
            <View style={styles.row}>
              <View style={styles.flex}>{num('area_acres', T.areaAcres)}</View>
              <View style={styles.flex}>{num('down_pct_min', T.downMin)}</View>
            </View>
            <View style={styles.row}>
              <View style={styles.flex}>{num('years_max', T.yearsMax)}</View>
              <View style={styles.flex}>{num('discount_pct', T.discountPct)}</View>
            </View>
            {num('maintenance_pct', T.maintenancePct)}
            <Text style={[styles.h, { color: colors.text }]}>{T.bedroomsF} {T.optional}</Text>
            <Pills testID="pf-bedrooms" options={BEDROOM_CHOICES.map((n) => ({ value: String(n), label: String(n) }))} value={list(fields.bedrooms)} onChange={(v) => set('bedrooms', v)} />
            <Text style={[styles.h, { color: colors.text }]}>{T.typesF} {T.optional}</Text>
            <Pills testID="pf-types" options={typeOptions} value={list(fields.property_types)} onChange={(v) => set('property_types', v)} />
            <View style={styles.row}>
              <View style={styles.flex}>{num('delivery_year', T.deliveryYear, { keyboardType: 'number-pad', placeholder: '2028' })}</View>
              <View style={styles.flex}>{num('delivery_quarter', T.deliveryQuarter, { keyboardType: 'number-pad', maxLength: 1 })}</View>
            </View>
            <Field testID="pf-delivery_raw" label={`${T.deliveryRaw} ${T.optional}`} value={str(fields.delivery_raw)} onChangeText={(v) => set('delivery_raw', v)} maxLength={80} />
          </View>
        ) : null}

        {shows(3) ? (
          <View style={styles.stack} testID="pf-section-3">
            <SectionHead n={3} title={T.pStep3} hint={T.devHint} />
            <DeveloperBox fields={fields} patch={patch} lang={lang} />
            <Field testID="pf-notes" label={`${T.notesF} ${T.optional}`} hint={T.notesHint} value={str(fields.notes)} onChangeText={(v) => set('notes', v)} multiline maxLength={1000} />
            <Field testID="pf-pin" label={`${T.pinF} ${T.optional}`} value={str(fields.pin)} onChangeText={(v) => set('pin', v)} autoCapitalize="none" autoCorrect={false} />
            {!editing ? (
              <>
                <Text style={[styles.h, { color: colors.text }]}>{T.photos} ({photos.length}/{MAX_PROJECT_PHOTOS}) {T.optional}</Text>
                <Text style={{ color: colors.muted }}>{T.photosHint}</Text>
                <View style={styles.row}>
                  <View style={styles.flex}><Button testID="pf-add-photos" label={T.addPhotos} variant="secondary" disabled={photos.length >= MAX_PROJECT_PHOTOS} onPress={() => addPhotos(() => pickPhotos(MAX_PROJECT_PHOTOS - photos.length))} /></View>
                  <View style={styles.flex}><Button testID="pf-take-photo" label={t(lang, 'takePhoto')} variant="secondary" disabled={photos.length >= MAX_PROJECT_PHOTOS} onPress={() => addPhotos(takePhoto)} /></View>
                </View>
                <SortablePhotos photos={photos} onChange={setPhotos} onDragging={setDragging} removeLabel={t(lang, 'removePhoto')} />
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* The fixed bar: new walks the steps; edit saves. */}
      <View style={[styles.bar, { backgroundColor: colors.card, borderTopColor: colors.border }]} testID="project-bar">
        {!editing && step > 1 ? <View style={styles.flex}><Button testID="pf-back" label={T.back} variant="secondary" onPress={() => go((step - 1) as 1 | 2 | 3)} /></View> : null}
        <View style={styles.flex}>
          {!editing && step < 3
            ? <Button testID="pf-next" label={T.next2} onPress={next} />
            : <Button testID="pf-save" label={saving ? T.saving : editing ? T.save : T.add} loading={saving} onPress={save} />}
        </View>
      </View>
      <Sheet visible={Boolean(leaveAsk)} onClose={() => setLeaveAsk(null)} title={T.leaveTitle} testID="leave-sheet">
        <Text style={{ color: colors.muted }}>{T.leaveBody}</Text>
        <Button testID="leave-stay" variant="secondary" label={t(lang, 'stay')} onPress={() => setLeaveAsk(null)} />
        <Button testID="leave-go" variant="danger" label={t(lang, 'leave')} onPress={() => { const leave = leaveAsk; setLeaveAsk(null); leave?.(); }} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  stack: { gap: spacing.md },
  h: { fontSize: typeScale.body.fontSize, fontWeight: '700', marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  locked: { opacity: 0.6 },
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stepChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
