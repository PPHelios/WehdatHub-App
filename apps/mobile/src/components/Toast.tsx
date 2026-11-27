import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import HapticFeedback from 'react-native-haptic-feedback';
import { AppText as Text } from './AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { DURATION } from '../motion';
import { radius, spacing, useTheme } from '../theme';

/**
 * The app's one message style for a result or an error, the same as the website's toast (web/static/app.js): a short line
 * above the bottom bar, where the person's thumb and eyes already are, not at the top of the screen. An error stays 6 s,
 * a result 4 s; a tap closes it. Pop-up alerts are kept for "are you sure?" questions only.
 */
type ToastState = { text: string | null; bad: boolean; n: number };
export const useToastStore = create<ToastState>(() => ({ text: null, bad: false, n: 0 }));

/** Shows `text` as the toast; `bad` for an error. Callable from anywhere (no hook needed). */
export function toast(text: string, bad = false): void {
  const t = String(text || '').trim();
  if (!t) return;
  useToastStore.setState((s) => ({ text: t, bad, n: s.n + 1 }));
}

/**
 * An action's error: shown in the toast (where the person is looking) and returned, so the screen can also keep it next to
 * the form it belongs to: setError(toastError(errorText(e, lang))).
 */
export function toastError<T extends string | null | undefined>(text: T): T {
  if (text) toast(text, true);
  return text;
}

export function ToastHost() {
  const { colors, elev } = useTheme();
  const insets = useSafeAreaInsets();
  const { text, bad, n } = useToastStore();
  useEffect(() => {
    if (!text) return undefined;
    try { HapticFeedback.trigger('impactLight', { enableVibrateFallback: false }); } catch { /* haptics are optional */ }
    const id = setTimeout(() => useToastStore.setState({ text: null }), bad ? 6000 : 4000);
    return () => clearTimeout(id);
  }, [text, bad, n]);
  if (!text) return null;
  return (
    <Animated.View
      key={n}
      entering={FadeInDown.duration(DURATION.base).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutDown.duration(DURATION.fast).reduceMotion(ReduceMotion.System)}
      style={[styles.box, elev('lg'), { bottom: insets.bottom + 88, backgroundColor: bad ? colors.danger : colors.text }]}
    >
      <Pressable testID="toast" accessibilityRole="alert" accessibilityLiveRegion="polite" onPress={() => useToastStore.setState({ text: null })} style={styles.press}>
        <Text style={{ color: bad ? colors.onDanger : colors.bg, fontWeight: '600', textAlign: 'center' }}>{text}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', start: spacing.lg, end: spacing.lg, borderRadius: radius.md },
  press: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
});
