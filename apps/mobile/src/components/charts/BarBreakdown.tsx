import React from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { AssistantCard } from '@wehdathub/shared';
import { radius, spacing, useTheme } from '../../theme';
import { AppText as Text } from '../AppText';
import { Avatar } from '../Avatar';
import { ChartFrame } from './ChartFrame';
import { useGrow } from './motion';

type Card = Extract<AssistantCard, { kind: 'bar_breakdown' }>;

function Bar({ pct, color }: { pct: number; color: string }) {
  const grow = useGrow();
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));
  return <Animated.View style={[styles.fill, { width: `${Math.max(2, Math.min(100, pct))}%`, backgroundColor: color, transformOrigin: I18nManager.isRTL ? 'right center' : 'left center' }, style]} />;
}

/** Label, a track with a bar growing from 0, and the value at the end; an optional 28px avatar per row. */
export function BarBreakdown({ card, num, onNavigate }: { card: Card; num: (n: number) => string; onNavigate?: (s: string, p?: Record<string, unknown>) => void }) {
  const { colors } = useTheme();
  const rows = card.rows ?? [];
  const max = Math.max(1, ...rows.map((r) => Number(r.count || 0)));
  return (
    <ChartFrame testID="card-bar-breakdown" title={card.title} summary={card.summary} link={card.link} onNavigate={onNavigate}>
      {rows.map((r) => (
        <View key={r.key} style={styles.row}>
          {r.avatarUrl ? <Avatar name={r.label} uri={r.avatarUrl} size={28} /> : null}
          <Text numberOfLines={1} style={[styles.label, { color: colors.text }]}>{r.label}</Text>
          <View style={[styles.track, { backgroundColor: colors.border }]}><Bar pct={(Number(r.count || 0) / max) * 100} color={colors.chartBar} /></View>
          <Text style={[styles.value, { color: colors.text }]}>{r.valueLabel ?? num(r.count)}</Text>
        </View>
      ))}
    </ChartFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  label: { width: 84, fontSize: 13 },
  track: { flex: 1, height: 8, borderRadius: radius.sm / 2, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.sm / 2 },
  value: { fontWeight: '700', fontSize: 13, fontVariant: ['tabular-nums'], minWidth: 28, textAlign: 'right' },
});
