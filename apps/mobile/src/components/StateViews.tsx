import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useBusy } from '../busy';
import { enter } from '../motion';
import { AppText as Text } from './AppText';
import { spacing, useTheme } from '../theme';
import { Button } from './Button';
import { SkeletonCard, SkeletonRow } from './Skeleton';
import { Icon } from './Icon';
import type { IconName } from './Icon';

function Placeholders({ kind }: { kind: 'rows' | 'cards' }) {
  const Item = kind === 'cards' ? SkeletonCard : SkeletonRow;
  return (
    <View style={styles.blocks}>
      {[0, 1, 2].map((i) => <View key={i} testID="loading-placeholder"><Item /></View>)}
    </View>
  );
}

export function Loading({ label, kind = 'spinner' }: { label?: string; kind?: 'spinner' | 'rows' | 'cards' }) {
  const { colors } = useTheme();
  const { busy } = useBusy();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      {kind !== 'spinner' ? <Placeholders kind={kind} /> : null}
      {kind === 'spinner' && !busy ? <ActivityIndicator color={colors.spinner} size="large" /> : null}
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
export function EmptyView({ title, hint, actionLabel, onAction, actionVariant = 'secondary', icon, secondaryAction }: { title: string; hint?: string; actionLabel?: string; onAction?: () => void; actionVariant?: 'primary' | 'secondary'; icon?: IconName; secondaryAction?: { label: string; onPress: () => void } }) {
  const { colors } = useTheme();
  const primary = actionLabel && onAction;
  return (
    <Animated.View entering={enter()} style={styles.center}>
      {icon ? <View testID="empty-icon" style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}><Icon name={icon} color={colors.primaryInk} size={28} /></View> : null}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.text, { color: colors.muted }]}>{hint}</Text> : null}
      {primary || secondaryAction ? (
        <View style={styles.actions}>
          {primary ? <Button label={actionLabel} onPress={onAction} variant={actionVariant} /> : null}
          {secondaryAction ? <Button label={secondaryAction.label} onPress={secondaryAction.onPress} variant="quiet" /> : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  text: { fontSize: 15, textAlign: 'center' },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  blocks: { alignSelf: 'stretch', gap: spacing.md },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
});
