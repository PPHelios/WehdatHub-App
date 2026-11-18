import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { currentLang } from '../auth';
import { useTheme } from '../theme';

/** The middle bar is cobalt blue in light and dark alike (same as the website mark). */
const MIDDLE = '#4B83D4';

/** The five rising bars of the brand mark (outer four satin gold, the middle one cobalt blue), as in the brand guide. */
function Mark({ height }: { height: number }) {
  const { colors } = useTheme();
  const c = colors.primary; // satin gold, both modes
  return (
    <Svg width={(height * 154) / 160} height={height} viewBox="0 0 154 160" testID="logo-mark">
      <Polygon points="10,20 32,55 32,150 10,150" fill={c} />
      <Polygon points="38,95 60,70 60,150 38,150" fill={c} />
      <Polygon points="66,62 88,35 88,150 66,150" fill={MIDDLE} />
      <Polygon points="94,70 116,95 116,150 94,150" fill={c} />
      <Polygon points="122,55 144,20 144,150 122,150" fill={c} />
    </Svg>
  );
}

/** The name in one language: "Wehdat Hub" (Hub in gold ink), or "وحدات هب". */
function Word({ ar, fontSize }: { ar: boolean; fontSize: number }) {
  const { colors } = useTheme();
  return ar ? (
    <Text style={[styles.word, { color: colors.text, fontSize }]} numberOfLines={1}>وحدات هب</Text>
  ) : (
    <Text style={[styles.word, { color: colors.text, fontSize }]} numberOfLines={1}>
      Wehdat <Text style={{ color: colors.primaryInk }}>Hub</Text>
    </Text>
  );
}

/** A screen header reserves about 80 points on each side of its title; the logo bar stays inside that, padding included. */
export const BAR_WIDTH = 64;

/**
 * The WehdatHub logo from the brand guide: the mark with the name. English reads "Wehdat Hub" (Hub in gold ink) with the mark first;
 * Arabic reads "وحدات هب" with the mark on the right. The row flips with the layout direction, so one order serves both.
 *  - default and compact: the name in the app language.
 *  - bar: for a screen header. A small mark with the name under it, at most BAR_WIDTH wide, so a long centred title never runs into it.
 *  - bilingual: for the splash screen. The mark with the name in English and in Arabic, whatever the app language.
 */
export function Logo({ size = 1, compact = false, bar = false, bilingual = false }: { size?: number; compact?: boolean; bar?: boolean; bilingual?: boolean }) {
  const ar = currentLang() === 'ar';
  const fontSize = 34 * size;
  if (bar) {
    return (
      <View style={styles.bar} accessibilityRole="image" accessibilityLabel="WehdatHub" testID="logo">
        <Mark height={22 * size} />
        <Word ar={ar} fontSize={10} />
      </View>
    );
  }
  if (bilingual) {
    return (
      <View style={[styles.wrap, styles.stacked]} accessibilityRole="image" accessibilityLabel="WehdatHub وحدات هب" testID="logo">
        <Mark height={72 * size} />
        <View style={styles.names}>
          <Word ar={false} fontSize={fontSize} />
          <Word ar fontSize={fontSize * 0.9} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.wrap, compact ? styles.compact : styles.stacked]} accessibilityRole="image" accessibilityLabel="WehdatHub" testID="logo">
      <Mark height={72 * size} />
      <Word ar={ar} fontSize={fontSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  stacked: { gap: 12 },
  compact: { flexDirection: 'row', gap: 8 },
  word: { fontWeight: '800', textAlign: 'center' },
  names: { alignItems: 'center', gap: 2 },
  bar: { alignItems: 'center', gap: 2, maxWidth: BAR_WIDTH },
});
