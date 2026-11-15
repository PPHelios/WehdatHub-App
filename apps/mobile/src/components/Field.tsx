import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { radius, spacing, useTheme } from '../theme';

/** A labelled text input. */
export function Field({ label, ...props }: { label: string } & TextInputProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }, props.multiline && styles.multi, props.style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16 },
  multi: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
});
