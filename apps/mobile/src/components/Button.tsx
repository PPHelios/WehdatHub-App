import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { PressableScale } from './PressableScale';
import { useBusy } from '../busy';
import { buttonHeight, buttonRadius, greenGradient, spacing, typeScale, useTheme } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'whatsapp';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  onPress: () => void | Promise<unknown>;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  /** sm 44, md 48 (default), lg 56. */
  size?: ButtonSize;
  testID?: string;
  /** 0 to 1: a fill that moves across the button while a long action runs. */
  progress?: number;
}

/** Every button shows a spinner while its action runs and ignores taps until it ends (no double submits). */
export function Button({ label, onPress, loading = false, disabled = false, variant = 'primary', size = 'md', testID, progress }: Props) {
  const { colors, elev } = useTheme();
  const busy = useRef(false);
  const alive = useRef(true);
  const [running, setRunning] = useState(false);
  useEffect(() => () => { alive.current = false; }, []);
  const { busy: anyBusy, begin } = useBusy();
  const spin = loading || running;
  // A button whose screen passes `loading` also locks the rest of the screen while it is loading.
  useEffect(() => (loading ? begin() : undefined), [loading, begin]);
  // Another call is running (not this one): this button cannot be pressed, and it does not spin.
  const blocked = spin || disabled || anyBusy;
  // Filled buttons (primary, danger) carry an "on" colour; secondary has an edge; quiet has neither.
  const filled = variant === 'primary' || variant === 'danger';
  const wa = variant === 'whatsapp';
  const fill = variant === 'danger' ? colors.danger : colors.primary;
  const ink = wa ? colors.onWhatsapp : filled ? (variant === 'danger' ? colors.onDanger : colors.onPrimary) : variant === 'quiet' ? colors.primaryInk : colors.text;
  const handle = async () => {
    if (blocked || busy.current) return;
    busy.current = true;
    const end = begin();
    setRunning(true); // the spinner shows while any action that calls the server is running, even when the screen passes no `loading`
    try {
      await onPress();
    } finally {
      busy.current = false;
      end();
      if (alive.current) setRunning(false);
    }
  };
  return (
    <PressableScale
      haptic={!blocked}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ busy: spin, disabled: blocked }}
      disabled={blocked}
      onPress={handle}
      style={[
        styles.base,
        variant === 'primary' || variant === 'secondary' || wa ? elev('sm') : null,
        { minHeight: buttonHeight[size], backgroundColor: wa ? colors.whatsapp : filled ? fill : variant === 'secondary' ? colors.card : 'transparent', borderColor: wa ? colors.whatsapp : variant === 'primary' ? colors.primaryHi : variant === 'danger' ? fill : variant === 'quiet' ? 'transparent' : colors.lineStrong, opacity: blocked ? 0.6 : 1 },
        variant === 'primary' && greenGradient,
      ]}
    >
      {progress !== undefined ? <View testID="button-progress" pointerEvents="none" style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`, backgroundColor: filled ? ink : colors.primary }]} /> : null}
      {spin && progress === undefined ? <ActivityIndicator testID="button-spinner" color={filled ? ink : colors.spinner} /> : null}
      <Text style={[styles.label, { color: ink, fontSize: size === 'sm' ? 14 : 16 }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', borderRadius: buttonRadius, borderWidth: 1, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  label: { fontSize: typeScale.body.fontSize, fontWeight: '700' },
  fill: { position: 'absolute', start: 0, top: 0, bottom: 0, opacity: 0.22 },
});
