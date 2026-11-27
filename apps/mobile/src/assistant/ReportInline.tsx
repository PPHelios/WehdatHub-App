import React from 'react';
import { StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { LeadStage, Lang } from '@wehdathub/shared';
import { api } from '../api';
import { errorText } from '../errors';
import { t } from '../i18n';
import { spacing, useTheme } from '../theme';
import { AppText as Text } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorView, Loading } from '../components/StateViews';
import { StatRow } from '../components/StatRow';
import type { ReportSpec } from './thread';

const STAGES: LeadStage[] = ['new', 'contacted', 'interested', 'viewing', 'negotiation', 'won', 'lost'];

/** A short version of a report, shown inside the chat. The full screen opens from the button. */
export function ReportInline({ report, lang, onOpenFull }: { report: ReportSpec; lang: Lang; onOpenFull: () => void }) {
  const { colors } = useTheme();
  const number = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG');
  const period = report.dealLastMonth ? 'last' : 'recent';
  const filters = report.leadFilters;
  const deals = useQuery({ queryKey: ['chat-deals', period], queryFn: () => api.dealReport(period), enabled: report.kind === 'deals' });
  // A named broker needs the team list to resolve, so those counts are left to the full report.
  const leadsOn = report.kind === 'leads' && !report.assignee;
  const leads = useQuery({ queryKey: ['chat-lead-counts', filters?.lookup ?? '', filters?.queue ?? ''], queryFn: () => api.leadCounts(filters?.lookup, undefined, undefined, filters?.queue), enabled: leadsOn });
  const board = useQuery({ queryKey: ['dashboard', '30', '', '', ''], queryFn: () => api.dashboard(30), enabled: report.kind === 'dashboard' || report.kind === 'ranking' });
  const q = report.kind === 'deals' ? deals : report.kind === 'leads' ? leads : board;
  const active = report.kind !== 'leads' || leadsOn;
  const weeks = deals.data?.summary?.weeks ?? [];
  const stages = leads.data?.counts;
  const d = board.data;
  const rows: { label: string; value: number }[] = [];
  if (report.kind === 'deals') weeks.forEach((n, i) => rows.push({ label: `${t(lang, 'ixWeek')} ${number.format(i + 1)}`, value: n }));
  else if (report.kind === 'leads' && stages) STAGES.forEach((s) => rows.push({ label: t(lang, `st_${s}`), value: stages[s] ?? 0 }));
  else if (report.kind === 'ranking' && d) [...d.board].sort((a, b) => (b.deals ?? 0) - (a.deals ?? 0)).slice(0, 3).forEach((r) => rows.push({ label: r.name, value: r.deals ?? 0 }));
  else if (report.kind === 'dashboard' && d) rows.push(
    { label: t(lang, 'ixNewLeads'), value: d.leads }, { label: t(lang, 'ixDealsCap'), value: d.deals.n },
    { label: t(lang, 'ixNotContacted'), value: d.uncontacted }, { label: t(lang, 'ixOverdueFu'), value: d.overdue },
  );
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card testID="report-inline" style={styles.card}>
      {active && q.isPending ? <Loading label={t(lang, 'loading')} /> : null}
      {active && q.isError ? <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => q.refetch()} /> : null}
      {report.kind === 'deals' && weeks.length ? <Text variant="display" style={{ color: colors.text }}>{number.format(weeks.reduce((a, b) => a + b, 0))}</Text> : null}
      {rows.map((r) => <StatRow key={r.label} label={r.label} value={number.format(r.value)} pct={r.value / max * 100} />)}
      <Button testID="report-open-full" variant="secondary" label={t(lang, 'openFullReport')} onPress={onOpenFull} />
    </Card>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing.sm } });
