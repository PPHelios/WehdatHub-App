import React from 'react';
import { View } from 'react-native';
import { AppText as Text } from './AppText';
import { radius, spacing, useTheme } from '../theme';

/** One line of a stats card: the label on one side, the value on the other, and an optional thin bar (0 to 100) under them. */
export function StatRow({ label, value, pct, testID }: { label: string; value: string; pct?: number; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ gap: 4, paddingVertical: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <Text numberOfLines={1} style={{ color: colors.text, flexShrink: 1 }}>{label}</Text>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{value}</Text>
      </View>
      {pct != null ? (
        <View style={{ height: 6, borderRadius: radius.sm / 2, backgroundColor: colors.border }}>
          <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 6, borderRadius: radius.sm / 2, backgroundColor: colors.primary }} />
        </View>
      ) : null}
    </View>
  );
}
