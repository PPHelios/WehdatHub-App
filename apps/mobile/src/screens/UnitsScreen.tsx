import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { UnitsPage } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { Button } from '../components/Button';
import { UnitCard } from '../components/UnitCard';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

const PAGE = 20;
const STATUSES = ['active', 'sold', 'archived'] as const;

export function UnitsScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('active');
  const [text, setText] = useState('');
  const q = text.trim();

  const list = useInfiniteQuery({
    queryKey: ['units', status, q],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.units({ status, q, limit: PAGE, offset: pageParam }),
    getNextPageParam: (last: UnitsPage) => (last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined),
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <TextInput testID="units-search" style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={text} onChangeText={setText} placeholder={t(lang, 'search')} placeholderTextColor={colors.muted} autoCapitalize="characters" autoCorrect={false} returnKeyType="search" />
      <View style={styles.chips}>
        {STATUSES.map((s) => (
          <Pressable key={s} accessibilityRole="button" accessibilityState={{ selected: s === status }} onPress={() => setStatus(s)} style={[styles.chip, { borderColor: s === status ? colors.primary : colors.border, backgroundColor: s === status ? colors.primary : 'transparent' }]}>
            <Text style={{ color: s === status ? colors.onPrimary : colors.text, fontWeight: '600' }}>{t(lang, s)}</Text>
          </Pressable>
        ))}
      </View>
      {list.isPending ? (
        <Loading label={t(lang, 'loading')} />
      ) : list.isError && !items.length ? (
        <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => list.refetch()} />
      ) : (
        <FlashList
          data={items}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <UnitCard unit={item} lang={lang} onPress={() => nav.navigate('Unit', { code: item.code })} />}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          onEndReachedThreshold={0.6}
          refreshing={list.isRefetching && !list.isFetchingNextPage}
          onRefresh={() => list.refetch()}
          ListEmptyComponent={<EmptyView title={t(lang, 'noUnits')} hint={t(lang, 'noUnitsHint')} actionLabel={q ? t(lang, 'clearSearch') : undefined} onAction={q ? () => setText('') : undefined} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : list.isError ? <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => list.fetchNextPage()} /> : null}
        />
      )}
      <View style={styles.add}><Button testID="add-unit" label={`＋ ${t(lang, 'addUnit')}`} onPress={() => nav.navigate('AddUnit')} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { margin: spacing.lg, minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16 },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  footer: { padding: spacing.lg },
  add: { padding: spacing.lg },
});
