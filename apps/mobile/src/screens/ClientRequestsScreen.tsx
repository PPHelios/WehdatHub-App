import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

/** Client requests (a saved search for a client, with alerts): Pending and Fulfilled. Brokers see their own, managers the whole agency. */
export function ClientRequestsScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'fulfilled'>('pending');
  const list = useInfiniteQuery({
    queryKey: ['clientRequests', tab],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.clientRequests(tab, pageParam),
    getNextPageParam: (last) => (last.more || (last.pages !== undefined && last.page < last.pages) ? last.page + 1 : undefined),
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['clientRequests'] });
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
      <Chips<'pending' | 'fulfilled'> testID="requests-tab" value={tab} options={[{ value: 'pending', label: t(lang, 'tabPending') }, { value: 'fulfilled', label: t(lang, 'tabFulfilled') }]} onChange={setTab} />
      {list.isPending ? <Loading label={t(lang, 'loading')} /> : list.isError ? <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} /> : (
        <>
          {!items.length ? <Text testID="requests-empty" style={{ color: colors.muted }}>{t(lang, 'noRequests')}</Text> : null}
          {items.map((r) => (
            <View key={r.id} testID={`request-${r.id}`} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{r.alerts ? '🔔 ' : ''}{r.summary}</Text>
              {r.lead ? (
                <Pressable testID={`request-lead-${r.id}`} accessibilityRole="button" onPress={() => nav.navigate('Lead', { ref: r.lead!.ref })}>
                  <Text style={{ color: colors.primary }}>👤 {r.lead.name || r.lead.ref}</Text>
                </Pressable>
              ) : null}
              <Text style={{ color: colors.muted }}>{r.matches} {t(lang, 'matchesN')}</Text>
              <View style={styles.row}>
                {tab === 'pending' ? <View style={styles.flex}><Button testID={`request-fulfil-${r.id}`} variant="secondary" label={t(lang, 'markFulfilled')} onPress={async () => { await api.clientRequestFulfil(r.id); await refresh(); }} /></View> : null}
                <View style={styles.flex}><Button testID={`request-delete-${r.id}`} variant="secondary" label={t(lang, 'delete')} onPress={async () => { await api.clientRequestDelete(r.id); await refresh(); }} /></View>
              </View>
            </View>
          ))}
          {list.hasNextPage ? <Button testID="requests-more" variant="secondary" label={t(lang, 'loadMore')} onPress={async () => { await list.fetchNextPage(); }} /> : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
});
