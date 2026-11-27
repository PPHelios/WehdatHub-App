import React from 'react';
import { StyleSheet, View } from 'react-native';
import { formatEgp, type AssistantCard } from '@wehdathub/shared';
import { spacing } from '../../theme';
import { KpiTile } from '../SectionCard';
import { ChartFrame } from './ChartFrame';

type Card = Extract<AssistantCard, { kind: 'metric_row' }>;

/** KPI tiles; a tile shows an up or down delta against the previous period when the server sent one. */
export function MetricRow({ card, num, onNavigate }: { card: Card; num: (n: number) => string; onNavigate?: (s: string, p?: Record<string, unknown>) => void }) {
  return (
    <ChartFrame testID="card-metric-row" summary={card.summary} link={card.link} onNavigate={onNavigate}>
      <View style={styles.grid}>
        {(card.items ?? []).map((item, i) => {
          const val = typeof item.value === 'number' ? (item.unit === 'EGP' ? formatEgp(item.value) : num(item.value)) : String(item.value);
          const d = typeof item.delta === 'number' && item.delta !== 0 ? item.delta : null;
          return (
            <KpiTile
              key={`${item.label}-${i}`}
              label={item.label}
              value={val}
              hint={d == null ? undefined : `${d > 0 ? '▲' : '▼'} ${num(Math.abs(d))}`}
              tone={d != null ? ((item.deltaGood ?? d > 0) ? 'ok' : 'critical') : (item.tone ?? 'neutral')}
            />
          );
        })}
      </View>
    </ChartFrame>
  );
}

const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm } });
