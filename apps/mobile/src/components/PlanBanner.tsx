import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentLang } from '../auth';
import { bannerText, usePlanState } from '../planState';
import { planT } from '../planText';
import { spacing, useTheme } from '../theme';

/**
 * The line on the main screens once the plan period ended: grace (everything works), read-only, blocked, with the days left.
 * A manager can tap it to open the Plan page; a broker is told to ask the manager (no prices, no link).
 */
export function PlanBanner({ onOpenPlan, topInset = false }: { onOpenPlan?: () => void; topInset?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { phase, daysLeft, manager } = usePlanState();
  const lang = currentLang();
  const text = bannerText(lang, phase, daysLeft, manager);
  if (!text) return null;
  const hard = phase !== 'grace';
  const bg = hard ? colors.danger : colors.accent;
  const fg = hard ? colors.onDanger : colors.onAccent;
  const open = manager && onOpenPlan ? onOpenPlan : undefined;
  return (
    <Pressable testID={`plan-banner-${phase}`} accessibilityRole={open ? 'button' : 'alert'} disabled={!open} onPress={open} style={[styles.bar, { backgroundColor: bg, paddingTop: spacing.xs + (topInset ? insets.top : 0) }]}>
      <Text style={[styles.text, { color: fg }]}>{text}</Text>
      {open ? <Text style={[styles.cta, { color: fg }]}>{planT(lang, 'renewCta')}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs, gap: 2 },
  text: { fontSize: 13, fontWeight: '700' },
  cta: { fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
});
