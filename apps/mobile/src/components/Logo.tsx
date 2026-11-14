import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { currentLang } from '../auth';
import { useTheme } from '../theme';

/** The five rising bars of the brand mark (the middle one azure), as in the brand guide. */
function Mark({ height }: { height: number }) {
  const { colors } = useTheme();
  const c = colors.accent;
  return (
    <Svg width={(height * 154) / 160} height={height} viewBox="0 0 154 160" testID="logo-mark">
      <Polygon points="10,20 32,55 32,150 10,150" fill={c} />
      <Polygon points="38,95 60,70 60,150 38,150" fill={c} />
      <Polygon points="66,62 88,35 88,150 66,150" fill={colors.primary} />
      <Polygon points="94,70 116,95 116,150 94,150" fill={c} />
      <Polygon points="122,55 144,20 144,150 122,150" fill={c} />
    </Svg>
  );
}

/**
 * The WehdatHub logo from the brand guide: the mark with the name. English reads "WehdatHub" (Hub in azure) with the mark first;
 * Arabic reads "وحدات هب" with the mark on the right. The row flips with the layout direction, so one order serves both.
 */
export function Logo({ size = 1, compact = false }: { size?: number; compact?: boolean }) {
  const { colors } = useTheme();
  const ar = currentLang() === 'ar';
  const fontSize = 34 * size;
  return (
    <View style={[styles.wrap, compact ? styles.compact : styles.stacked]} accessibilityRole="image" accessibilityLabel="WehdatHub" testID="logo">
      <Mark height={(compact ? 72 : 72) * size} />
      {ar ? (
        <Text style={[styles.word, { color: colors.text, fontSize }]}>وحدات هب</Text>
      ) : (
        <Text style={[styles.word, { color: colors.text, fontSize }]}>
          Wehdat <Text style={{ color: colors.primary }}>Hub</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  stacked: { gap: 12 },
  compact: { flexDirection: 'row', gap: 8 },
  word: { fontWeight: '800', textAlign: 'center' },
});
