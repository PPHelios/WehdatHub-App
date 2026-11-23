import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { currentLang } from '../auth';
import { greenGradient, radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Chevron, Icon, type IconName } from './Icon';

export function HomeRow({ title, detail, value, icon, featured, urgent, onPress, expanded, testID, children }: {
  title: string; detail?: string | null; value?: string; icon?: IconName; featured?: boolean; urgent?: boolean;
  onPress?: () => void; expanded?: boolean; testID?: string; children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const ink = featured ? colors.onPrimary : colors.text;
  const detailInk = featured ? '#DDEFE9' : colors.muted;
  const content = <>
    {icon ? <View style={[styles.icon, { backgroundColor: featured ? '#FFFFFF20' : colors.primarySoft }]}>
      <Icon name={icon} size={18} color={featured ? colors.onPrimary : colors.primaryInk} />
    </View> : null}
    <View style={styles.copy}>
      <Text style={[styles.title, { color: ink }]}>{title}</Text>
      {detail ? <Text style={{ color: detailInk }}>{detail}</Text> : null}
    </View>
    {value ? <Text style={[styles.value, { color: featured ? colors.onPrimary : urgent ? colors.danger : colors.primaryInk }]}>{value}</Text> : null}
    {onPress ? <Chevron rtl={currentLang() === 'ar'} expanded={expanded} color={detailInk} /> : null}
  </>;
  return (
    <View style={[styles.card, { borderColor: featured ? colors.primary : colors.border, backgroundColor: colors.card }, featured && greenGradient]}>
      {onPress
        ? <Pressable testID={testID} accessibilityRole="button" accessibilityState={expanded === undefined ? undefined : { expanded }}
            onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>{content}</Pressable>
        : <View testID={testID} style={styles.row}>{content}</View>}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, padding: spacing.md },
  pressed: { opacity: 0.75 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700' },
  value: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  actions: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
