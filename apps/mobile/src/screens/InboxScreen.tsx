import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

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
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['inbox'] });
  const when = (v: string) => new Date(v).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const askDeleteAll = () =>
    Alert.alert(t(lang, 'deleteAll'), undefined, [
      { text: t(lang, 'cancel'), style: 'cancel' },
      { text: t(lang, 'deleteAll'), style: 'destructive', onPress: () => { void api.notificationsDeleteAll().then(refresh).catch(() => undefined); } },
    ]);
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
      {list.isPending ? <Loading label={t(lang, 'loading')} /> : list.isError ? <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} /> : (
        <>
          {items.length ? (
            <View style={styles.row}>
              <View style={styles.flex}><Button testID="inbox-read-all" variant="secondary" label={t(lang, 'markAllRead')} onPress={async () => { await api.notificationsReadAll(); await refresh(); }} /></View>
              <View style={styles.flex}><Button testID="inbox-delete-all" variant="secondary" label={t(lang, 'deleteAll')} onPress={async () => askDeleteAll()} /></View>
            </View>
          ) : <Text testID="inbox-empty" style={{ color: colors.muted }}>{t(lang, 'inboxEmpty')}</Text>}
          {items.map((n) => (
            <View key={n.id} testID={`inbox-${n.id}`} style={[styles.card, { backgroundColor: colors.card, borderColor: n.read ? colors.border : colors.primary }]}>
              <Text style={{ color: colors.text, fontWeight: n.read ? '400' : '800' }}>{n.title}</Text>
              {n.body ? <Text style={{ color: colors.text }}>{n.body}</Text> : null}
              <Text style={{ color: colors.muted }}>{when(n.created_at)}</Text>
              <View style={styles.row}>
                {n.read ? null : <View style={styles.flex}><Button testID={`inbox-read-${n.id}`} variant="secondary" label={t(lang, 'markRead')} onPress={async () => { await api.notificationRead(n.id); await refresh(); }} /></View>}
                <View style={styles.flex}><Button testID={`inbox-delete-${n.id}`} variant="secondary" label={t(lang, 'delete')} onPress={async () => { await api.notificationDelete(n.id); await refresh(); }} /></View>
              </View>
            </View>
          ))}
          {list.hasNextPage ? <Button testID="inbox-more" variant="secondary" label={t(lang, 'loadMore')} onPress={async () => { await list.fetchNextPage(); }} /> : null}
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
