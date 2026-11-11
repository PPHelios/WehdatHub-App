import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import type { VoiceFile } from '@wehdathub/shared';
import { useAuth } from '../auth';
import { t } from '../i18n';
import { cancelRecording, ensureMic, startRecording, stopRecording } from '../voice';
import { radius, spacing, useTheme } from '../theme';

const CANCEL_PX = 80;
const MIN_MS = 600;

interface Props {
  label: string;
  testID?: string;
  /** Called with the note when the finger is lifted. */
  onFile: (file: VoiceFile) => void | Promise<unknown>;
  /** Called with a ready message when the mic is refused, the hold was too short, or recording failed. */
  onError: (message: string) => void;
  disabled?: boolean;
}

/** Press and hold to record, lift to send, slide away (sideways or up) to cancel. Used by every voice button. */
export function HoldMic({ label, testID, onFile, onError, disabled = false }: Props) {
  const { colors } = useTheme();
  const lang = useAuth((s) => s.broker?.lang) ?? 'ar';
  const [state, setState] = useState<'idle' | 'recording' | 'cancel' | 'sending'>('idle');
  const start = useRef({ x: 0, y: 0, at: 0 });
  const live = useRef<'idle' | 'starting' | 'recording'>('idle');
  const released = useRef(false);
  const away = useRef(false);

  const finish = async () => {
    const cancelled = away.current;
    const short = Date.now() - start.current.at < MIN_MS;
    live.current = 'idle';
    if (cancelled || short) {
      await cancelRecording();
      setState('idle');
      if (short && !cancelled) onError(t(lang, 'holdToTalk'));
      return;
    }
    setState('sending');
    try {
      await onFile(await stopRecording());
    } catch (e) {
      onError(e instanceof Error ? e.message : t(lang, 'serverError'));
    } finally {
      setState('idle');
    }
  };

  const grant = async (e: GestureResponderEvent) => {
    if (disabled || live.current !== 'idle' || state === 'sending') return;
    start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, at: Date.now() };
    released.current = false;
    away.current = false;
    live.current = 'starting';
    try {
      if (!(await ensureMic())) {
        live.current = 'idle';
        return onError(t(lang, 'micDenied'));
      }
      await startRecording();
    } catch {
      live.current = 'idle';
      setState('idle');
      return onError(t(lang, 'serverError'));
    }
    live.current = 'recording';
    if (released.current) return finish();
    setState('recording');
  };

  const move = (e: GestureResponderEvent) => {
    if (live.current === 'idle') return;
    const dx = Math.abs(e.nativeEvent.pageX - start.current.x);
    const dy = start.current.y - e.nativeEvent.pageY;
    away.current = dx > CANCEL_PX || dy > CANCEL_PX;
    setState((s) => (s === 'sending' ? s : away.current ? 'cancel' : 'recording'));
  };

  const release = () => {
    if (live.current === 'idle') return;
    released.current = true;
    if (live.current === 'recording') finish();
  };

  const on = state === 'recording' || state === 'cancel';
  const text = state === 'cancel' ? t(lang, 'releaseToCancel') : on ? t(lang, 'releaseToSend') : label;
  return (
    <View
      testID={testID}
      accessibilityRole="button"
      accessibilityHint={t(lang, 'holdToTalk')}
      accessibilityState={{ busy: state === 'sending', disabled }}
      onStartShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => { void grant(e); }}
      onResponderMove={move}
      onResponderRelease={release}
      onResponderTerminate={() => { away.current = true; release(); }}
      style={[styles.base, { borderColor: state === 'cancel' ? colors.danger : on ? colors.primary : colors.border, backgroundColor: on ? colors.card : 'transparent', opacity: disabled ? 0.6 : 1 }]}
    >
      {state === 'sending' ? <ActivityIndicator testID="button-spinner" color={colors.primary} /> : null}
      <Text style={{ color: state === 'cancel' ? colors.danger : colors.text, fontWeight: '700' }}>{text}</Text>
      {on ? <Text style={{ color: colors.muted, fontSize: 12 }}>{t(lang, 'slideToCancel')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
});
