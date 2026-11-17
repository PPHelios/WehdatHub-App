import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useBusyDisabled } from '../busy';
import { radius, spacing, useTheme } from '../theme';

/** Text that starts with Arabic sits at the right edge and Latin text at the left, whatever the screen's direction. */
function alignOf(v: unknown) {
  const first = typeof v === 'string' ? v.match(/[A-Za-z؀-ۿ]/)?.[0] : undefined;
  if (!first) return undefined;
  return { textAlign: /[؀-ۿ]/.test(first) ? ('right' as const) : ('left' as const), writingDirection: /[؀-ۿ]/.test(first) ? ('rtl' as const) : ('ltr' as const) };
}

/** A labelled text input. */
export function Field({ label, required, invalid, hint, ...props }: { label: string; required?: boolean; invalid?: boolean; hint?: string } & TextInputProps) {
  const { colors } = useTheme();
  const busy = useBusyDisabled(); // a server write is running: the field cannot be edited
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}{required ? <Text style={{ color: colors.primary }}> *</Text> : null}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props} editable={props.editable !== false && !busy} style={[styles.input, { color: colors.text, borderColor: invalid ? colors.danger : required ? colors.primary : colors.border, backgroundColor: colors.card }, props.multiline && styles.multi, alignOf(props.value ?? props.defaultValue), props.style]} />
      {hint ? <Text testID="field-hint" style={[styles.label, { color: colors.accent }]}>{`\u202A${hint}\u202C`}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16 },
  multi: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
});
