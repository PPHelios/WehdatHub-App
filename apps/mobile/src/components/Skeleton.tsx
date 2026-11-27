import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { radius as r, spacing, useTheme } from '../theme';

interface Props {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

// shortcut: opacity pulse, not a moving gradient band (no gradient lib); upgrade if one is added.
export function Skeleton({ width = '100%', height = 16, radius = r.sm, style }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const p = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    p.value = withRepeat(withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduced, p]);
  const anim = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View
      testID="skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.border }, anim, style]}
    />
  );
}

/** Compact unit/lead row: 88px square + 3 lines. */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <Skeleton width={88} height={88} radius={r.md} />
      <View style={styles.lines}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="50%" height={12} />
        <Skeleton width="35%" height={12} />
      </View>
    </View>
  );
}

/** Hero card: 16:10 block + 3 lines. */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.hero}><Skeleton height="100%" radius={r.md} /></View>
      <Skeleton width="70%" height={16} />
      <Skeleton width="50%" height={12} />
      <Skeleton width="35%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  lines: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  card: { gap: spacing.sm, padding: spacing.md },
  hero: { aspectRatio: 16 / 10 },
});
