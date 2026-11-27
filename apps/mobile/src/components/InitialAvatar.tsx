import React from 'react';
import { StyleSheet, View } from 'react-native';
import { greenGradient, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Icon } from './Icon';

export function InitialAvatar({ name, size = 44 }: { name: string | null; size?: number }) {
  const { colors } = useTheme();
  const initials = name?.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.avatar, greenGradient, { width: size, height: size, borderRadius: size / 2 }]}>
      {initials ? <Text style={[styles.initials, { color: colors.onPrimary, fontSize: Math.round(size * 0.32) }]} numberOfLines={1}>{initials}</Text> : <Icon name="leads" color={colors.onPrimary} size={Math.round(size * 0.45)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 14, fontWeight: '800' },
});
