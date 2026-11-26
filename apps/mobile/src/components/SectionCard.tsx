import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { currentLang } from '../auth';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Chevron } from './Icon';

export type BadgeTone = 'critical' | 'warn' | 'ok' | 'neutral';

/** Shared card container used across Home, Assistant answers, and Dashboard screens. */
export function SectionCard({ title, subtitle, action, children, testID }: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  testID?: string;
}) {
  const { colors, elev } = useTheme();
  return (
    <View testID={testID} style={[styles.card, elev('md'), { backgroundColor: colors.card, borderColor: colors.border }]}>
      {title || subtitle || action ? (
        <View style={styles.head}>
          <View style={styles.headCopy}>
            {title ? <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
            {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Soft high-contrast status badge for urgency counts and labels. */
export function UrgencyBadge({ label, tone = 'neutral', testID }: { label: string; tone?: BadgeTone; testID?: string }) {
  const { colors } = useTheme();
  const palette = {
    critical: { bg: colors.badSoft, ink: colors.badInk },
    warn: { bg: colors.warnSoft, ink: colors.warnInk },
    ok: { bg: colors.okSoft, ink: colors.okInk },
    neutral: { bg: colors.cardSubtle, ink: colors.muted },
  }[tone];
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.ink }]}>{label}</Text>
    </View>
  );
}

/** Compact metric tile with tabular numerals and optional tap-through. */
export function KpiTile({ label, value, hint, tone = 'neutral', onPress, testID }: {
  label: string;
  value: string;
  hint?: string;
  tone?: BadgeTone;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const rtl = currentLang() === 'ar';
  const accent = {
    critical: colors.badInk,
    warn: colors.warnInk,
    ok: colors.okInk,
    neutral: colors.text,
  }[tone];
  const body = (
    <>
      <View style={styles.kpiTop}>
        <Text numberOfLines={2} style={[styles.kpiLabel, { color: colors.muted }]}>{label}</Text>
        {onPress ? <Chevron rtl={rtl} color={colors.muted} /> : null}
      </View>
      <Text style={[styles.kpiValue, { color: accent }]}>{value}</Text>
      {hint ? <Text numberOfLines={2} style={[styles.kpiHint, { color: colors.muted }]}>{hint}</Text> : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.kpi, { backgroundColor: colors.cardSubtle, borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}>
        {body}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.kpi, { backgroundColor: colors.cardSubtle, borderColor: colors.border }]}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  headCopy: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12 },
  badge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  kpi: { flex: 1, minWidth: '45%', borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  kpiTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.xs },
  kpiLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
  kpiValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  kpiHint: { fontSize: 12 },
});
