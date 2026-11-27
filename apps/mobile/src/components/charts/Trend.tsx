import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import type { AssistantCard } from '@wehdathub/shared';
import { spacing, typeScale, useTheme } from '../../theme';
import { AppText as Text } from '../AppText';
import { UrgencyBadge } from '../SectionCard';
import { ChartFrame } from './ChartFrame';
import { useGrow } from './motion';

type Card = Extract<AssistantCard, { kind: 'trend' }>;
const AnimatedPath = Animated.createAnimatedComponent(Path);
const H = 80;
const PAD = 6;

/** Sparkline with an area: the line draws in, the area fades in, the last point gets a dot. */
export function Trend({ card, onNavigate }: { card: Card; onNavigate?: (s: string, p?: Record<string, unknown>) => void }) {
  const { colors } = useTheme();
  const [w, setW] = useState(280);
  const grow = useGrow(600);
  const vals = card.points.map((p) => p.value);
  const max = Math.max(1, ...vals);
  const last = vals.length - 1;
  const x = (i: number) => PAD + (i * (w - 2 * PAD)) / Math.max(1, last);
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(last).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  const len = w * 2; // upper bound of the path length: a dash that hides the whole line until it draws in
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - grow.value) }));
  const areaStyle = useAnimatedStyle(() => ({ opacity: grow.value }));
  const tone = card.direction === 'rising' ? 'ok' : card.direction === 'falling' ? 'warn' : 'neutral';
  const arrow = card.direction === 'rising' ? '▲ ' : card.direction === 'falling' ? '▼ ' : '';
  return (
    <ChartFrame testID="card-trend" title={card.title} summary={card.summary} link={card.link} onNavigate={onNavigate}>
      <View style={styles.pillRow}>
        <UrgencyBadge tone={tone} label={`${arrow}${card.directionLabel}${card.changePct == null ? '' : ` ${card.changePct > 0 ? '+' : ''}${card.changePct}%`}`} />
      </View>
      <View onLayout={(e) => setW(Math.max(120, Math.round(e.nativeEvent.layout.width)))}>
        <Animated.View style={[StyleSheet.absoluteFill, areaStyle]}>
          <Svg width={w} height={H}><Path d={area} fill={colors.chartBar} fillOpacity={0.12} /></Svg>
        </Animated.View>
        <Svg width={w} height={H}>
          <AnimatedPath d={line} stroke={colors.chartBar} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} animatedProps={lineProps} />
          <Circle cx={x(last)} cy={y(vals[last])} r={4.5} fill={colors.chartBar} />
        </Svg>
      </View>
      <View style={styles.axis}>
        <Text style={{ color: colors.muted, fontSize: typeScale.micro.fontSize }}>{card.points[0]?.label}</Text>
        <Text style={{ color: colors.muted, fontSize: typeScale.micro.fontSize }}>{card.points[last]?.label}</Text>
      </View>
    </ChartFrame>
  );
}

const styles = StyleSheet.create({
  pillRow: { flexDirection: 'row', paddingBottom: spacing.xs },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
