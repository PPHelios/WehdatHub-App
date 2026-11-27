import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { AssistantCard } from '@wehdathub/shared';
import { spacing, useTheme } from '../../theme';
import { AppText as Text } from '../AppText';
import { ChartFrame } from './ChartFrame';

type Card = Extract<AssistantCard, { kind: 'compare' }>;

/** 2 or 3 units side by side; the best value in a row shows in the ok colour. */
export function Compare({ card, onNavigate }: { card: Card; onNavigate?: (s: string, p?: Record<string, unknown>) => void }) {
  const { colors } = useTheme();
  return (
    <ChartFrame testID="card-compare" title={card.title} summary={card.summary} link={card.link} onNavigate={onNavigate}>
      <View style={styles.row}>
        <View style={styles.labelCol} />
        {card.columns.map((c) => <Text key={c.code} numberOfLines={1} style={[styles.cell, styles.head, { color: colors.text }]}>{c.code}</Text>)}
      </View>
      {card.rows.map((r) => (
        <View key={r.key} style={[styles.row, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <Text style={[styles.labelCol, { color: colors.muted, fontSize: 12 }]}>{r.label}</Text>
          {r.values.map((v, i) => (
            <Text key={i} testID={r.best === i ? `compare-best-${r.key}` : undefined} style={[styles.cell, { color: r.best === i ? colors.okInk : colors.text, fontWeight: r.best === i ? '700' : '400' }]}>{v ?? '—'}</Text>
          ))}
        </View>
      ))}
    </ChartFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.xs },
  labelCol: { width: 76 },
  cell: { flex: 1, fontSize: 13, textAlign: 'center', fontVariant: ['tabular-nums'] },
  head: { fontWeight: '700' },
});
