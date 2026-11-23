import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { greenGradient, softGreenGradient, spacing, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = Pick<PressableProps, 'accessibilityLabel' | 'disabled' | 'onLayout' | 'onPress' | 'testID'> & {
  label: string;
  selected?: boolean;
  softSelection?: boolean;
  highlightBehind?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Chip({ label, selected, softSelection, highlightBehind, style, textStyle, onPress, disabled, ...props }: Props) {
  const { colors, scheme } = useTheme();
  const strong = selected && !softSelection;
  const unselected = selected === false;
  const fill = strong ? greenGradient
    : unselected ? { backgroundColor: colors.cardSubtle }
    : selected ? { backgroundColor: colors.primarySoft }
    : softGreenGradient[scheme];
  const borderColor = strong ? colors.primary : unselected ? colors.border : colors.primaryLine;
  const ink = strong ? colors.onPrimary : unselected ? colors.muted : colors.primaryInk;
  const surface = [styles.chip, { borderColor }, !highlightBehind && fill, disabled && styles.disabled, style];
  const text = <AppText style={[styles.label, { color: ink }, textStyle]}>{label}</AppText>;
  return onPress ? (
    <Pressable {...props} accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={surface}>
      {text}
    </Pressable>
  ) : <View {...props} style={surface}>{text}</View>;
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: 999, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  label: { fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
