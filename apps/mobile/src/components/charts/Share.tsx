import React from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { AssistantCard } from '@wehdathub/shared';
import { radius, spacing, useTheme } from '../../theme';
import { AppText as Text } from '../AppText';
import { ChartFrame } from './ChartFrame';
import { useGrow } from './motion';

type Card = Extract<AssistantCard, { kind: 'share' }>;

/** One stacked horizontal bar for the parts of a whole, with a legend below. */
export function Share({ card, num, onNavigate }: { card: Card; num: (n: number) => string; onNavigate?: (s: string, p?: Record<string, unknown>) => void }) {
  const { colors } = useTheme();
  const grow = useGrow();
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));
  const palette = [colors.chartBar, colors.accent, colors.warnInk, colors.muted, colors.primaryHi, colors.badInk];
  return (
    <ChartFrame testID="card-share" title={card.title} summary={card.summary} link={card.link} onNavigate={onNavigate}>
      <Animated.View style={[styles.bar, { transformOrigin: I18nManager.isRTL ? 'right center' : 'left center' }, style]}>
        {card.parts.map(({ key, value }, i) => <View key={key} style={{ flexGrow: value, backgroundColor: palette[i % palette.length] }} />)}
      </Animated.View>
      <View style={styles.legend}>
        {card.parts.map((p, i) => (
          <View key={p.key} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: palette[i % palette.length] }]} />
            <Text style={{ color: colors.text, fontSize: 13 }}>{p.label} · {num(p.pct)}%</Text>
          </View>
        ))}
      </View>
    </ChartFrame>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', height: 14, borderRadius: radius.sm, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingTop: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
