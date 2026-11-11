import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

const HEIGHTS = [24, 36, 48, 60, 72];

/** The WehdatHub mark (five rising bars, the middle one azure) with the wordmark, drawn from plain views so it needs no image or SVG library. */
export function Logo({ size = 1, compact = false }: { size?: number; compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, compact && styles.compact]} accessibilityRole="image" accessibilityLabel="WehdatHub" testID="logo">
      <View style={[styles.bars, { height: 72 * size }]}>
        {HEIGHTS.map((h, i) => (
          <View key={h} style={{ width: 10 * size, height: h * size, borderRadius: 3 * size, backgroundColor: i === 2 ? colors.primary : colors.accent }} />
        ))}
      </View>
      <Text style={[styles.word, { color: colors.text, fontSize: 34 * size }]}>
        Wehdat<Text style={{ color: colors.primary }}>Hub</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12 },
  compact: { flexDirection: 'row', gap: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  word: { fontWeight: '800', textAlign: 'center' },
});
