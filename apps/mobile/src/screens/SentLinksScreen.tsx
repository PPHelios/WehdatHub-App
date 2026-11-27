import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

/** The client links this broker shared, newest first, with how many times each was opened. */
export function SentLinksScreen() {
  const { colors, elev } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
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
      ListEmptyComponent={<EmptyView title={t(lang, 'noLinks')} icon="link" actionLabel={t(lang, 'shareUnit')} onAction={() => nav.navigate('UnitsList')} />}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primaryInk} /> : null}
      renderItem={({ item }) => (
        <View style={[styles.card, elev('md'), { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Text style={[styles.flex, { color: colors.primaryInk, fontWeight: '800' }]}>{item.unitCode}{item.compound ? ` · ${item.compound}` : ''}</Text>
            <Text style={{ color: item.opens ? colors.accentInk : colors.muted, fontWeight: '700' }}>{item.opens} {t(lang, 'opens')}</Text>
          </View>
          <Text style={{ color: colors.muted }}>
            {[item.leadName || item.leadRef, item.recipientPhone, new Date(item.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')].filter(Boolean).join(' · ')}
          </Text>
          <Text style={{ color: colors.muted }}>
            {item.lastOpenedAt ? `${t(lang, 'lastOpened')}: ${new Date(item.lastOpenedAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : t(lang, 'notOpenedYet')}
          </Text>
          {item.note ? <Text style={{ color: colors.text }}>{item.note}</Text> : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  footer: { padding: spacing.lg },
});
