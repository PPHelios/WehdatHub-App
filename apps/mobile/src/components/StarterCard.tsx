import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { useAuth } from '../auth';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

export type OnboardingStatus = {
  hasUnit: boolean;
  hasSharedLink: boolean;
  telegramConnected: boolean;
};

type Props = {
  onboarding: OnboardingStatus;
  onAddUnit: () => void;
  onShareSample: () => void;
  onConnectTelegram: () => void;
  onDismiss: () => void;
};

export function StarterCard({ onboarding, onAddUnit, onShareSample, onConnectTelegram, onDismiss }: Props) {
  const { colors } = useTheme();
  const lang = useAuth((s) => s.lang) ?? 'ar';
  const allDone = onboarding.hasUnit && onboarding.hasSharedLink && onboarding.telegramConnected;
  if (allDone) return null;

  const steps = [
    { id: 'starter-step-1', done: onboarding.hasUnit, label: t(lang, 'starterStep1'), onPress: onAddUnit },
    { id: 'starter-step-2', done: onboarding.hasSharedLink, label: t(lang, 'starterStep2'), onPress: onShareSample },
    { id: 'starter-step-3', done: onboarding.telegramConnected, label: t(lang, 'starterStep3'), onPress: onConnectTelegram },
  ];

  return (
    <View testID="starter-card" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{t(lang, 'starterTitle')}</Text>
        <Pressable testID="starter-dismiss" onPress={onDismiss} hitSlop={8}>
          <Text style={[styles.dismiss, { color: colors.muted }]}>{t(lang, 'starterDismiss')}</Text>
        </Pressable>
      </View>
      <View style={styles.list}>
        {steps.map((s) => (
          <Pressable
            key={s.id}
            testID={s.id}
            onPress={s.onPress}
            style={[styles.row, { borderColor: colors.border }]}
          >
            <Text style={[styles.check, { color: s.done ? colors.primary : colors.muted }]}>{s.done ? '✓' : '○'}</Text>
            <Text style={[styles.stepText, { color: s.done ? colors.muted : colors.text, textDecorationLine: s.done ? 'line-through' : 'none' }]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
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
