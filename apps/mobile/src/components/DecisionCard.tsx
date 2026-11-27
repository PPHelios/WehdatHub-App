import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { enter } from '../motion';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { sx } from '../sharedStyles';

export type DecisionUrgency = 'high' | 'medium' | 'low';
interface Action { label: string; onPress: () => void; testID?: string }

/** One thing that needs a decision: urgency dot + label, title, one-line why and up to two buttons. Low urgency is a compact row. */
export function DecisionCard({ testID, urgency, label, value, title, why, icon, primary, secondary, extra, index = 0 }: {
  testID: string; urgency: DecisionUrgency; label: string; value?: string; title: string; why?: string; icon: IconName;
  primary: Action; secondary?: Action; extra?: React.ReactNode; index?: number;
}) {
  const { colors } = useTheme();
  const dot = urgency === 'high' ? colors.danger : urgency === 'medium' ? colors.warn : colors.muted;
  const button = (a: Action, main: boolean) => (
    <PressableScale testID={a.testID} onPress={a.onPress} accessibilityLabel={`${a.label}: ${title}`}
      style={[styles.btn, main ? { backgroundColor: colors.primary } : [{ borderColor: colors.border }, sx.borderWidth1]]}>
      <Text variant="bodySm" weight="bold" style={{ color: main ? colors.onPrimary : colors.primaryInk }}>{a.label}</Text>
    </PressableScale>
  );
  if (urgency === 'low') {
    return (
      <Animated.View entering={enter(index)}>
        <Card testID={`${testID}-card`} style={styles.compact}>
          <View style={[styles.tile, { backgroundColor: colors.primarySoft }]}><Icon name={icon} size={18} color={colors.primaryInk} /></View>
          <View style={styles.copy}>
            <Text variant="bodySm" weight="bold" style={{ color: colors.text }}>{title}</Text>
            {why ? <Text variant="caption" style={{ color: colors.muted }}>{why}</Text> : null}
          </View>
          {button({ ...primary, testID: primary.testID ?? testID }, false)}
        </Card>
      </Animated.View>
    );
  }
  return (
    <Animated.View entering={enter(index)}>
      <Card variant="elevated" testID={`${testID}-card`} style={styles.card}>
        <View style={styles.meta}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <Text variant="caption" weight="bold" style={[styles.label, { color: colors.muted }]}>{label}</Text>
          {value ? <Text variant="caption" weight="bold" style={{ color: urgency === 'high' ? colors.danger : colors.muted }}>{value}</Text> : null}
        </View>
        <Text variant="body" weight="bold" style={{ color: colors.text }}>{title}</Text>
        {why ? <Text variant="bodySm" style={{ color: colors.muted }}>{why}</Text> : null}
        <View style={styles.actions}>
          {button({ ...primary, testID: primary.testID ?? testID }, true)}
          {secondary ? button(secondary, false) : null}
          {extra}
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  compact: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  tile: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  btn: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
