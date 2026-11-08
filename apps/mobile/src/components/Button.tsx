import React, { useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { radius, spacing, useTheme } from '../theme';

interface Props {
  label: string;
  onPress: () => void | Promise<unknown>;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  testID?: string;
}

/** Every button shows a spinner while its action runs and ignores taps until it ends (no double submits). */
export function Button({ label, onPress, loading = false, disabled = false, variant = 'primary', testID }: Props) {
  const { colors } = useTheme();
  const busy = useRef(false);
  const blocked = loading || disabled;
  const primary = variant === 'primary';
  const handle = async () => {
    if (blocked || busy.current) return;
    busy.current = true;
    try {
      await onPress();
    } finally {
      busy.current = false;
    }
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: blocked }}
      onPress={handle}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: primary ? colors.primary : 'transparent', borderColor: primary ? colors.primary : colors.border, opacity: blocked ? 0.6 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator testID="button-spinner" color={primary ? colors.onPrimary : colors.primary} /> : null}
      <Text style={[styles.label, { color: primary ? colors.onPrimary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  label: { fontSize: 16, fontWeight: '700' },
});
