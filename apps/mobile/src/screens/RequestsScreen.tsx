import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import type { RootStackParams } from '../navigation';
import { ot } from '../ownerText';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

const STATUSES = ['pending', 'approved', 'declined', 'all'] as const;
type Status = (typeof STATUSES)[number];

/** Brokers' requests to see a unit's private details; a manager approves or declines (30 days). */
export function RequestsScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('pending');
  const list = useInfiniteQuery({
    queryKey: ['accessRequests', status],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.accessRequests(status, pageParam),
    getNextPageParam: (last, all) => (all.flatMap((p) => p.items).length < last.total ? all.length : undefined),
  });
  const answer = async (id: number, ok: boolean) => {
    await api.answerAccess(id, ok).catch((e) => Alert.alert(errorText(e, lang)));
    await qc.invalidateQueries({ queryKey: ['accessRequests'] });
  };
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={styles.pad}><Chips<Status> testID="request-status" value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: ot(lang, s === 'all' ? 'all' : s) }))} /></View>
      {list.isPending ? <Loading label={t(lang, 'loading')} /> : list.isError ? <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} /> : (
        <FlashList
          data={items}
          keyExtractor={(r) => String(r.id)}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          ListEmptyComponent={<EmptyView title={ot(lang, 'noRequests')} />}
          renderItem={({ item }) => (
            <View testID={`request-${item.id}`} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Pressable accessibilityRole="button" onPress={() => nav.navigate('Unit', { code: item.code })}><Text style={[styles.name, { color: colors.primary }]}>{item.code}</Text></Pressable>
              <Text style={{ color: colors.text }}>{item.broker_name} · {ot(lang, item.status)}{item.decided_by_name ? ` (${item.decided_by_name})` : ''}</Text>
              {item.status === 'pending' ? (
                <View style={styles.row}>
                  <Button testID={`approve-${item.id}`} label={ot(lang, 'approve')} onPress={() => answer(item.id, true)} />
                  <Button testID={`decline-${item.id}`} label={ot(lang, 'decline')} variant="secondary" onPress={() => answer(item.id, false)} />
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

/** Who did what, when (managers see data requests; the agency owner sees everything). Kept 90 days. */
export function ActivityLogScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const list = useInfiniteQuery({
    queryKey: ['activityLog'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.activityLog(pageParam),
    getNextPageParam: (last, all) => (last.more ? all.length : undefined),
  });
  if (list.isPending) return <Loading label={t(lang, 'loading')} />;
  if (list.isError) return <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} />;
  const items = list.data.pages.flatMap((p) => p.items);
  return (
    <FlashList
      data={items}
      keyExtractor={(r) => String(r.id)}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
      ListEmptyComponent={<EmptyView title={ot(lang, 'noRequests')} />}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.text }}>{item.text}</Text>
          <Text style={{ color: colors.muted }}>{item.who} · {new Date(item.at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  name: { fontSize: 16, fontWeight: '700' },
});
