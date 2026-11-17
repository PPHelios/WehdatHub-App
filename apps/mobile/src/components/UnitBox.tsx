import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BoxFeature, BoxPlace, BoxResolve, Lang, UnitFields } from '@wehdathub/shared';
import { api } from '../api';
import { featureChip } from '../featureLabels';
import { syncPlaces } from '../placeList';
import { fill, uf } from '../unitFormText';
import { useBoxItems } from '../useBoxItems';
import { radius, spacing, useTheme } from '../theme';
import { Field } from './Field';

// The one box for where the unit is (one place chip) and what it has (feature chips). It writes the same fields the web form
// writes (compound, area_id, subzone_id, feature, features_other, compound_new), so the save and the review are unchanged.
// Rules and API: docs/plans/unified-unit-box.md.

/** A paste is a message to read, not a name to search: at least this many characters arrive at once. */
export const PASTE_MIN = 30;
const OTHER_MAX = 20;
const OTHER_LEN = 60;

const str = (v: UnitFields[string]): string => (typeof v === 'string' ? v : '');
export const featureKeys = (f: UnitFields): string[] => (Array.isArray(f.feature) ? f.feature : []);
export const otherFeatures = (f: UnitFields): string[] => str(f.features_other).split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
/** The place the box shows: the compound, or the sub-area or area the unit is filed under. */
export const placeLabel = (f: UnitFields): string => str(f.place_label) || str(f.compound);

const nameOf = (p: BoxPlace) => p.label || p.name_ar || p.name_en || '';
const pathOf = (p: BoxPlace) => [p.path, ...(p.zones ?? [])].filter(Boolean).join(' · ');

/** The fields a picked place writes. A compound brings its own area; an area or sub-zone leaves the compound empty. */
export function placePatch(p: BoxPlace): UnitFields {
  return {
    compound: p.kind === 'compound' ? nameOf(p) : '',
    compound_new: '',
    area_id: p.area_id ?? '',
    subzone_id: p.subzone_id ?? '',
    place_label: nameOf(p),
    place_path: p.path,
    place_zones: (p.zones ?? []).join(' · '),
  };
}

/** What a pasted message adds: its place (only when none is set yet) and its features, without repeats. */
export function resolvePatch(r: BoxResolve, f: UnitFields): UnitFields {
  const out: UnitFields = {};
  if (r.place && !placeLabel(f)) Object.assign(out, placePatch(r.place));
  const keys = featureKeys(f);
  const added = r.features.map((x) => x.key).filter((k) => !keys.includes(k));
  if (added.length) out.feature = [...keys, ...added];
  // The two drop-downs fill from the message only while they are empty: a choice already made stays.
  if (r.furnishing && !str(f.furnishing)) out.furnishing = r.furnishing;
  if (r.finishing && !str(f.finishing)) out.finishing = r.finishing;
  return out;
}

/** Reads a pasted message into the box's fields (no AI, no credits). */
export async function readMessage(text: string, f: UnitFields): Promise<UnitFields> {
  return resolvePatch(await api.placeBoxResolve(text.slice(0, 4000)), f);
}

/** The fields that clear the place (its chip, its area and the new-place fields). */
export const NO_PLACE: UnitFields = { compound: '', compound_new: '', area_id: '', subzone_id: '', place_label: '', place_path: '', place_zones: '' };

interface Props {
  fields: UnitFields;
  patch: (p: UnitFields) => void;
  lang: Lang;
  testID?: string;
  /** The place is missing after a failed check: the box is outlined red. */
  invalid?: boolean;
}

export function UnitBox({ fields, patch, lang, testID = 'unit-box', invalid = false }: Props) {
  const { colors } = useTheme();
  const L = uf(lang);
  const [input, setInput] = useState('');
  const [note, setNote] = useState<string | null>(null);
  // A unit whose place is still a new one (waiting for the agency) opens its form.
  const [requesting, setRequesting] = useState(fields.compound_new === '1');
  const typed = input.trim();
  const found = useBoxItems(typed, lang);
  // Opening the form asks the server only whether the saved list is the latest; a newer one is downloaded and kept for offline use.
  useEffect(() => { syncPlaces(true).catch(() => undefined); }, []);
  const chosen = featureKeys(fields);
  const others = otherFeatures(fields);
  const label = placeLabel(fields);
  const items = typed.length >= 2 ? found : [];
  const places = items.filter((it) => it.kind !== 'feature') as BoxPlace[];
  const features = items.filter((it) => it.kind === 'feature' && !chosen.includes(it.key)) as BoxFeature[];

  const choose = (it: BoxPlace | BoxFeature) => {
    if ('key' in it) {
      if (!chosen.includes(it.key)) patch({ feature: [...chosen, it.key] });
    } else {
      if (label && label !== nameOf(it)) setNote(fill(L.boxSwap, { a: label, b: nameOf(it) }));
      setRequesting(false);
      patch(placePatch(it));
    }
    setInput('');
  };
  const addOther = (text: string) => {
    const t = text.trim().slice(0, OTHER_LEN);
    if (!t || others.includes(t) || others.length >= OTHER_MAX) return;
    patch({ features_other: [...others, t].join('، ') });
    setInput('');
  };
  const removePlace = () => {
    setRequesting(false);
    setNote(null);
    patch(NO_PLACE);
  };
  const onChangeText = (v: string) => {
    // Many characters at once is a paste: read the message into the box and keep it out of the search.
    if (v.length - input.length >= PASTE_MIN) {
      setInput('');
      readMessage(v, fields).then((p) => {
        if (Object.keys(p).length) {
          patch(p);
          setNote(L.boxFromText);
        }
      }).catch(() => undefined);
      return;
    }
    setInput(v);
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={[styles.label, { color: colors.text }]}>{L.boxLabel}</Text>
      <TextInput
        testID="unit-box-input"
        value={input}
        onChangeText={onChangeText}
        onSubmitEditing={() => { if (items[0]) choose(items[0] as BoxPlace | BoxFeature); }}
        placeholder={L.boxPlaceholder}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        returnKeyType="done"
        style={[styles.input, { color: colors.text, borderColor: invalid ? colors.danger : colors.primary, backgroundColor: colors.card }]}
      />
      {/* The chips sit under the typing line, not inside it. */}
      <View style={styles.chips} testID="ubox-chips">
        {label ? (
          <Pressable testID="ubox-place" onPress={removePlace} accessibilityRole="button" accessibilityLabel={fill(L.boxRemove, { s: label })} style={[styles.chip, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{fields.compound_new === '1' ? `${label} · ${L.boxNew}` : label}  ×</Text>
          </Pressable>
        ) : null}
        {chosen.map((k) => {
          const f = featureChip(k, lang);
          return (
            <Pressable key={k} testID={`ubox-feature-${k}`} onPress={() => patch({ feature: chosen.filter((c) => c !== k) })} accessibilityRole="button" accessibilityLabel={fill(L.boxRemove, { s: f.label })} style={[styles.chip, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{f.label}  ×</Text>
            </Pressable>
          );
        })}
        {others.map((o) => (
          <Pressable key={o} testID={`ubox-other-${o}`} onPress={() => patch({ features_other: others.filter((x) => x !== o).join('، ') })} accessibilityRole="button" accessibilityLabel={fill(L.boxRemove, { s: o })} style={[styles.chip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, fontWeight: '600' }}>{o} · {L.boxNotInList}  ×</Text>
          </Pressable>
        ))}
      </View>
      {label && (fields.place_path || fields.place_zones) ? (
        <Text testID="ubox-context" style={[styles.context, { color: colors.muted }]}>{[fields.place_path, fields.place_zones].filter(Boolean).join(' · ')}</Text>
      ) : null}
      {note ? <Text testID="ubox-note" style={[styles.context, { color: colors.accent }]}>{note}</Text> : null}

      {typed.length >= 2 ? (
        <View testID="ubox-list" style={[styles.list, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {places.length ? <Text style={[styles.group, { color: colors.muted }]}>{L.boxPlaces}</Text> : null}
          {places.map((it) => (
            <Pressable key={`${it.kind}-${it.id}`} testID={`ubox-opt-${it.id}`} onPress={() => choose(it)} accessibilityRole="button" style={styles.opt}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{nameOf(it)}</Text>
              {pathOf(it) ? <Text style={{ color: colors.muted, fontSize: 13 }}>{pathOf(it)}</Text> : null}
            </Pressable>
          ))}
          {features.length ? <Text style={[styles.group, { color: colors.muted }]}>{L.boxFeatures}</Text> : null}
          {features.map((it) => (
            <Pressable key={it.key} testID={`ubox-opt-${it.key}`} onPress={() => choose(it)} accessibilityRole="button" style={styles.opt}>
              <Text style={{ color: colors.text, fontSize: 16 }}>{it.label}</Text>
            </Pressable>
          ))}
          <Pressable testID="ubox-request" onPress={() => { setInput(''); setRequesting(true); patch({ compound: typed, compound_new: '1', area_id: '', subzone_id: '', place_label: typed, place_path: '', place_zones: '' }); }} accessibilityRole="button" style={styles.opt}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{fill(L.boxRequest, { s: typed })}</Text>
          </Pressable>
          <Pressable testID="ubox-other" onPress={() => addOther(typed)} accessibilityRole="button" style={styles.opt}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{fill(L.boxOther, { s: typed })}</Text>
          </Pressable>
        </View>
      ) : null}

      {requesting ? <NewPlace fields={fields} patch={patch} lang={lang} onCancel={removePlace} onDone={() => setRequesting(false)} /> : null}
    </View>
  );
}

/** "Request a new place": a compound the box does not know. It is saved with the unit and its area is required. */
function NewPlace({ fields, patch, lang, onCancel, onDone }: { fields: UnitFields; patch: (p: UnitFields) => void; lang: Lang; onCancel: () => void; onDone: () => void }) {
  const { colors } = useTheme();
  const L = uf(lang);
  const [parentQ, setParentQ] = useState('');
  const [parent, setParent] = useState<{ id: string; label: string } | null>(null);
  const pq = parentQ.trim();
  const areaHits = useBoxItems(parent ? '' : pq, lang).filter((it): it is BoxPlace => it.kind === 'area');
  const name = str(fields.compound).trim();
  const ok = Boolean(name && parent);

  const save = () => {
    if (!ok || !parent) return;
    patch({ compound: name, compound_new: '1', compound_ar: str(fields.compound_ar), compound_pin: str(fields.compound_pin), area_id: parent.id, subzone_id: '', place_label: name, place_path: parent.label, place_zones: '' });
    onDone();
  };

  return (
    <View testID="ubox-new" style={[styles.newBox, { borderColor: colors.primary, backgroundColor: colors.card }]}>
      <Text style={[styles.groupTitle, { color: colors.text }]}>{L.newTitle}</Text>
      <Text style={{ color: colors.muted }}>{L.newHint}</Text>
      <Field testID="ubox-new-name" label={L.newName} value={str(fields.compound)} onChangeText={(v) => patch({ compound: v, compound_new: '1', place_label: v })} autoCorrect={false} />
      <Field testID="ubox-new-ar" label={L.newAr} value={str(fields.compound_ar)} onChangeText={(v) => patch({ compound_ar: v })} />
      <Field testID="ubox-new-map" label={L.newMap} value={str(fields.compound_pin)} onChangeText={(v) => patch({ compound_pin: v })} autoCapitalize="none" autoCorrect={false} />
      <View style={styles.row}>
        <View style={styles.flex}><Field testID="ubox-new-district" label={L.newDistrict} value={str(fields.district)} onChangeText={(v) => patch({ district: v })} /></View>
        <View style={styles.flex}><Field testID="ubox-new-city" label={L.newCity} value={str(fields.city)} onChangeText={(v) => patch({ city: v })} /></View>
      </View>
      <Text style={[styles.label, { color: colors.text }]}>{L.newArea}</Text>
      {parent ? (
        <Pressable testID="ubox-new-parent" onPress={() => setParent(null)} accessibilityRole="button" style={[styles.chip, { backgroundColor: colors.primary, borderColor: colors.primary, alignSelf: 'flex-start' }]}>
          <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{parent.label}  ×</Text>
        </Pressable>
      ) : (
        <>
          <TextInput testID="ubox-new-parent-input" value={parentQ} onChangeText={setParentQ} placeholder={L.newAreaSearch} placeholderTextColor={colors.muted} autoCorrect={false} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} />
          {areaHits.map((a) => (
            <Pressable key={a.id} testID={`ubox-new-area-${a.id}`} onPress={() => { setParent({ id: a.id, label: nameOf(a) }); setParentQ(''); }} accessibilityRole="button" style={styles.opt}>
              <Text style={{ color: colors.text, fontSize: 16 }}>{nameOf(a)}</Text>
              {a.path ? <Text style={{ color: colors.muted, fontSize: 13 }}>{a.path}</Text> : null}
            </Pressable>
          ))}
          {!areaHits.length && pq.length >= 2 ? <Text style={{ color: colors.muted }}>{L.newAreaPick}</Text> : null}
        </>
      )}
      <View style={styles.row}>
        <Pressable testID="ubox-new-save" onPress={save} disabled={!ok} accessibilityRole="button" accessibilityState={{ disabled: !ok }} style={[styles.btn, { backgroundColor: colors.primary, opacity: ok ? 1 : 0.4 }]}>
          <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{L.newSave}</Text>
        </Pressable>
        <Pressable testID="ubox-new-cancel" onPress={onCancel} accessibilityRole="button" style={[styles.btn, { borderWidth: 1, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{L.newCancel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: 15, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 36, justifyContent: 'center' },
  context: { fontSize: 13 },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  group: { fontSize: 12, fontWeight: '700', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  groupTitle: { fontSize: 16, fontWeight: '700' },
  opt: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  newBox: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  btn: { minHeight: 44, borderRadius: radius.md, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
});
