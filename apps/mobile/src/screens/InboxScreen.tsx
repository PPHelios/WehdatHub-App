import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { InboxItem, Lang } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { ErrorView, Loading } from '../components/StateViews';
import { rowDate } from '../dates';
import { errorText } from '../errors';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';
import { clearTray } from '../tray';

const InboxCard = memo(function InboxCard({ n, lang, onRead, onDelete }: { n: InboxItem; lang: Lang; onRead: (id: string) => void; onDelete: (id: string) => void }) {
  const { colors, elev } = useTheme();
  return (
    <View testID={`inbox-${n.id}`} style={[styles.card, elev('md'), { backgroundColor: colors.card, borderColor: n.read ? colors.border : colors.primary }]}>
      <Text style={{ color: colors.text, fontWeight: n.read ? '400' : '800' }}>{n.title}</Text>
      {n.body ? <Text style={{ color: colors.text }}>{n.body}</Text> : null}
      <Text style={{ color: colors.muted }}>{rowDate(lang, n.created_at)}</Text>
      <View style={styles.row}>
        {n.read ? null : <View style={styles.flex}><Button testID={`inbox-read-${n.id}`} variant="secondary" label={t(lang, 'markRead')} onPress={async () => onRead(n.id)} /></View>}
        <View style={styles.flex}><Button testID={`inbox-delete-${n.id}`} variant="secondary" label={t(lang, 'delete')} onPress={async () => onDelete(n.id)} /></View>
      </View>
    </View>
  );
});

/** The broker's notifications: newest first, unread in bold. Each can be marked read or deleted (deleted ones stay in the managers' log). */
export function InboxScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const qc = useQueryClient();
  const list = useInfiniteQuery({
    queryKey: ['inbox'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.notificationsInbox(pageParam),
    getNextPageParam: (last) => (last.more ? last.page + 1 : undefined),
  });
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['inbox'] }), [qc]);
  const unread = list.data?.pages[0]?.unread;
  // Nothing unread: close what the phone still shows and clear the icon number.
  useEffect(() => { if (unread === 0) void clearTray(); }, [unread]);
  const read = useCallback(async (id: string) => { await api.notificationRead(id); await refresh(); }, [refresh]);
  const remove = useCallback(async (id: string) => { await api.notificationDelete(id); await refresh(); }, [refresh]);
  const askDeleteAll = () =>
    Alert.alert(t(lang, 'deleteAll'), undefined, [
      { text: t(lang, 'cancel'), style: 'cancel' },
      { text: t(lang, 'deleteAll'), style: 'destructive', onPress: () => { void api.notificationsDeleteAll().then(refresh).catch(() => undefined); } },
    ]);
  const renderItem = useCallback(({ item }: { item: InboxItem }) => <InboxCard n={item} lang={lang} onRead={read} onDelete={remove} />, [lang, read, remove]);
  if (list.isPending) return <View style={[styles.pad, { backgroundColor: colors.bg }]}><Loading label={t(lang, 'loading')} /></View>;
  if (list.isError) return <View style={[styles.pad, { backgroundColor: colors.bg }]}><ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} /></View>;
  return (
    <FlashList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.pad}
      data={items}
      keyExtractor={(n) => n.id}
      renderItem={renderItem}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
      onEndReachedThreshold={0.6}
      ListHeaderComponent={items.length ? (
        <View style={[styles.row, styles.gap]}>
          <View style={styles.flex}><Button testID="inbox-read-all" variant="secondary" label={t(lang, 'markAllRead')} onPress={async () => { await api.notificationsReadAll(); await refresh(); }} /></View>
          <View style={styles.flex}><Button testID="inbox-delete-all" variant="secondary" label={t(lang, 'deleteAll')} onPress={async () => askDeleteAll()} /></View>
        </View>
      ) : <Text testID="inbox-empty" style={{ color: colors.muted }}>{t(lang, 'inboxEmpty')}</Text>}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primaryInk} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  gap: { marginBottom: spacing.md },
  flex: { flex: 1 },
  footer: { padding: spacing.lg },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
});
