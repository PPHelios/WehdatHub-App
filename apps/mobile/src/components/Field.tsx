import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import type { TextInputProps } from 'react-native';
import { useBusyDisabled } from '../busy';
import { radius, spacing, typeScale, useTheme } from '../theme';

/** Text that starts with Arabic sits at the right edge and Latin text at the left, whatever the screen's direction. */
function alignOf(v: unknown, isPhoneField = false) {
  if (isPhoneField) return { direction: 'ltr' as const, textAlign: 'left' as const, writingDirection: 'ltr' as const };
  const first = typeof v === 'string' ? v.match(/[A-Za-z؀-ۿ]/)?.[0] : undefined;
  if (!first) {
    // A bare phone number keeps its digit groups in order inside the RTL layout.
    if (typeof v === 'string' && /\d/.test(v) && /^[\d\s+\-().]+$/.test(v)) return { direction: 'ltr' as const, textAlign: 'left' as const, writingDirection: 'ltr' as const };
    return undefined;
  }
  return { textAlign: /[؀-ۿ]/.test(first) ? ('right' as const) : ('left' as const), writingDirection: /[؀-ۿ]/.test(first) ? ('rtl' as const) : ('ltr' as const) };
}

/** A labelled text input. */
export function Field({ label, required, invalid, hint, ...props }: { label: string; required?: boolean; invalid?: boolean; hint?: string } & TextInputProps) {
  const { colors } = useTheme();
  const [focus, setFocus] = useState(false);
  const busy = useBusyDisabled(); // a server write is running: the field cannot be edited
  const emptyRequired = required && !String(props.value ?? props.defaultValue ?? '').trim();
  const labelText = required ? label.replace(/\s*\*$/, '') : label;
  const borderColor = invalid ? colors.danger : (focus || emptyRequired) ? colors.primaryInk : required ? colors.primaryLine : colors.lineStrong;
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.muted }]}>{labelText}{required ? <Text style={{ color: colors.primaryInk }}> *</Text> : null}</Text>
      <View style={[styles.ring, focus && !invalid && !emptyRequired && { backgroundColor: colors.primarySoft }]}>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props} onFocus={(e) => { setFocus(true); props.onFocus?.(e); }} onBlur={(e) => { setFocus(false); props.onBlur?.(e); }} editable={props.editable !== false && !busy} style={[styles.input, { color: colors.text, borderColor, backgroundColor: emptyRequired && !invalid ? colors.requiredField : colors.field }, props.multiline && styles.multi, alignOf(props.value ?? props.defaultValue, props.keyboardType === 'phone-pad' || props.textContentType === 'telephoneNumber'), props.style]} />
      </View>
      {hint ? <Text testID="field-hint" style={[styles.label, { color: colors.accent }]}>{`\u202A${hint}\u202C`}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { margin: -3, padding: 3, borderRadius: radius.md + 3 },
  wrap: { gap: spacing.xs },
  label: { fontSize: typeScale.bodySm.fontSize, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: typeScale.body.fontSize },
  multi: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
});
