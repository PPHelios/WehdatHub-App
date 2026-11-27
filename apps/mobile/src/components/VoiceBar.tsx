import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, I18nManager, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { VoiceFile } from '@wehdathub/shared';
import { currentLang } from '../auth';
import { t } from '../i18n';
import { cancelRecording, EmptyRecordingError, ensureMic, startRecording, stopRecording } from '../voice';
import { reportError } from '../errorReport';
import * as haptics from '../haptics';
import { Icon } from './Icon';
import { binClack, CLOSE_AT, DISCARD_MS, DiscardBin, FLY_FROM, FLY_TO, seg } from './DiscardBin';
import { greenGradient, radius, spacing, useTheme } from '../theme';

const CANCEL_PX = 80;
const LOCK_PX = 70;
const MIN_MS = 600;
// A finger must stay down this long before the microphone is touched, so a quick tap never lights the mic indicator.
const HOLD_MS = 200;
const BTN = 48;

type Phase = 'idle' | 'recording' | 'locked' | 'stopped' | 'sending' | 'discarding';

interface Props {
  /** Test id prefix: `${id}-input`, `${id}-go` (send), `${id}-mic`. */
  id: string;
  /** Spoken name of the button, and the text shown in the box when there is no text input. */
  label: string;
  /** Called with the note when it is sent. */
  onFile?: (file: VoiceFile) => void | Promise<unknown>;
  /** Called with a ready message when the mic is refused, or recording failed. */
  onError: (message: string) => void;
  disabled?: boolean;
  /** The screen is busy with the last request: the send button shows a spinner. */
  busy?: boolean;
  /** Text mode: pass all four. Without them the bar is mic-only. */
  value?: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  accessory?: React.ReactNode;
  leadingAccessory?: React.ReactNode;
  hideLeadingWhenTyping?: boolean;
  multiline?: boolean;
  maxInputHeight?: number;
  actionDecoration?: React.ReactNode;
  compact?: boolean;
}

const clamp = (n: number, lo: number, hi: number) => {
  'worklet';
  return Math.min(hi, Math.max(lo, n));
};

/**
 * One row: a rounded input and one round button on the physical right (both languages).
 * The button is a mic when the box is empty (hold to record, lift to send, slide left to cancel, slide up to lock)
 * and a send arrow when there is text. Without text input it is a mic-only bar.
 */
export function VoiceBar({ id, label, onFile, onError, disabled = false, busy = false, value, onChangeText, placeholder, onSubmit, accessory, leadingAccessory, hideLeadingWhenTyping = false, multiline = false, maxInputHeight = 88, actionDecoration, compact = false }: Props) {
  const { colors } = useTheme();
  const lang = currentLang();
  const reduced = useReducedMotion();
  const textMode = onChangeText !== undefined && onSubmit !== undefined;
  const hasText = textMode && (value ?? '').trim().length > 0;

  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const [secs, setSecs] = useState(0);
  const [cancelNow, setCancelNow] = useState(false);
  const [tip, setTip] = useState(false);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const live = useRef<'idle' | 'pending' | 'starting' | 'recording'>('idle');
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminated = useRef(false);
  // A note stopped by an interruption (call, app left) that waits for send or discard.
  const kept = useRef<VoiceFile | null>(null);
  const startAt = useRef(0);
  const released = useRef(false);
  const away = useRef(false);
  const lockWanted = useRef(false);

  // UI-thread values: the finger, the cancel / lock flags, the press scale, the blink, the shimmer, the bin drop.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const held = useSharedValue(0);
  const cancelSv = useSharedValue(0);
  const lockSv = useSharedValue(0);
  const blink = useSharedValue(1);
  const shimmer = useSharedValue(1);
  // Bin-drop timeline in ms (0 to DISCARD_MS), and the rail width the mic flies across.
  const bin = useSharedValue(0);
  const railW = useSharedValue(0);

  const resetUi = () => {
    lockSv.value = 0;
    cancelSv.value = 0;
    setCancelNow(false);
  };

  const showTip = () => {
    setTip(true);
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => setTip(false), 2000);
  };

  const inNote = phase === 'recording' || phase === 'locked';
  // Timer, blinking dot and shimmering hint run only while a note is being recorded.
  useEffect(() => {
    if (!inNote) {
      if (phase !== 'stopped') setSecs(0);
      return;
    }
    const timer = setInterval(() => setSecs((x) => x + 1), 1000);
    if (!reduced) {
      blink.value = withRepeat(withSequence(withTiming(0.15, { duration: 500 }), withTiming(1, { duration: 500 })), -1);
      shimmer.value = withRepeat(withSequence(withTiming(0.35, { duration: 800 }), withTiming(1, { duration: 800 })), -1);
    }
    return () => {
      clearInterval(timer);
      cancelAnimation(blink);
      cancelAnimation(shimmer);
      blink.value = 1;
      shimmer.value = 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inNote, reduced, blink, shimmer]);

  const endDiscard = () => {
    bin.value = 0;
    go('idle');
    resetUi();
  };

  /** Throws the note away. `animated`: the bin drop (a person chose it); otherwise silently (the app went away). */
  const discard = (animated: boolean) => {
    live.current = 'idle';
    if (kept.current) kept.current = null;
    else void cancelRecording();
    lockSv.value = 0;
    if (!animated) {
      go('idle');
      resetUi();
      return;
    }
    if (reduced) {
      haptics.discarded();
      go('idle');
      resetUi();
      return;
    }
    go('discarding');
    bin.value = 0;
    bin.value = withSequence(
      withTiming(CLOSE_AT, { duration: CLOSE_AT, easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(binClack);
      }),
      withTiming(DISCARD_MS, { duration: DISCARD_MS - CLOSE_AT, easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(endDiscard);
      }),
    );
  };

  const send = async () => {
    const waiting = kept.current;
    kept.current = null;
    const short = !waiting && Date.now() - startAt.current < MIN_MS;
    live.current = 'idle';
    lockSv.value = 0;
    resetUi();
    if (short) {
      void cancelRecording();
      go('idle');
      haptics.failed();
      showTip();
      return;
    }
    go('sending');
    try {
      const file = waiting ?? (await stopRecording());
      haptics.sent();
      await onFile?.(file);
    } catch (e) {
      if (e instanceof EmptyRecordingError) {
        haptics.failed();
        showTip();
      } else {
        reportError(e, 'voice-stop');
        haptics.failed();
        onError(t(lang, 'micFailed'));
      }
    } finally {
      go('idle');
    }
  };

  const lock = () => {
    lockWanted.current = false;
    go('locked');
    lockSv.value = 1;
    haptics.locked();
  };

  /** Finger down: the microphone starts only after HOLD_MS, so a quick tap never touches it. */
  const press = () => {
    if (!onFile || disabled || busy || live.current !== 'idle' || phaseRef.current !== 'idle') return;
    startAt.current = Date.now();
    released.current = false;
    away.current = false;
    terminated.current = false;
    live.current = 'pending';
    if (lockWanted.current) {
      void begin(); // screen readers cannot hold
      return;
    }
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      void begin();
    }, HOLD_MS);
  };

  const begin = async () => {
    live.current = 'starting';
    try {
      if (!(await ensureMic())) {
        live.current = 'idle';
        resetUi();
        haptics.failed();
        onError(t(lang, 'micDenied'));
        return;
      }
      await startRecording();
    } catch (e) {
      live.current = 'idle';
      resetUi();
      go('idle');
      // The reason goes to the server's error list, so a phone where the microphone does not start can be fixed.
      reportError(e, 'voice-start');
      haptics.failed();
      onError(t(lang, 'micFailed'));
      return;
    }
    haptics.recordStart();
    live.current = 'recording';
    go('recording');
    if (terminated.current) return keep();
    if (lockWanted.current) return lock();
    if (released.current) finishRelease();
  };

  /** A call came or the app was left: stop and KEEP a note of 600ms or more, so it can still be sent. */
  const keep = async () => {
    live.current = 'idle';
    lockSv.value = 0;
    const ms = Date.now() - startAt.current;
    if (ms < MIN_MS) return discard(false);
    try {
      kept.current = await stopRecording();
    } catch (e) {
      if (e instanceof EmptyRecordingError) showTip();
      else {
        reportError(e, 'voice-stop');
        onError(t(lang, 'micFailed'));
      }
      haptics.failed();
      go('idle');
      resetUi();
      return;
    }
    setSecs(Math.floor(ms / 1000));
    resetUi();
    go('stopped');
  };

  const finishRelease = () => {
    if (terminated.current) void keep();
    else if (away.current) discard(true);
    else void send();
  };

  const release = (ok: boolean) => {
    if (phaseRef.current === 'locked' || phaseRef.current === 'stopped') return; // lifting the finger is normal
    if (live.current === 'idle') {
      resetUi();
      return;
    }
    if (live.current === 'pending') {
      // Lifted before the mic started: a tap. Show the hint; the recorder was never touched.
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = null;
      live.current = 'idle';
      resetUi();
      if (ok) {
        haptics.failed();
        showTip();
      }
      return;
    }
    if (!ok) terminated.current = true; // the gesture was taken away
    released.current = true;
    if (live.current === 'recording') finishRelease();
  };

  /** The app left the foreground. */
  const interrupted = () => {
    if (live.current === 'pending') {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = null;
      live.current = 'idle';
      resetUi();
    } else if (live.current === 'starting') {
      terminated.current = true;
      released.current = true;
    } else if (live.current === 'recording') {
      void keep();
    }
  };

  const crossed = (isCancel: boolean) => {
    away.current = isCancel;
    setCancelNow(isCancel);
    if (live.current === 'recording') haptics.crossCancel();
  };
  const lockCrossed = () => {
    if (live.current === 'recording') lock();
    else if (live.current === 'starting' || live.current === 'pending') lockWanted.current = true;
  };

  // The gesture is built once; it calls the latest handlers through this box.
  const box = useRef({ press, release, crossed, lockCrossed, interrupted });
  box.current = { press, release, crossed, lockCrossed, interrupted };
  const jsPress = useCallback(() => box.current.press(), []);
  const jsRelease = useCallback((ok: boolean) => box.current.release(ok), []);
  const jsCross = useCallback((c: boolean) => box.current.crossed(c), []);
  const jsLock = useCallback(() => box.current.lockCrossed(), []);

  const showMic = !hasText || phase !== 'idle';
  const gestureOn = Boolean(onFile) && showMic && !disabled && !busy && phase !== 'sending' && phase !== 'discarding' && phase !== 'stopped';
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .withTestId(`${id}-mic`)
        .enabled(gestureOn)
        .minDistance(0)
        .onBegin(() => {
          if (lockSv.value === 0) {
            tx.value = 0;
            ty.value = 0;
            cancelSv.value = 0;
          }
          held.value = withTiming(1, { duration: 120 });
          scheduleOnRN(jsPress);
        })
        .onUpdate((e) => {
          if (lockSv.value === 1) return;
          tx.value = e.translationX;
          ty.value = e.translationY;
          const c = e.translationX < -CANCEL_PX;
          if (c !== (cancelSv.value === 1)) {
            cancelSv.value = c ? 1 : 0;
            scheduleOnRN(jsCross, c);
          }
          if (e.translationY < -LOCK_PX && cancelSv.value === 0) {
            lockSv.value = 1;
            tx.value = withSpring(0);
            ty.value = withSpring(0);
            scheduleOnRN(jsLock);
          }
        })
        .onFinalize((_e, success) => {
          held.value = withTiming(0, { duration: 120 });
          tx.value = withSpring(0);
          ty.value = withSpring(0);
          scheduleOnRN(jsRelease, success);
        }),
    [id, gestureOn, tx, ty, held, cancelSv, lockSv, jsPress, jsRelease, jsCross, jsLock],
  );

  // Leaving the app (call, home button) stops the note and sends nothing. Leaving the screen does the same.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') box.current.interrupted();
    });
    return () => {
      sub.remove();
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (live.current === 'recording' || live.current === 'starting') void cancelRecording();
      if (tipTimer.current) clearTimeout(tipTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const controlSize = compact ? 44 : BTN;
  const off = disabled || busy;
  const smooth = useDerivedValue(() => withTiming(cancelSv.value, { duration: 150 }));
  const railStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(smooth.value, [0, 1], [colors.card, colors.badSoft]),
    borderColor: interpolateColor(smooth.value, [0, 1], [colors.border, colors.danger]),
  }));
  const btnStyle = useAnimatedStyle(() => {
    const free = lockSv.value === 0 ? 1 : 0;
    // Bin drop: fly start-ward along an arc (up, then down) into the bin, shrinking, then fade.
    const f = seg(bin.value, FLY_FROM, FLY_TO);
    const fx = Easing.inOut(Easing.quad)(f);
    const arc = f * (1 - f) * 4;
    const dx = -(railW.value + spacing.sm + controlSize / 2 - spacing.md - 14) * fx;
    const dy = -30 * arc;
    return {
      opacity: (off ? 0.6 : 1) * (1 - seg(bin.value, 360, FLY_TO)),
      transform: [
        { translateX: clamp(tx.value, -220, 0) * free + dx },
        { translateY: clamp(ty.value, -LOCK_PX * 1.4, 0) * free + dy - 6 * fx },
        { scale: (1 + 0.45 * held.value * free) * (1 - 0.65 * fx) },
      ],
    };
  });
  const dotStyle = useAnimatedStyle(() => ({ opacity: blink.value }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : shimmer.value * interpolate(tx.value, [0, -CANCEL_PX], [1, 0.3], Extrapolation.CLAMP),
    transform: [{ translateX: reduced ? 0 : interpolate(shimmer.value, [0.35, 1], [-6, 0], Extrapolation.CLAMP) }],
  }));
  const lockPill = useAnimatedStyle(() => {
    const p = clamp(-ty.value / LOCK_PX, 0, 1);
    return {
      opacity: held.value * (lockSv.value === 1 ? 0 : 1),
      transform: [{ translateY: -p * 20 }, { scale: 1 + 0.15 * p }],
    };
  });

  const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const heldNote = phase === 'locked' || phase === 'stopped';
  const sendIcon = hasText || heldNote;
  const showSend = (hasText && phase === 'idle') || heldNote;

  const actions =
    phase === 'idle' && !hasText
      ? [{ name: 'activate', label: t(lang, 'voiceStart') }]
      : inNote || phase === 'stopped'
        ? [{ name: 'activate', label: t(lang, 'voiceSend') }, { name: 'discard', label: t(lang, 'voiceDiscard') }]
        : undefined;
  const onAction = (name: string) => {
    if (name === 'discard') discard(true);
    else if (phaseRef.current === 'idle') {
      if (hasText) onSubmit?.();
      else {
        lockWanted.current = true; // screen readers cannot hold: start hands-free
        void press();
      }
    } else if (phaseRef.current === 'locked' || phaseRef.current === 'stopped') void send();
  };

  const pillHeight = { minHeight: controlSize };
  const control = { width: controlSize, height: controlSize };
  const rowDir = { flexDirection: I18nManager.isRTL ? ('row-reverse' as const) : ('row' as const) };
  const iconColor = colors.onPrimary;

  const rail = (
    <Animated.View testID={`${id}-rail`} onLayout={(e) => { railW.value = e.nativeEvent.layout.width; }} style={[styles.pill, pillHeight, rowDir, styles.rail, railStyle]}>
      {phase === 'discarding' ? (
        <DiscardBin t={bin} color={colors.danger} soft={colors.badSoft} />
      ) : (
        <>
          {heldNote ? (
            <Pressable testID={`${id}-bin`} accessibilityRole="button" accessibilityLabel={t(lang, 'voiceDiscard')} hitSlop={8} onPress={() => discard(true)} style={styles.binBtn}>
              <Icon name="trash" color={colors.danger} size={22} />
            </Pressable>
          ) : null}
          <Animated.View style={[styles.dot, { backgroundColor: colors.danger }, dotStyle]} />
          <Text testID={`${id}-timer`} style={[styles.timer, { color: colors.text }]}>{mm}</Text>
          {phase === 'recording' ? (
            <Animated.View style={[styles.hint, rowDir, hintStyle]}>
              <View style={styles.arrow}><Icon name="back" color={cancelNow ? colors.danger : colors.muted} size={16} /></View>
              <Text style={{ color: cancelNow ? colors.danger : colors.muted }}>{t(lang, cancelNow ? 'releaseToCancel' : 'voiceSlideCancel')}</Text>
            </Animated.View>
          ) : null}
        </>
      )}
    </Animated.View>
  );

  const field = textMode ? (
    <View style={[styles.inputWrap, { flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }]}>
      <TextInput
        testID={`${id}-input`}
        style={[
          styles.pill,
          multiline ? { minHeight: compact ? 44 : BTN, maxHeight: maxInputHeight, paddingVertical: 10 } : pillHeight,
          styles.input,
          compact && (multiline ? { fontSize: 14 } : styles.compactInput),
          { color: colors.text, borderColor: 'transparent', backgroundColor: 'transparent', textAlign: lang === 'ar' ? 'right' : 'left', writingDirection: lang === 'ar' ? 'rtl' : 'ltr' },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        submitBehavior={multiline ? 'submit' : undefined}
        onSubmitEditing={onSubmit}
        multiline={multiline}
      />
      {value && value.length > 0 ? (
        <Pressable
          testID={`${id}-clear`}
          accessibilityRole="button"
          accessibilityLabel={lang === 'ar' ? 'مسح النص' : 'Clear text'}
          hitSlop={10}
          onPress={() => onChangeText?.('')}
          style={styles.clearBtn}
        >
          <View style={[styles.clearCircle, { backgroundColor: colors.border }]}>
            <Icon name="cross" size={12} color={colors.text} />
          </View>
        </Pressable>
      ) : null}
    </View>
  ) : (
    <View style={[styles.pill, pillHeight, styles.input, { borderColor: colors.border, backgroundColor: colors.card, justifyContent: 'center' }]}>
      <Text style={{ color: colors.muted, textAlign: lang === 'ar' ? 'right' : 'left' }}>{label}</Text>
    </View>
  );

  const showLeading = phase === 'idle' && (!hideLeadingWhenTyping || (!hasText && !busy));
  return (
    <View style={[styles.row, rowDir]}>
      {showLeading ? leadingAccessory : null}
      {phase === 'idle' ? accessory : null}
      {phase === 'idle' || phase === 'sending' ? field : rail}
      <View style={control}>
        {tip ? (
          <View testID={`${id}-hint`} style={[styles.tip, { backgroundColor: colors.inverse }]}>
            <Text style={{ color: colors.onInverse }}>{t(lang, 'voiceQuickHint')}</Text>
          </View>
        ) : null}
        <Animated.View pointerEvents="none" style={[styles.lockPill, { backgroundColor: colors.card, borderColor: colors.border }, lockPill]}>
          <Icon name="lock" color={colors.muted} size={16} />
          <View style={styles.up}><Icon name="back" color={colors.muted} size={14} /></View>
        </Animated.View>
        {onFile || showSend ? <GestureDetector gesture={pan}>
          <Animated.View
            testID={`${id}-mic`}
            accessible
            accessibilityRole="button"
            accessibilityLabel={sendIcon ? t(lang, hasText && phase === 'idle' ? 'sendBtn' : 'voiceSend') : label}
            accessibilityHint={sendIcon ? undefined : t(lang, 'holdToTalk')}
            accessibilityState={{ busy: phase === 'sending' || busy, disabled: off }}
            accessibilityActions={actions}
            onAccessibilityAction={(e) => onAction(e.nativeEvent.actionName)}
            style={[styles.btn, control, { borderRadius: controlSize / 2 }, greenGradient, { opacity: off ? 0.6 : 1 }, btnStyle]}
          >
            {actionDecoration}
            {phase === 'sending' || busy ? (
              <ActivityIndicator testID="button-spinner" color={colors.onPrimary} />
            ) : (
              <Icon name={sendIcon ? 'send' : 'mic'} color={iconColor} size={22} />
            )}
          </Animated.View>
        </GestureDetector> : null}
        {showSend ? (
          <Pressable
            testID={`${id}-go`}
            accessibilityRole="button"
            accessibilityLabel={t(lang, heldNote ? 'voiceSend' : 'sendBtn')}
            disabled={off}
            onPress={() => (heldNote ? void send() : onSubmit?.())}
            style={styles.overlay}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: spacing.sm },
  inputWrap: { flex: 1, alignItems: 'center' },
  clearBtn: { justifyContent: 'center', paddingHorizontal: 10 },
  clearCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pill: { borderWidth: 1, borderRadius: radius.lg * 2, flex: 1 },
  input: { margin: 0, paddingHorizontal: spacing.lg, fontSize: 16 },
  rail: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  compactInput: { height: 44, paddingVertical: 0, fontSize: 14 },
  btn: { alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: BTN / 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  timer: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  up: { transform: [{ rotate: '-90deg' }] },
  arrow: { transform: [{ rotate: '180deg' }] },
  binBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  tip: { position: 'absolute', bottom: BTN + spacing.sm, right: 0, maxWidth: 240, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  lockPill: { position: 'absolute', bottom: BTN + spacing.sm, right: 4, width: 40, height: 64, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'space-evenly' },
});
