import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentLang } from '../auth';
import { t } from '../i18n';
import { spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Chevron } from './Icon';

interface Props {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onBack?: () => void;
  /** Add the status-bar inset on top. */
  safeTop?: boolean;
}

export function ScreenHeader({ title, subtitle, left, right, onBack, safeTop }: Props) {
  const { colors } = useTheme();
  const top = useSafeAreaInsets().top;
  const rtl = currentLang() === 'ar';
  return (
    <View style={[styles.row, { paddingTop: spacing.sm + (safeTop ? top : 0) }]}>
      {onBack ? (
        <Pressable testID="header-back" accessibilityRole="button" accessibilityLabel={t(currentLang(), 'back')} hitSlop={8} onPress={onBack} style={styles.back}>
          {/* Chevron points forward; flip it to point back. */}
          <Chevron rtl={!rtl} color={colors.text} />
        </Pressable>
      ) : null}
      {left}
      <View style={styles.copy}>
        <Text variant="title" accessibilityRole="header" style={{ color: colors.text }}>{title}</Text>
        {subtitle ? <Text variant="caption" style={{ color: colors.muted }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
});
