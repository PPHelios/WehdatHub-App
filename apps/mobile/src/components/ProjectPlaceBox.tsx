import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import type { BoxFeature, BoxPlace, Lang } from '@wehdathub/shared';
import { featureChip } from '../featureLabels';
import { NO_AREA, areaPatch, newSubareaPatch } from '../projectRules';
import type { ProjectFields } from '../projectRules';
import { fill, pt } from '../projectText';
import { syncPlaces } from '../placeList';
import { useBoxItems } from '../useBoxItems';
import { radius, spacing, typeScale, useTheme } from '../theme';
import { Field } from './Field';
import { featureKeys, otherFeatures } from '../unitBoxRules';

const OTHER_MAX = 20;
const OTHER_LEN = 60;
const str = (v: ProjectFields[string]): string => (typeof v === 'string' ? v : '');
const nameOf = (p: BoxPlace) => p.label || p.name_ar || p.name_en || '';

/**
 * The project's place and features in one box. A project is filed under an area or a sub-area, never a compound: typing searches areas and
 * sub-areas; under the box are the place's parents and its governorate (read only). A sub-area that is not on the list can be requested with
 * its parent area; it is saved pending, usable by this agency only, and the project stays under the parent until the CRM owner approves it.
 */
export function ProjectPlaceBox({ fields, patch, lang, invalid = false }: { fields: ProjectFields; patch: (p: ProjectFields) => void; lang: Lang; invalid?: boolean }) {
  const { colors } = useTheme();
  const T = pt(lang);
  const [input, setInput] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const typed = input.trim();
  // Opening the form asks the server only whether the saved list is the latest; a newer one is kept for offline use.
  useEffect(() => { syncPlaces(true).catch(() => undefined); }, []);
  const found = useBoxItems(typed, lang, true);
  const chosen = featureKeys(fields);
  const others = otherFeatures(fields);
  const label = str(fields.place_label);
  const pending = str(fields.compound_new) === '1';
  const places = found.filter((i): i is BoxPlace => i.kind === 'area' || i.kind === 'subzone');
  const features = found.filter((i): i is BoxFeature => i.kind === 'feature' && !chosen.includes(i.key));

  const choose = (it: BoxPlace | BoxFeature) => {
    if ('key' in it) patch({ feature: [...chosen, it.key] });
    else {
      if (label && label !== nameOf(it)) setNote(fill(T.areaChanged, { a: label, b: nameOf(it) }));
      patch(areaPatch(it));
    }
    setInput('');
  };
  const addOther = (text: string) => {
    const t = text.trim().slice(0, OTHER_LEN);
    if (!t || others.includes(t) || others.length >= OTHER_MAX) return;
    patch({ features_other: [...others, t].join('، ') });
    setInput('');
  };
  const clearPlace = () => { setNote(null); setRequesting(false); patch(NO_AREA); };

  return (
    <View style={styles.wrap} testID="project-place-box">
      <Text style={[styles.label, { color: colors.text }]}>{T.areaLabel}</Text>
      <TextInput
        testID="pbox-input"
        value={input}
        onChangeText={setInput}
        onSubmitEditing={() => { if (places[0]) choose(places[0]); else if (features[0]) choose(features[0]); }}
        placeholder={T.areaPlaceholder}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        returnKeyType="done"
        accessibilityLabel={T.areaLabel}
        style={[styles.input, { color: colors.text, borderColor: invalid ? colors.danger : colors.primary, backgroundColor: colors.card }]}
      />
      <View style={styles.chips}>
        {label ? (
          <Pressable testID="pbox-place" accessibilityRole="button" accessibilityLabel={fill(T.removeChip, { s: label })} onPress={clearPlace} style={[styles.chip, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
            <Text style={{ color: colors.primaryInk, fontWeight: '700' }}>{pending ? `${label} · ${T.devNew}` : label}  ×</Text>
          </Pressable>
        ) : null}
        {chosen.map((k) => (
          <Pressable key={k} testID={`pbox-feature-${k}`} accessibilityRole="button" onPress={() => patch({ feature: chosen.filter((c) => c !== k) })} style={[styles.chip, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
            <Text style={{ color: colors.primaryInk, fontWeight: '600' }}>{featureChip(k, lang).label}  ×</Text>
          </Pressable>
        ))}
        {others.map((o) => (
          <Pressable key={o} testID={`pbox-other-${o}`} accessibilityRole="button" onPress={() => patch({ features_other: others.filter((x) => x !== o).join('، ') })} style={[styles.chip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, fontWeight: '600' }}>{o} · {T.notInList}  ×</Text>
          </Pressable>
        ))}
      </View>
      {label ? (
        <View testID="pbox-context">
          {str(fields.place_path) ? <Text variant="bodySm" style={{ color: colors.muted }}>{T.parents}: {str(fields.place_path)}</Text> : null}
          {str(fields.place_governorate) ? <Text variant="bodySm" style={{ color: colors.muted }}>{T.governorateIs}: {str(fields.place_governorate)}</Text> : null}
          {pending ? <Text testID="pbox-pending" variant="bodySm" style={{ color: colors.accent }}>{T.pendingNote}</Text> : null}
        </View>
      ) : null}
      {note ? <Text variant="bodySm" style={{ color: colors.accent }}>{note}</Text> : null}
      {invalid && !label ? <Text variant="bodySm" style={{ color: colors.danger }}>{T.areaNone}</Text> : null}
      <Text variant="bodySm" style={{ color: colors.muted }}>{T.areaHelp}</Text>

      {typed.length >= 2 ? (
        <View testID="pbox-list" style={[styles.list, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {places.length ? <Text style={[styles.group, { color: colors.muted }]}>{T.searchPlaces}</Text> : null}
          {places.map((it) => (
            <Pressable key={`${it.kind}-${it.id}`} testID={`pbox-opt-${it.id}`} accessibilityRole="button" onPress={() => choose(it)} style={styles.opt}>
              <Text variant="body" weight="bold" style={{ color: colors.text }}>{nameOf(it)}</Text>
              {it.path ? <Text variant="bodySm" style={{ color: colors.muted }}>{it.path}</Text> : null}
            </Pressable>
          ))}
          {features.length ? <Text style={[styles.group, { color: colors.muted }]}>{T.searchFeatures}</Text> : null}
          {features.map((it) => (
            <Pressable key={it.key} testID={`pbox-opt-${it.key}`} accessibilityRole="button" onPress={() => choose(it)} style={styles.opt}>
              <Text variant="body" style={{ color: colors.text }}>{it.label}</Text>
            </Pressable>
          ))}
          <Pressable testID="pbox-request" accessibilityRole="button" onPress={() => { setRequesting(true); patch({ compound: typed, compound_new: '1', place_label: typed }); setInput(''); }} style={styles.opt}>
            <Text style={{ color: colors.primaryInk, fontWeight: '700' }}>{fill(T.requestSub, { s: typed })}</Text>
          </Pressable>
          <Pressable testID="pbox-other" accessibilityRole="button" onPress={() => addOther(typed)} style={styles.opt}>
            <Text style={{ color: colors.primaryInk, fontWeight: '700' }}>{fill(T.addOther, { s: typed })}</Text>
          </Pressable>
        </View>
      ) : null}

      {requesting ? <NewSubarea fields={fields} patch={patch} lang={lang} onCancel={clearPlace} onDone={() => setRequesting(false)} /> : null}
    </View>
  );
}

/** Request a new sub-area: its name, its Arabic name and the parent area (required). */
function NewSubarea({ fields, patch, lang, onCancel, onDone }: { fields: ProjectFields; patch: (p: ProjectFields) => void; lang: Lang; onCancel: () => void; onDone: () => void }) {
  const { colors } = useTheme();
  const T = pt(lang);
  const [parentQ, setParentQ] = useState('');
  const [parent, setParent] = useState<BoxPlace | null>(null);
  const pq = parentQ.trim();
  const hits = useBoxItems(parent ? '' : pq, lang, true).filter((i): i is BoxPlace => i.kind === 'area' || i.kind === 'subzone');
  const name = str(fields.compound).trim();
  const ok = Boolean(name && parent);
  return (
    <View testID="pbox-new" style={[styles.newBox, { borderColor: colors.primary, backgroundColor: colors.card }]}>
      <Text style={[styles.label, { color: colors.text }]}>{T.subTitle}</Text>
      <Field testID="pbox-new-name" label={T.subName} value={str(fields.compound)} onChangeText={(v) => patch({ compound: v, compound_new: '1', place_label: v })} autoCorrect={false} />
      <Field testID="pbox-new-ar" label={T.subAr} value={str(fields.compound_ar)} onChangeText={(v) => patch({ compound_ar: v })} />
      <Text style={[styles.label, { color: colors.text }]}>{T.subParent}</Text>
      {parent ? (
        <Pressable testID="pbox-new-parent" accessibilityRole="button" onPress={() => setParent(null)} style={[styles.chip, { backgroundColor: colors.primarySoft, borderColor: colors.primary, alignSelf: 'flex-start' }]}>
          <Text style={{ color: colors.primaryInk, fontWeight: '700' }}>{nameOf(parent)}  ×</Text>
        </Pressable>
      ) : (
        <>
          <TextInput testID="pbox-new-parent-input" value={parentQ} onChangeText={setParentQ} placeholder={T.subParentSearch} placeholderTextColor={colors.muted} autoCorrect={false} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} />
          {hits.map((a) => (
            <Pressable key={a.id} testID={`pbox-new-area-${a.id}`} accessibilityRole="button" onPress={() => { setParent(a); setParentQ(''); }} style={styles.opt}>
              <Text variant="body" style={{ color: colors.text }}>{nameOf(a)}</Text>
              {a.path ? <Text variant="bodySm" style={{ color: colors.muted }}>{a.path}</Text> : null}
            </Pressable>
          ))}
          {!hits.length && pq.length >= 2 ? <Text style={{ color: colors.muted }}>{T.subParentPick}</Text> : null}
        </>
      )}
      <View style={styles.row}>
        <Pressable testID="pbox-new-save" accessibilityRole="button" accessibilityState={{ disabled: !ok }} disabled={!ok} onPress={() => { if (parent) { patch(newSubareaPatch(name, str(fields.compound_ar).trim(), parent)); onDone(); } }} style={[styles.btn, { backgroundColor: colors.primary, opacity: ok ? 1 : 0.4 }]}>
          <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{T.subSave}</Text>
        </Pressable>
        <Pressable testID="pbox-new-cancel" accessibilityRole="button" onPress={onCancel} style={[styles.btn, { borderWidth: 1, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{T.cancel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: typeScale.body.fontSize, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: typeScale.body.fontSize },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center' },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  group: { fontSize: typeScale.caption.fontSize, fontWeight: '700', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  opt: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  newBox: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: { minHeight: 44, borderRadius: radius.md, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
});
