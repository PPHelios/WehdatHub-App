import React from 'react';
import { Pressable } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { tick } from '../haptics';
import { SPRING } from '../motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  /** Light tick on press (default true). */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Pressable that shrinks to 0.97 while held and ticks on press. Disabled: no scale, no haptic. */
export function PressableScale({ haptic = true, style, onPress, onPressIn, onPressOut, disabled, accessibilityRole = 'button', ...rest }: Props) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      {...rest}
      style={[style, anim]}
      onPressIn={(e) => {
        if (!disabled && !reduced) scale.value = withSpring(0.97, SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic && !disabled) tick();
        onPress?.(e);
      }}
    />
  );
}
