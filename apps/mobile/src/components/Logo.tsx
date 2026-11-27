import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import Svg, { Polygon } from 'react-native-svg';
import { brand, COLORS } from '@wehdathub/shared';
import type { Lang } from '@wehdathub/shared';
import { currentLang } from '../auth';
import { t } from '../i18n';
import { useTheme } from '../theme';

/** The five-bar mark: dark-green wings in both themes, on a soft-mint tile so it stays visible on dark. */
function Mark({ height }: { height: number }) {
  const { colors, scheme } = useTheme();
  const tile = height / 0.64; // 18% padding each side
  return (
    <View style={[{ width: tile, height: tile, borderRadius: tile * 0.26, backgroundColor: COLORS.light['brand-soft'] }, styles.tile]}>
      <Svg width={(height * 154) / 160} height={height} viewBox="0 0 154 160" testID="logo-mark">
        <Polygon points="10,20 32,55 32,150 10,150" fill={colors.primary} />
        <Polygon points="38,95 60,70 60,150 38,150" fill={colors.primary} />
        <Polygon points="66,62 88,35 88,150 66,150" fill={brand[scheme].gold} />
        <Polygon points="94,70 116,95 116,150 94,150" fill={colors.primary} />
        <Polygon points="122,55 144,20 144,150 122,150" fill={colors.primary} />
      </Svg>
    </View>
  );
}

/** The name in one language: "Wehdat" + a green "Hub" pill, or "وحدات" + "هب". */
function Word({ lang, fontSize }: { lang: Lang; fontSize: number }) {
  const { colors, scheme } = useTheme();
  const s = fontSize / 34;
  const text = [styles.word, { fontSize }];
  return (
    <View style={styles.wordRow}>
      <Text style={[...text, { color: colors.text }]} numberOfLines={1}>{t(lang, 'brandWord')}</Text>
      <View
        style={[
          styles.pill,
          { backgroundColor: COLORS.light.brand, borderRadius: 8 * s, paddingHorizontal: 6 * s },
          scheme === 'dark' && styles.pillDark,
        ]}
      >
        <Text style={[...text, { color: colors.onPrimary }]} numberOfLines={1}>{t(lang, 'brandPill')}</Text>
      </View>
    </View>
  );
}

/** A screen header reserves about 80 points on each side of its title; the logo bar stays inside that, padding included. */
export const BAR_WIDTH = 64;

/**
 * The WehdatHub logo from the brand guide: the mark with the name. English reads "WehdatHub" with the mark first;
 * Arabic reads "وحدات هب" with the mark on the right. The row flips with the layout direction, so one order serves both.
 *  - default and compact: the name in the app language.
 *  - bar: for a screen header. A small mark with the name under it, at most BAR_WIDTH wide, so a long centred title never runs into it.
 *  - bilingual: for the splash screen. The mark with the name in English and in Arabic, whatever the app language.
 */
export function Logo({ size = 1, compact = false, bar = false, bilingual = false }: { size?: number; compact?: boolean; bar?: boolean; bilingual?: boolean }) {
  const lang = currentLang();
  const fontSize = 34 * size;
  if (bar) {
    return (
      <View style={styles.bar} accessibilityRole="image" accessibilityLabel="WehdatHub" testID="logo">
        <Mark height={22 * size} />
        <Word lang={lang} fontSize={10} />
      </View>
    );
  }
  if (bilingual) {
    return (
      <View style={[styles.wrap, styles.stacked]} accessibilityRole="image" accessibilityLabel="WehdatHub وحدات هب" testID="logo">
        <Mark height={72 * size} />
        <View style={styles.names}>
          <Word lang="en" fontSize={fontSize} />
          <Word lang="ar" fontSize={fontSize * 0.9} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.wrap, compact ? styles.compact : styles.stacked]} accessibilityRole="image" accessibilityLabel="WehdatHub" testID="logo">
      <Mark height={72 * size} />
      <Word lang={lang} fontSize={fontSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  stacked: { gap: 12 },
  compact: { flexDirection: 'row', gap: 8 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  pill: { borderWidth: 0 },
  pillDark: { borderWidth: 1, borderColor: COLORS.dark['brand-line'] },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  word: { fontWeight: '800', textAlign: 'center' },
  names: { alignItems: 'center', gap: 2 },
  bar: { alignItems: 'center', gap: 2, maxWidth: BAR_WIDTH },
});
