import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LEAD_STAGES } from '@wehdathub/shared';
import type { LeadTab } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Chips } from '../components/Chips';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { stageLabel, t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

const EXTRA: [LeadTab, 'tabDue' | 'tabOverdue' | 'tabNoStep'][] = [['due_today', 'tabDue'], ['overdue', 'tabOverdue'], ['no_next_step', 'tabNoStep']];

/** Every stage at once, with how many leads are in it. Managers and team leads can look at one broker; tap a row to open that list. */
export function PipelineScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [broker, setBroker] = useState('');
  const team = useQuery({ queryKey: ['team'], queryFn: () => api.team() });
  const counts = useQuery({ queryKey: ['lead-counts', broker], queryFn: () => api.leadCounts(undefined, broker || undefined) });
  if (counts.isPending) return <Loading label={t(lang, 'loading')} />;
  if (counts.isError) return <ErrorView message={errorText(counts.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await counts.refetch(); }} />;
  const n = counts.data.counts;
  const open = (tab: LeadTab) => nav.navigate('LeadsList', { tab, broker: broker || undefined });
  const row = (tab: LeadTab, label: string, warn = false) => (
    <Pressable key={tab} testID={`pipe-${tab}`} accessibilityRole="button" onPress={() => open(tab)} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={{ color: colors.text, fontSize: 16 }}>{label}</Text>
      <Text style={{ color: warn && (n[tab] ?? 0) > 0 ? colors.danger : colors.accent, fontSize: 20, fontWeight: '700' }}>{n[tab] ?? 0}</Text>
    </Pressable>
  );
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={counts.isRefetching} onRefresh={async () => { await counts.refetch(); }} />}>
      {team.data && team.data.items.length > 1 ? (
        <Chips<string> options={[{ value: '', label: t(lang, 'pipelineAll') }, ...team.data.items.map((m) => ({ value: m.id, label: m.name }))]} value={broker} onChange={setBroker} />
      ) : null}
      {LEAD_STAGES.map((s) => row(s, stageLabel(lang, s)))}
      {EXTRA.map(([tab, key]) => row(tab, t(lang, key), tab !== 'no_next_step'))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
});
