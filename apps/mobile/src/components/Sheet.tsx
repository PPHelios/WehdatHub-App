import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text } from './AppText';
import { DURATION, SPRING } from '../motion';
import { elevation, radius, spacing, useTheme } from '../theme';

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

/** Shared bottom sheet: fading backdrop, spring-up panel, drag down to dismiss, Android back and backdrop tap close it. Reduced motion: fade only. */
export function Sheet({ visible, onClose, title, children, testID }: { visible: boolean; onClose: () => void; title?: string; children?: React.ReactNode; testID?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(reduce ? 0 : height);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      fade.value = withTiming(1, { duration: DURATION.base });
      y.value = reduce ? 0 : withSpring(0, SPRING);
      return undefined;
    }
    fade.value = withTiming(0, { duration: DURATION.fast });
    if (!reduce) y.value = withTiming(height, { duration: DURATION.base });
    const id = setTimeout(() => setMounted(false), DURATION.base);
    return () => clearTimeout(id);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps -- shared values are stable; only `visible` starts a transition

  const pan = Gesture.Pan()
    .onUpdate((e) => { y.value = Math.max(0, e.translationY); })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) runOnJS(onClose)();
      else y.value = withSpring(0, SPRING);
    });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: reduce ? fade.value : 1 }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!mounted && !visible) return null;
  return (
    <Modal transparent statusBarTranslucent visible animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable testID={testID ? `${testID}-backdrop` : 'sheet-backdrop'} accessibilityRole="button" accessibilityLabel={title ?? 'Close'} style={styles.fill} onPress={onClose} />
        </Animated.View>
        <View style={styles.bottom} pointerEvents="box-none">
          <GestureDetector gesture={pan}>
            <Animated.View testID={testID} style={[styles.panel, { backgroundColor: colors.card, paddingBottom: insets.bottom + spacing.lg }, panelStyle]}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              {title ? <Text variant="heading" style={{ color: colors.text }}>{title}</Text> : null}
              {children}
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { backgroundColor: elevation.lg.shadowColor, opacity: 0 },
  bottom: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  panel: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.xs },
});
