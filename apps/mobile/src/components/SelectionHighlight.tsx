import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, LayoutRectangle, ViewStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const motion = { duration: 210, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

function Highlight({ frame, fill, radius, inset, testID }: {
  frame: LayoutRectangle; fill: ViewStyle; radius: number; inset: number; testID?: string;
}) {
  const { x, y, width, height } = frame;
  const position = useAnimatedStyle(() => ({
    width: withTiming(Math.max(0, width - 2 * inset), motion),
    height: withTiming(Math.max(0, height - 2 * inset), motion),
    transform: [{ translateX: withTiming(x + inset, motion) }, { translateY: withTiming(y + inset, motion) }],
  }));
  return (
    // onLayout coordinates are physical, including when the surrounding controls are RTL.
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { direction: 'ltr' }]}>
      <Animated.View testID={testID} style={[{ position: 'absolute', start: 0, top: 0, borderRadius: radius }, fill, position]} />
    </View>
  );
}

export function useSelectionHighlight(value: string | undefined, fill: ViewStyle, radius = 999, inset = 0, testID?: string) {
  const [frames, setFrames] = useState(() => new Map<string, LayoutRectangle>());
  const measure = (key: string) => ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setFrames((current) => {
      const old = current.get(key);
      if (old && old.x === layout.x && old.y === layout.y && old.width === layout.width && old.height === layout.height) return current;
      return new Map(current).set(key, layout);
    });
  };
  const frame = value === undefined ? undefined : frames.get(value);
  return {
    measure,
    highlight: frame ? <Highlight frame={frame} fill={fill} radius={radius} inset={inset} testID={testID} /> : null,
  };
}
