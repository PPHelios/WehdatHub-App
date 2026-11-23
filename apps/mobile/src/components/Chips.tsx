import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip } from './Chip';
import { useSelectionHighlight } from './SelectionHighlight';
import { greenGradient, radius, spacing, useTheme } from '../theme';

/** Required groups use a green outline and switch to red for validation errors. */
interface Props<T extends string> { options: { value: T; label: string }[]; value: T | ''; onChange: (v: T) => void; testID?: string; disabled?: boolean; required?: boolean; invalid?: boolean; soft?: boolean; animateFilter?: boolean }

/** A wrapping row of single-choice chips. */
export function Chips<T extends string>({ options, value, onChange, testID, disabled = false, required = false, invalid = false, soft = false, animateFilter = false }: Props<T>) {
  const { colors } = useTheme();
  const fill = soft ? { backgroundColor: colors.primarySoft } : greenGradient;
  const { measure, highlight } = useSelectionHighlight(animateFilter ? value : undefined, fill);
  return (
    <View style={[styles.row, required && { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, borderColor: invalid ? colors.danger : value === '' ? colors.primaryInk : colors.primaryLine, backgroundColor: !invalid && value === '' ? colors.primarySoft : undefined }]} testID={testID}>
      {highlight}
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={o.value === value} softSelection={soft}
          highlightBehind={o.value === value && Boolean(highlight)} disabled={disabled}
          onLayout={animateFilter ? measure(o.value) : undefined} onPress={() => onChange(o.value)}
          style={soft && styles.softChip} textStyle={soft && styles.softText} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  softChip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: spacing.xs },
  softText: { fontSize: 12 },
});
