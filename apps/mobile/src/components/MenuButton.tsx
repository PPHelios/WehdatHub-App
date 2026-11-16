import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { currentLang } from '../auth';
import { t } from '../i18n';
import { useTheme } from '../theme';
import { Icon } from './Icon';

/** The menu button in the top bar: opens the grouped More list (the bottom bar has no More tab on the newer menu). */
export function MenuButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable testID="menu-button" accessibilityRole="button" accessibilityLabel={t(currentLang(), 'more')} hitSlop={8} onPress={onPress} style={styles.btn}>
      <Icon name="more" color={colors.text} size={24} />
    </Pressable>
  );
}

const styles = StyleSheet.create({ btn: { padding: 8 } });
