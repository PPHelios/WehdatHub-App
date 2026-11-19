import React from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { AppText as Text } from './AppText';
import { spacing, useTheme } from '../theme';

const TRIGGER = 90;
/** In right-to-left the labels swap sides (the first one sits on the right), so the swipe direction flips with them. */
const dxOf = (dx: number, rtl: boolean) => {
  'worklet';
  return rtl ? -dx : dx;
};

/** Swipe right for one action, left for another; the row springs back after. Works the same on Android and iOS. */
export function SwipeRow({ children, rightLabel, leftLabel, onSwipeRight, onSwipeLeft }: { children: React.ReactNode; rightLabel: string; leftLabel: string; onSwipeRight: () => void; onSwipeLeft: () => void }) {
  const { colors } = useTheme();
  const x = useSharedValue(0);
  const rtl = I18nManager.isRTL; // read here: the UI thread cannot reach I18nManager
  // Runs on the UI thread: a mostly horizontal drag past 14 points takes over; a vertical one leaves the list scrolling.
  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      x.value = Math.max(-160, Math.min(160, e.translationX));
    })
    .onEnd((e, success) => {
      x.value = withSpring(0);
      if (!success) return;
      const dx = dxOf(e.translationX, rtl);
      if (dx > TRIGGER) scheduleOnRN(onSwipeRight);
      else if (dx < -TRIGGER) scheduleOnRN(onSwipeLeft);
    })
    .onFinalize(() => {
      x.value = withSpring(0);
    });
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View>
      <View style={[styles.under, { backgroundColor: colors.card }]}>
        <Text style={[styles.label, { color: colors.primaryInk }]}>{rightLabel}</Text>
        <Text style={[styles.label, { color: colors.accent }]}>{leftLabel}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  under: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  label: { fontWeight: '800', fontSize: 15 },
});
