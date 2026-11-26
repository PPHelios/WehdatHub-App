import React, { useEffect } from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppText as Text } from './AppText';
import { radius, spacing, useTheme } from '../theme';

/** One line of a stats card: the label on one side, the value on the other, and an optional thin bar (0 to 100) under them. */
export function StatRow({ label, value, pct, testID, animate = false, color }: { label: string; value: string; pct?: number; testID?: string; animate?: boolean; color?: string }) {
  const { colors } = useTheme();
  const barColor = color ?? colors.chartBar;
  return (
    <View testID={testID} style={{ gap: 4, paddingVertical: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <Text numberOfLines={1} style={{ color: colors.text, flexShrink: 1 }}>{label}</Text>
        <Text style={{ color: colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
      </View>
      {pct != null ? (
        <View style={{ height: 6, borderRadius: radius.sm / 2, backgroundColor: colors.border }}>
          {animate ? <StatBar pct={pct} color={barColor} /> : <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 6, borderRadius: radius.sm / 2, backgroundColor: barColor }} />}
        </View>
      ) : null}
    </View>
  );
}

function StatBar({ pct, color }: { pct: number; color: string }) {
  const ratio = useSharedValue(0);
  useEffect(() => {
    ratio.value = withTiming(Math.max(0, Math.min(1, pct / 100)), { duration: 230, reduceMotion: ReduceMotion.System });
  }, [pct, ratio]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: ratio.value }] }));
  return <Animated.View style={[
    StyleSheet.absoluteFill,
    { backgroundColor: color, borderRadius: radius.sm / 2, transformOrigin: I18nManager.isRTL ? 'right center' : 'left center' },
    style,
  ]} />;
}
