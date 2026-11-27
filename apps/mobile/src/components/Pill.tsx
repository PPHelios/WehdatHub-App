import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { Chip } from './Chip';
import { spacing, typeScale, useTheme } from '../theme';

type Tone = 'primary' | 'accent' | 'neutral';

/**
 * The one small label of the app: a status on a photo, a fact under a title. `solid` pills sit on photos (the text colour made for the fill: readable in light and dark);
 * the others are quiet outlines.
 */
export function Pill({ label, tone = 'neutral', solid = false, testID }: { label: string; tone?: Tone; solid?: boolean; testID?: string }) {
  const { colors } = useTheme();
  if (tone === 'primary') return <Chip label={label} testID={testID} selected={solid} style={styles.pill} textStyle={styles.text} />;
  const main = tone === 'accent' ? colors.accent : colors.muted;
  return (
    <View testID={testID} style={[styles.pill, solid ? { backgroundColor: main, borderColor: main } : { backgroundColor: tone === 'neutral' ? colors.bg : `${main}1F`, borderColor: tone === 'neutral' ? colors.border : `${main}55` }]}>
      <Text style={[styles.text, { color: solid ? (tone === 'accent' ? colors.onAccent : colors.onPrimary) : tone === 'neutral' ? colors.text : main }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 3, alignSelf: 'flex-start' },
  text: { fontSize: typeScale.bodySm.fontSize, fontWeight: '700' },
});
