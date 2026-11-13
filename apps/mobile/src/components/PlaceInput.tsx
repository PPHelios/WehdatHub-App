import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlaceSuggestion } from '@wehdathub/shared';
import { currentLang } from '../auth';
import { usePlaceSuggestions } from '../usePlaceSuggestions';
import { radius, spacing, useTheme } from '../theme';
import { Field } from './Field';

const name = (p: PlaceSuggestion, lang: string) => (lang === 'en' ? p.name_en || p.name_ar : p.name_ar || p.name_en) || '';

/**
 * A text box with one suggestion list under it: compounds and their other names, areas and sub-zones together. Picking an entry
 * hands it to `onPick`; the screen decides what to store (a compound brings its own area).
 */
export function PlaceInput({ label, value, onChangeText, onPick, testID }: { label: string; value: string; onChangeText: (v: string) => void; onPick: (p: PlaceSuggestion) => void; testID?: string }) {
  const { colors } = useTheme();
  const lang = currentLang();
  // The list shows only for text the person typed: picking an entry or filling by voice changes the value without typing, and closes it.
  const typed = useRef<string | null>(null);
  const open = typed.current === value;
  const found = usePlaceSuggestions(open ? value : '');
  // The list closes once the typed text is exactly one entry's name.
  const items = !open ? [] : found.filter((p) => name(p, lang) !== value.trim());
  return (
    <View style={styles.wrap}>
      <Field testID={testID} label={label} value={value} onChangeText={(v) => { typed.current = v; onChangeText(v); }} autoCorrect={false} />
      {items.length ? (
        <View testID="place-suggestions" style={[styles.list, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {items.map((p) => (
            <Pressable key={`${p.kind}-${p.id}`} testID={`place-${p.id}`} accessibilityRole="button" onPress={() => onPick(p)} style={styles.item}>
              <Text style={{ color: colors.text, fontSize: 16 }}>{name(p, lang)}</Text>
              {p.path ? <Text style={{ color: colors.muted, fontSize: 13 }}>{p.path}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  item: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
