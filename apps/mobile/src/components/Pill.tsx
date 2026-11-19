import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { spacing, useTheme } from '../theme';

type Tone = 'primary' | 'accent' | 'neutral';

/**
 * The one small label of the app: a status on a photo, a fact under a title. `solid` pills sit on photos (the text colour made for the fill: readable in light and dark);
 * the others are quiet outlines. Unit cards and project cards use only this, so they read as one design.
 */
export function Pill({ label, tone = 'neutral', solid = false, testID }: { label: string; tone?: Tone; solid?: boolean; testID?: string }) {
  const { colors } = useTheme();
  const main = tone === 'primary' ? colors.primary : tone === 'accent' ? colors.accent : colors.muted;
  return (
    <View testID={testID} style={[styles.pill, solid ? { backgroundColor: main, borderColor: main } : { backgroundColor: tone === 'primary' ? colors.primarySoft : tone === 'neutral' ? colors.bg : `${main}1F`, borderColor: tone === 'neutral' ? colors.border : `${main}55` }]}>
      <Text style={[styles.text, { color: solid ? (tone === 'accent' ? colors.onAccent : colors.onPrimary) : tone === 'neutral' ? colors.text : tone === 'primary' ? colors.primaryInk : main }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 3, alignSelf: 'flex-start' },
  text: { fontSize: 13, fontWeight: '700' },
});
