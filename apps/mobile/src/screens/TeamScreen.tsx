import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ApiLead } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { ot } from '../ownerText';
import { useRights } from '../rights';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

/** The team: each broker with open, overdue and due-today leads. A manager sees everyone, a team lead their own team. */
export function TeamScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const rights = useRights();
  const q = useQuery({ queryKey: ['team'], queryFn: () => api.team() });
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  return (
    <FlashList
      data={q.data.items}
      keyExtractor={(m) => m.id}
      refreshing={q.isRefetching}
      onRefresh={() => { q.refetch(); }}
      ListHeaderComponent={rights.manager || rights.agencyOwner ? <View style={{ padding: spacing.lg }}><Button testID="team-add" label={`➕ ${t(lang, 'invite')}`} onPress={() => nav.navigate('Invite')} /></View> : null}
      ListEmptyComponent={<EmptyView title={t(lang, 'teamEmpty')} />}
      renderItem={({ item }) => (
        <Pressable testID={`member-${item.id}`} accessibilityRole="button" onPress={() => nav.navigate('TeamMember', { id: item.id, name: item.name, role: item.role })} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.text }]}>{item.name}{item.away ? ` · ${t(lang, 'away')}` : ''}</Text>
          <View style={styles.row}>
            <Text style={{ color: colors.text }}>{item.open} {t(lang, 'openLeads')}</Text>
            <Text style={{ color: item.overdue ? colors.danger : colors.muted, fontWeight: item.overdue ? '700' : '400' }}>{item.overdue} {t(lang, 'overdue')}</Text>
            <Text style={{ color: colors.muted }}>{item.soon} {t(lang, 'dueSoon')}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

/** One broker's leads, newest activity first. */
export function TeamMemberScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { id, role = '' } = useRoute<RouteProp<RootStackParams, 'TeamMember'>>().params;
  const rights = useRights();
  const qc = useQueryClient();
  const admin = async (fn: () => Promise<unknown>) => {
    try { await fn(); await qc.invalidateQueries({ queryKey: ['team'] }); nav.goBack(); } catch (e) { Alert.alert(errorText(e, lang)); }
  };
  const list = useInfiniteQuery({
    queryKey: ['teamLeads', id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.leads({ broker: id, offset: pageParam }),
    getNextPageParam: (last) => (last.more ? last.offset + last.items.length : undefined),
  });
  if (list.isPending) return <Loading label={t(lang, 'loading')} />;
  if (list.isError) return <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} />;
  const items: ApiLead[] = list.data.pages.flatMap((p) => p.items);
  return (
    <FlashList
      data={items}
      keyExtractor={(l) => l.ref}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
      onEndReachedThreshold={0.6}
      refreshing={list.isRefetching && !list.isFetchingNextPage}
      onRefresh={() => { list.refetch(); }}
      ListHeaderComponent={rights.manager || rights.agencyOwner ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          {rights.agencyOwner && (role === 'broker' || role === 'manager') ? <Button testID="member-role" variant="secondary" label={role === 'manager' ? ot(lang, 'makeBroker') : ot(lang, 'makeManager')} onPress={() => admin(() => api.changeRole(id, role === 'manager' ? 'broker' : 'manager'))} /> : null}
          <Button testID="member-deactivate" variant="secondary" label={`⛔ ${ot(lang, 'deactivate')}`} onPress={() => Alert.alert(ot(lang, 'deactivateAsk'), undefined, [{ text: ot(lang, 'deactivate'), style: 'destructive', onPress: () => { void admin(() => api.deactivate(id)); } }, { text: 'OK', style: 'cancel' }])} />
        </View>
      ) : null}
      ListEmptyComponent={<EmptyView title={t(lang, 'noLeadsHere')} />}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="button" onPress={() => nav.navigate('Lead', { ref: item.ref })} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.text }]}>{item.name || item.ref}</Text>
          <Text style={{ color: colors.muted }}>{item.ref} · {t(lang, `st_${item.stage}` as never)}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  name: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.lg },
});
