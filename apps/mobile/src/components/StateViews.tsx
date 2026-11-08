import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { spacing, useTheme } from '../theme';
import { Button } from './Button';

export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Text style={[styles.text, { color: colors.muted }]}>{label}</Text> : null}
    </View>
  );
}

/** Every failure shows what happened and a way forward (Retry and, where it helps, a second action). */
export function ErrorView({ message, retryLabel, onRetry, altLabel, onAlt }: { message: string; retryLabel: string; onRetry: () => void | Promise<unknown>; altLabel?: string; onAlt?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.text, { color: colors.danger }]}>{message}</Text>
      <View style={styles.actions}>
        <Button label={retryLabel} onPress={onRetry} />
        {altLabel && onAlt ? <Button label={altLabel} onPress={onAlt} variant="secondary" /> : null}
      </View>
    </View>
  );
}

/** An empty list always offers an action. */
export function EmptyView({ title, hint, actionLabel, onAction }: { title: string; hint?: string; actionLabel?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.text, { color: colors.muted }]}>{hint}</Text> : null}
      {actionLabel && onAction ? <View style={styles.actions}><Button label={actionLabel} onPress={onAction} variant="secondary" /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  text: { fontSize: 15, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
});
