import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';
import type { AssistantCard } from '@wehdathub/shared';
import { spacing, useTheme } from '../../theme';
import { AppText as Text } from '../AppText';
import { ChartFrame } from './ChartFrame';
import { useGrow } from './motion';

type Card = Extract<AssistantCard, { kind: 'price_range' }>;
const H = 90;
const million = (n: number) => `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;

/** Histogram of unit prices with an optional dashed budget line and pill. */
export function PriceRange({ card, onNavigate }: { card: Card; onNavigate?: (s: string, p?: Record<string, unknown>) => void }) {
  const { colors } = useTheme();
  const [w, setW] = useState(280);
  const grow = useGrow();
  const style = useAnimatedStyle(() => ({ opacity: grow.value }));
  const max = Math.max(1, ...card.bins.map((b) => b.count));
  const gap = 4;
  const bw = (w - gap * (card.bins.length - 1)) / card.bins.length;
  const span = Math.max(1, card.max - card.min);
  const bx = card.budget ? Math.max(0, Math.min(w, ((card.budget.value - card.min) / span) * w)) : null;
  return (
    <ChartFrame testID="card-price-range" title={card.title} summary={card.summary} link={card.link} onNavigate={onNavigate}>
      <View onLayout={(e) => setW(Math.max(120, Math.round(e.nativeEvent.layout.width)))}>
        {card.budget ? (
          <View testID="price-range-budget" style={[styles.pill, { backgroundColor: colors.warnSoft, marginStart: Math.min(Math.max(0, (bx ?? 0) - 60), Math.max(0, w - 150)) }]}>
            <Text style={{ color: colors.warnInk, fontSize: 12, fontWeight: '700' }}>{card.budget.label}</Text>
          </View>
        ) : null}
        <Animated.View style={style}>
          <Svg width={w} height={H}>
            {card.bins.map((b, i) => {
              const h = Math.max(b.count ? 4 : 1, (b.count / max) * (H - 8));
              return <Rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={3} fill={colors.chartBar} fillOpacity={b.count ? 0.85 : 0.2} />;
            })}
            {bx != null ? <Line x1={bx} x2={bx} y1={0} y2={H} stroke={colors.warnInk} strokeWidth={2} strokeDasharray="5 4" /> : null}
          </Svg>
        </Animated.View>
      </View>
      <View style={styles.axis}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{million(card.min)}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{million(card.max)}</Text>
      </View>
    </ChartFrame>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999, marginBottom: spacing.xs },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
