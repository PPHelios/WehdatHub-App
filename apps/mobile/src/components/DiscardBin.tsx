import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { trigger } from 'react-native-haptic-feedback';

/** Whole "thrown in the bin" timeline in ms. `t` runs 0 to DISCARD_MS linearly; every phase below is a window on it. */
export const DISCARD_MS = 600;
/** Mic flight window. */
export const FLY_FROM = 120;
export const FLY_TO = 400;
export const CLOSE_AT = 400;
export const BIN = 28;

/** Light tap when the lid snaps shut. */
export function binClack() {
  try {
    trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  } catch {
    // No haptic motor: nothing to do.
  }
}

/** Progress 0..1 of `t` inside [from, to], clamped. */
export const seg = (t: number, from: number, to: number) => {
  'worklet';
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
};

/** Bin with a hinged lid. Rises in, opens, waits for the mic, snaps shut, drops away. Sits at the start of its parent row. */
export function DiscardBin({ t, color, soft }: { t: SharedValue<number>; color: string; soft: string }) {
  const box = useAnimatedStyle(() => {
    const up = Easing.out(Easing.cubic)(seg(t.value, 0, 120));
    const down = Easing.in(Easing.cubic)(seg(t.value, 450, 600));
    return { opacity: up * (1 - down), transform: [{ translateY: interpolate(up, [0, 1], [22, 0]) + down * 22 }] };
  });
  const lid = useAnimatedStyle(() => {
    const open = seg(t.value, 60, 120);
    const shut = seg(t.value, CLOSE_AT, 490);
    return { transform: [{ rotate: `${-38 * open * (1 - shut)}deg` }] };
  });
  return (
    <Animated.View testID="discard-bin" pointerEvents="none" style={[styles.box, box]}>
      <Svg width={BIN} height={BIN} viewBox="0 0 24 24">
        <Path d="M6 9h12l-1 10.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5L6 9z" fill={soft} stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
        <Path d="M10 12v6M14 12v6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
      {/* Lid group: own layer, hinged at its start (left) end. */}
      <Animated.View style={[styles.lid, lid]}>
        <Svg width={BIN} height={BIN} viewBox="0 0 24 24">
          <Path d="M4 6.5h16M9.5 6.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { width: BIN, height: BIN },
  lid: { position: 'absolute', top: 0, left: 0, width: BIN, height: BIN, transformOrigin: '17% 27%' },
});
