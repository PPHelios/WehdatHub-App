import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, useTheme } from '../theme';

interface Props<T extends string> { options: { value: T; label: string }[]; value: T | ''; onChange: (v: T) => void; testID?: string; disabled?: boolean }

/** A wrapping row of single-choice chips. */
export function Chips<T extends string>({ options, value, onChange, testID, disabled = false }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} testID={testID}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: on, disabled }} disabled={disabled} onPress={() => onChange(o.value)} style={[styles.chip, disabled && { opacity: 0.4 }, { borderColor: on ? colors.primary : colors.border }, on && { backgroundColor: colors.primary }]}>
            <Text style={[styles.text, { color: on ? colors.onPrimary : colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  text: { fontWeight: '600' },
});
