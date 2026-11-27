import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import type { CatalogueBoxItem, Lang } from '@wehdathub/shared';
import { api } from '../api';
import { featureChip } from '../featureLabels';
import { boxGroups } from '../projectRules';
import type { CatalogueSearch } from '../projectRules';
import { fill, pt } from '../projectText';
import { useBoxItems } from '../useBoxItems';
import { useDebounced } from '../useDebounced';
import { radius, spacing, typeScale, useTheme } from '../theme';

/**
 * The catalogue's one search box, like the unit box: type a place (an area or a sub-area), a feature, a developer or a project; the pick becomes a
 * chip. Places and features come from the unit box's list; developers and projects from GET /catalogue/search-box.
 */
export function CatalogueBox({ search, onChange, lang, onOpenProject }: {
  search: CatalogueSearch;
  onChange: (s: CatalogueSearch) => void;
  lang: Lang;
  onOpenProject: (id: string, name: string) => void;
}) {
  const { colors, elev } = useTheme();
  const T = pt(lang);
  const [input, setInput] = useState('');
  const typed = input.trim();
  const found = useBoxItems(typed, lang, true);
  const slow = useDebounced(typed, 180);
  const named = useQuery({ queryKey: ['catalogue-search', slow], queryFn: () => api.catalogueSearch(slow), enabled: slow.length >= 2, staleTime: 60_000 });
  const others = typed.length >= 2 ? (named.data?.items ?? []).filter((i) => i.kind === 'developer' || i.kind === 'project') : [];
  const items: CatalogueBoxItem[] = typed.length >= 2 ? [...found, ...others] : [];
  const g = boxGroups(items);
  const pick = (patch: Partial<CatalogueSearch>) => { onChange({ ...search, ...patch }); setInput(''); };
  const chip = (key: string, label: string, onRemove: () => void, tone: 'place' | 'feature' | 'other') => (
    <Pressable key={key} testID={`cbox-chip-${key}`} accessibilityRole="button" accessibilityLabel={fill(T.removeChip, { s: label })} onPress={onRemove}
      style={[styles.chip, tone === 'place' ? { backgroundColor: colors.primarySoft, borderColor: colors.primary } : tone === 'feature' ? { backgroundColor: colors.primarySoft, borderColor: colors.primary } : { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={{ color: tone === 'other' ? colors.text : colors.primaryInk, fontWeight: '700' }}>{label}  ×</Text>
    </Pressable>
  );
  const row = (key: string, label: string, sub: string | undefined, onPress: () => void) => (
    <Pressable key={key} testID={`cbox-opt-${key}`} accessibilityRole="button" onPress={onPress} style={styles.opt}>
      <Text variant="body" weight="bold" style={{ color: colors.text }}>{label}</Text>
      {sub ? <Text variant="bodySm" style={{ color: colors.muted }}>{sub}</Text> : null}
    </Pressable>
  );
  const title = (s: string) => <Text style={[styles.group, { color: colors.muted }]}>{s}</Text>;
  return (
    <View style={styles.wrap} testID="catalogue-box">
      <TextInput
        testID="project-search"
        value={input}
        onChangeText={setInput}
        onSubmitEditing={() => { if (typed) pick({ q: typed }); }}
        placeholder={T.searchPlaceholder}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={T.searchPlaceholder}
        style={[styles.input, { color: colors.text, borderColor: colors.primary, backgroundColor: colors.card }]}
      />
      <View style={styles.chips}>
        {search.place ? chip('place', search.place.label, () => onChange({ ...search, place: null }), 'place') : null}
        {search.features.map((f) => chip(`f-${f.key}`, featureChip(f.key, lang).label, () => onChange({ ...search, features: search.features.filter((x) => x.key !== f.key) }), 'feature'))}
        {search.developer ? chip('dev', search.developer.label, () => onChange({ ...search, developer: null }), 'other') : null}
        {search.q ? chip('q', search.q, () => onChange({ ...search, q: '' }), 'other') : null}
      </View>
      {typed.length >= 2 ? (
        <View testID="cbox-list" style={[styles.list, elev('md'), { borderColor: colors.border, backgroundColor: colors.card }]}>
          {g.places.length ? title(T.searchPlaces) : null}
          {g.places.map((p) => row(`place-${p.id}`, p.label, p.path || undefined, () => pick({ place: { id: p.id, label: p.label } })))}
          {g.features.length ? title(T.searchFeatures) : null}
          {g.features.filter((f) => !search.features.some((x) => x.key === f.key)).map((f) => row(`feature-${f.key}`, f.label, undefined, () => pick({ features: [...search.features, { key: f.key, label: f.label }] })))}
          {g.developers.length ? title(T.searchDevelopers) : null}
          {g.developers.map((d) => row(`dev-${d.id}`, d.label, undefined, () => pick({ developer: { id: d.id, label: d.label } })))}
          {g.projects.length ? title(T.searchProjects) : null}
          {g.projects.map((p) => row(`project-${p.id}`, p.label, undefined, () => { setInput(''); onOpenProject(p.id, p.label); }))}
          <Pressable testID="cbox-text" accessibilityRole="button" onPress={() => pick({ q: typed })} style={styles.opt}>
            <Text style={{ color: colors.primaryInk, fontWeight: '700' }}>{fill(T.searchText, { s: typed })}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: typeScale.body.fontSize },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center' },
  list: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden' },
  group: { fontSize: typeScale.caption.fontSize, fontWeight: '700', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  opt: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
