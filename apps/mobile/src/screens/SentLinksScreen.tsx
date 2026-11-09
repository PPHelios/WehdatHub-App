import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

/** The client links this broker shared, newest first, with how many times each was opened. */
export function SentLinksScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const list = useInfiniteQuery({
    queryKey: ['sentLinks'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.sentLinks(pageParam),
    getNextPageParam: (last) => (last.hasMore ? last.offset + last.items.length : undefined),
  });
  if (list.isPending) return <Loading label={t(lang, 'loading')} />;
  if (list.isError) return <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} />;
  const items = list.data.pages.flatMap((p) => p.items);
  return (
    <FlashList
      data={items}
      keyExtractor={(l, i) => `${l.createdAt}-${i}`}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
      onEndReachedThreshold={0.6}
      refreshing={list.isRefetching && !list.isFetchingNextPage}
      onRefresh={() => { list.refetch(); }}
      ListEmptyComponent={<EmptyView title={t(lang, 'noLinks')} />}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Text style={[styles.flex, { color: colors.primary, fontWeight: '800' }]}>{item.unitCode}{item.compound ? ` · ${item.compound}` : ''}</Text>
            <Text style={{ color: item.opens ? colors.accent : colors.muted, fontWeight: '700' }}>{item.opens} {t(lang, 'opens')}</Text>
          </View>
          <Text style={{ color: colors.muted }}>
            {[item.leadName || item.leadRef, item.recipientPhone, new Date(item.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')].filter(Boolean).join(' · ')}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  footer: { padding: spacing.lg },
});
