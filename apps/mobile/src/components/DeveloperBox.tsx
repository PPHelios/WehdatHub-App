import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { DeveloperPick, Lang } from '@wehdathub/shared';
import { api } from '../api';
import { developerPatch } from '../projectRules';
import type { ProjectFields } from '../projectRules';
import { fill, pt } from '../projectText';
import { radius, spacing, useTheme } from '../theme';
import { useDebounced } from '../useDebounced';

const str = (v: ProjectFields[string]): string => (typeof v === 'string' ? v : '');

/** The agency's developers matching the text, then the global names; an older server without the suggest route falls back to the catalogue's own developer list. */
async function suggest(q: string): Promise<DeveloperPick[]> {
  try {
    return (await api.developerSuggest(q)).items;
  } catch {
    const needle = q.trim().toLowerCase();
    const d = await api.catalogue();
    return d.developers.items.filter((x) => !needle || `${x.name} ${x.name_en ?? ''}`.toLowerCase().includes(needle)).slice(0, 8).map((x) => ({ id: x.id, name: x.name, name_en: x.name_en }));
  }
}

/**
 * The developer: search the agency's developers, then global names (names only), or type a new name (private to the agency).
 * Writes developer_id, developer_global_id or developer_name, like the website.
 */
export function DeveloperBox({ fields, patch, lang }: { fields: ProjectFields; patch: (p: ProjectFields) => void; lang: Lang }) {
  const { colors } = useTheme();
  const T = pt(lang);
  const [input, setInput] = useState(str(fields.developer_label));
  const [open, setOpen] = useState(false);
  const typed = input.trim();
  const slow = useDebounced(typed, 200);
  const list = useQuery({ queryKey: ['developer-suggest', slow], queryFn: () => suggest(slow), enabled: open, staleTime: 30_000 });
  const items = list.data ?? [];
  const exact = items.some((d) => d.name.toLowerCase() === typed.toLowerCase());
  const chosen = str(fields.developer_label);
  const state = chosen
    ? str(fields.developer_id) ? chosen : str(fields.developer_global_id) ? `${chosen} (${T.devGlobal})` : `${chosen} (${T.devNew})`
    : '';

  // A developer read from a pasted message arrives through the fields.
  useEffect(() => { if (chosen && chosen !== input.trim()) setInput(chosen); }, [chosen]); // eslint-disable-line react-hooks/exhaustive-deps

  const type = (v: string) => {
    setInput(v);
    setOpen(true);
    // What is typed is a new developer until one from the list is picked.
    patch(v.trim() ? developerPatch({ name: v.trim() }) : developerPatch(null));
  };
  const pick = (d: DeveloperPick | { name: string }) => {
    patch(developerPatch('id' in d ? { id: d.id, name: d.name } : 'global_id' in d ? { global_id: d.global_id, name: d.name } : d));
    setInput(d.name);
    setOpen(false);
  };
  return (
    <View style={styles.wrap} testID="developer-box">
      <Text style={[styles.label, { color: colors.muted }]}>{T.devLabel} {T.optional}</Text>
      <TextInput
        testID="dev-input"
        value={input}
        onChangeText={type}
        onFocus={() => setOpen(true)}
        placeholder={T.devPlaceholder}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        accessibilityLabel={T.devLabel}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
      />
      {state ? <Text testID="dev-state" style={{ color: colors.accent, fontSize: 13 }}>{state}</Text> : null}
      {open ? (
        <View testID="dev-list" style={[styles.list, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {items.map((d) => (
            <Pressable key={'id' in d ? d.id : d.global_id} testID={`dev-opt-${'id' in d ? d.id : d.global_id}`} accessibilityRole="button" onPress={() => pick(d)} style={styles.opt}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{d.name}</Text>
              {d.name_en && d.name_en !== d.name ? <Text style={{ color: colors.muted, fontSize: 13 }}>{d.name_en}</Text> : null}
            </Pressable>
          ))}
          {typed && !exact ? (
            <Pressable testID="dev-add" accessibilityRole="button" onPress={() => pick({ name: typed })} style={styles.opt}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{fill(T.devAdd, { s: typed })}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16 },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  opt: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
