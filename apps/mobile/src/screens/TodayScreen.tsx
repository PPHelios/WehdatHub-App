import React from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TodayTask } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t, type StringKey } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

const KIND_LABEL: Record<TodayTask['kind'], StringKey> = { late: 'late', viewing: 'viewing', hot: 'hot', call: 'callTask', matches: 'matches' };

export function TodayScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<BottomTabNavigationProp<{ Units: undefined }>>();
  const q = useQuery({ queryKey: ['today'], queryFn: () => api.today() });

  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError || !q.data) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} altLabel={t(lang, 'openUnits')} onAlt={() => nav.navigate('Units')} />;
  const { counts, tasks, moreTasks } = q.data;
  const stats: [StringKey, number][] = [['followUps', counts.followUpsToday], ['viewings', counts.viewings], ['newLeads', counts.newLeads]];

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={async () => { await q.refetch(); }} />}>
      <View style={styles.stats}>
        {stats.map(([k, n]) => (
          <View key={k} style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statN, { color: colors.text }]}>{n}</Text>
            <Text style={{ color: colors.muted }}>{t(lang, k)}</Text>
          </View>
        ))}
      </View>
      {tasks.length === 0 ? (
        <View style={styles.empty}><EmptyView title={t(lang, 'allClear')} hint={t(lang, 'allClearHint')} actionLabel={t(lang, 'openUnits')} onAction={() => nav.navigate('Units')} /></View>
      ) : (
        tasks.map((task) => (
          <View key={task.ref} testID="today-task" style={[styles.task, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.taskInfo}>
              <Text style={[styles.name, { color: colors.text }]}>{task.name || task.ref}</Text>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>{t(lang, KIND_LABEL[task.kind])}{task.matches ? ` · ${task.matches}` : ''}</Text>
              {task.unitCode ? <Text style={{ color: colors.muted }}>{task.unitCode}</Text> : null}
            </View>
            {task.phone ? <Button label={t(lang, 'call')} variant="secondary" onPress={() => Linking.openURL(`tel:+${task.phone}`)} /> : null}
          </View>
        ))
      )}
      {moreTasks > 0 ? <Text style={[styles.more, { color: colors.muted }]}>{t(lang, 'moreTasks')} {moreTasks}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  statN: { fontSize: 24, fontWeight: '800' },
  empty: { flex: 1, minHeight: 300 },
  task: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  taskInfo: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700' },
  more: { textAlign: 'center' },
});
