import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { spacing, useTheme } from '../theme';

const TRIGGER = 90;

/** Swipe right for one action, left for another; the row springs back after. Works the same on Android and iOS. */
export function SwipeRow({ children, rightLabel, leftLabel, onSwipeRight, onSwipeLeft }: { children: React.ReactNode; rightLabel: string; leftLabel: string; onSwipeRight: () => void; onSwipeLeft: () => void }) {
  const { colors } = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  const handlers = useRef({ onSwipeRight, onSwipeLeft });
  handlers.current = { onSwipeRight, onSwipeLeft };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_, g) => x.setValue(Math.max(-160, Math.min(160, g.dx))),
      onPanResponderRelease: (_, g) => {
        Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        if (g.dx > TRIGGER) handlers.current.onSwipeRight();
        else if (g.dx < -TRIGGER) handlers.current.onSwipeLeft();
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;
  return (
    <View>
      <View style={[styles.under, { backgroundColor: colors.card }]}>
        <Text style={[styles.label, { color: colors.primary }]}>{rightLabel}</Text>
        <Text style={[styles.label, { color: colors.accent }]}>{leftLabel}</Text>
      </View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  under: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  label: { fontWeight: '800', fontSize: 15 },
});
