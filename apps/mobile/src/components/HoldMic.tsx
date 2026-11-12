import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import type { VoiceFile } from '@wehdathub/shared';
import { useAuth } from '../auth';
import { t } from '../i18n';
import { cancelRecording, ensureMic, startRecording, stopRecording } from '../voice';
import { reportError } from '../errorReport';
import { tick } from '../haptics';
import { Icon } from './Icon';
import { spacing, useTheme } from '../theme';

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
  const pulse = useRef(new Animated.Value(1)).current;
  const [secs, setSecs] = useState(0);
  const on = state === 'recording' || state === 'cancel';
  // While recording: the mic pulses and a timer runs, so it is clear that it is listening.
  useEffect(() => {
    if (!on) {
      pulse.setValue(1);
      setSecs(0);
      return;
    }
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1.25, duration: 600, useNativeDriver: true }), Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true })]));
    loop.start();
    const timer = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => {
      loop.stop();
      clearInterval(timer);
    };
  }, [on, pulse]);

  const finish = async () => {
    const cancelled = away.current;
    const short = Date.now() - start.current.at < MIN_MS;
    live.current = 'idle';
    if (cancelled || short) {
      await cancelRecording();
      setState('idle');
      if (short && !cancelled) { tick(); onError(t(lang, 'holdToTalk')); }
      return;
    }
    setState('sending');
    try {
      await onFile(await stopRecording());
    } catch (e) {
      reportError(e, 'voice-stop');
      onError(t(lang, 'micFailed'));
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
    } catch (e) {
      live.current = 'idle';
      setState('idle');
      // The reason goes to the server's error list, so a phone where the microphone does not start can be fixed.
      reportError(e, 'voice-start');
      return onError(t(lang, 'micFailed'));
    }
    tick();
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

  const cancel = state === 'cancel';
  const tone = cancel ? colors.danger : on ? colors.accent : colors.primary;
  const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <View
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t(lang, 'holdToTalk')}
      accessibilityState={{ busy: state === 'sending', disabled }}
      onStartShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => { void grant(e); }}
      onResponderMove={move}
      onResponderRelease={release}
      onResponderTerminate={() => { away.current = true; release(); }}
      style={[styles.base, { borderColor: tone, backgroundColor: on ? `${tone}22` : 'transparent', opacity: disabled ? 0.6 : 1 }]}
    >
      {state === 'sending' ? (
        <ActivityIndicator testID="button-spinner" color={colors.primary} />
      ) : (
        <Animated.View style={[styles.dot, { backgroundColor: tone, transform: [{ scale: pulse }] }]}>
          <Icon name={cancel ? 'trash' : 'mic'} color="#FFFFFF" size={18} />
        </Animated.View>
      )}
      <View style={styles.texts}>
        <Text style={{ color: cancel ? colors.danger : colors.text, fontWeight: '700' }}>{cancel ? t(lang, 'releaseToCancel') : on ? `${t(lang, 'releaseToSend')} · ${mm}` : label}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{on ? t(lang, 'dragCancel') : t(lang, 'holdMic')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 56, borderWidth: 1.5, borderRadius: 28, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1 },
});
