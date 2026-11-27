import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { radius, spacing, useTheme } from '../theme';
import { PressableScale } from './PressableScale';

interface Props {
  variant?: 'plain' | 'elevated' | 'accent';
  /** Border tint for the accent variant. */
  accentColor?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  testID?: string;
}

export function Card({ variant = 'plain', accentColor, onPress, style, children, testID }: Props) {
  const { colors, elev } = useTheme();
  const s = [
    styles.card,
    variant !== 'plain' && elev('sm'),
    { backgroundColor: colors.card, borderColor: variant === 'accent' && accentColor ? accentColor : colors.border },
    style,
  ];
  return onPress ? (
    <PressableScale testID={testID} onPress={onPress} style={s}>{children}</PressableScale>
  ) : (
    <View testID={testID} style={s}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.lg },
});
