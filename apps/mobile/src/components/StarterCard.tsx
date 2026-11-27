import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { AppText as Text } from './AppText';
import { toast } from './Toast';
import { track } from '../analytics';
import { useAuth } from '../auth';
import { t, type StringKey } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

export type OnboardingStatus = {
  hasUnit: boolean;
  hasSharedLink: boolean;
  telegramConnected: boolean;
  hasAsked?: boolean;
};

type Props = {
  onboarding: OnboardingStatus;
  onAddUnit: () => void;
  /** Opens the units list (used when the broker already has units). */
  onShareSample: () => void;
  onConnectTelegram: () => void;
  onAsk?: () => void;
  onAddPhotos?: () => void;
  onDismiss: () => void;
};

type StepId = 'add' | 'share' | 'telegram' | 'ask' | 'photos';

/** One dismiss flag per broker, so a second broker on the same phone still sees the card. */
export const starterDismissKey = (brokerId?: string) => `wehdathub.starterDismissed:${brokerId ?? ''}`;

/** The steps for a role, in order. */
export function starterSteps(role?: string): StepId[] {
  if (role === 'data_entry') return ['add', 'photos'];
  if (role === 'owner' || role === 'manager' || role === 'admin') return ['add', 'share', 'telegram'];
  return ['telegram', 'ask', 'share'];
}

const LABEL: Record<StepId, StringKey> = { add: 'starterStep1', share: 'starterStepShare', telegram: 'starterStep3', ask: 'starterStepAsk', photos: 'starterStepPhotos' };

/** Hides the card for this broker once dismissed; reads the saved flag first (hidden until it is known). */
export function useStarterDismissed(brokerId?: string): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(starterDismissKey(brokerId)).then((v) => setDismissed(v === '1')).catch(() => setDismissed(false));
  }, [brokerId]);
  return [dismissed, () => { setDismissed(true); void AsyncStorage.setItem(starterDismissKey(brokerId), '1').catch(() => undefined); }];
}

export function StarterCard({ onboarding, onAddUnit, onShareSample, onConnectTelegram, onAsk, onAddPhotos, onDismiss }: Props) {
  const { colors } = useTheme();
  const broker = useAuth((s) => s.broker);
  const lang = broker?.lang ?? 'ar';
  const scale = useSharedValue(1);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const [finished, setFinished] = useState(false);

  const doneOf = (id: StepId) => id === 'add' ? onboarding.hasUnit
    : id === 'share' ? onboarding.hasSharedLink
      : id === 'telegram' ? onboarding.telegramConnected
        : id === 'ask' ? Boolean(onboarding.hasAsked)
          : false; // shortcut: no server flag for photos yet, so that step never ticks by itself
  const press = (id: StepId) => id === 'add' ? onAddUnit
    : id === 'share' ? (onboarding.hasUnit ? onShareSample : onAddUnit)
      : id === 'telegram' ? onConnectTelegram
        : id === 'ask' ? (onAsk ?? (() => undefined))
          : (onAddPhotos ?? onShareSample);
  const ids = starterSteps(broker?.role);
  const allDone = ids.every(doneOf);

  const before = useRef<Set<StepId> | null>(null);
  useEffect(() => {
    const now = new Set(ids.filter(doneOf));
    // The first render only records what was already done; later ticks are steps finished now.
    if (before.current) now.forEach((id) => { if (!before.current!.has(id)) void track('starter_step_done', { step: id }); });
    before.current = now;
  });

  const openedDone = useRef(allDone);
  useEffect(() => {
    if (!allDone || openedDone.current) return;
    toast(t(lang, 'starterAllDone'));
    scale.value = withSequence(withTiming(1.06, { duration: 160 }), withTiming(1, { duration: 160 }));
    const h = setTimeout(() => setFinished(true), 900);
    return () => clearTimeout(h);
  }, [allDone, lang, scale]);

  if (finished || openedDone.current) return null;

  return (
    <Animated.View testID="starter-card" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, pop]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{t(lang, 'starterTitle')}</Text>
        <Pressable testID="starter-dismiss" onPress={onDismiss} hitSlop={8}>
          <Text style={[styles.dismiss, { color: colors.muted }]}>{t(lang, 'starterDismiss')}</Text>
        </Pressable>
      </View>
      <View style={styles.list}>
        {ids.map((id, i) => {
          const done = doneOf(id);
          return (
            <Pressable key={id} testID={`starter-step-${i + 1}`} onPress={press(id)} style={[styles.row, { borderColor: colors.border }]}>
              <Text style={[styles.check, { color: done ? colors.primary : colors.muted }]}>{done ? '✓' : '○'}</Text>
              <Text style={[styles.stepText, { color: done ? colors.muted : colors.text, textDecorationLine: done ? 'line-through' : 'none' }]}>
                {t(lang, LABEL[id])}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  dismiss: { fontSize: 13 },
  list: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
  check: { fontSize: 16, fontWeight: '700', width: 20, textAlign: 'center' },
  stepText: { flex: 1, fontSize: 14 },
});
