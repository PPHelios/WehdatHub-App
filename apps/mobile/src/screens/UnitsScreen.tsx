import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { UnitsPage } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { Button } from '../components/Button';
import { TodayCards } from '../components/TodayCards';
import { UnitCard } from '../components/UnitCard';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { Split, useColumns, useWide } from '../layout';
import { UnitScreen } from './UnitScreen';
import { radius, spacing, useTheme } from '../theme';
import { useDebounced } from '../useDebounced';
import { useRights } from '../rights';

const PAGE = 20;
const STATUSES = ['active', 'sold', 'archived'] as const;

export function UnitsScreen() {
  const wide = useWide();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [picked, setPicked] = useState<string | null>(null);
  if (!wide) return <UnitsList onOpen={(code) => nav.navigate('Unit', { code })} />;
  return <Split list={<UnitsList onOpen={setPicked} single />} detail={picked ? <UnitScreen code={picked} key={picked} /> : <View style={styles.flex} />} />;
}

function UnitsList({ onOpen, single = false }: { onOpen: (code: string) => void; single?: boolean }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const route = useRoute<RouteProp<{ p: { old?: boolean } | undefined }, 'p'>>();
  const [oldOnly, setOldOnly] = useState(Boolean(route.params?.old));
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('active');
  const [text, setText] = useState('');
  const wideColumns = useColumns();
  const columns = single ? 1 : wideColumns;
  const q = useDebounced(text.trim());
  const [showFilters, setShowFilters] = useState(false);
  const [compound, setCompound] = useState('');
  const [compoundText, setCompoundText] = useState('');
  const [staleDays, setStaleDays] = useState(0);
  const typed = useDebounced(compoundText.trim());
  const suggest = useQuery({ queryKey: ['compounds', typed], queryFn: () => api.unitCompounds(typed), enabled: showFilters && !compound });

  const list = useInfiniteQuery({
    queryKey: ['units', status, q, compound, staleDays, oldOnly],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.units({ status, q, compound: compound || undefined, staleDays: staleDays || undefined, old: oldOnly && status === 'active' ? true : undefined, limit: PAGE, offset: pageParam }),
    getNextPageParam: (last: UnitsPage) => (last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined),
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const counts = list.data?.pages[0]?.counts;
  const rights = useRights();
  // Data entry has no Today: the units nobody has confirmed (agency-wide) sit above their list instead.
  const old = useQuery({ queryKey: ['today'], queryFn: () => api.today(), enabled: rights.dataEntry && status === 'active' });

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <TextInput testID="units-search" style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={text} onChangeText={setText} placeholder={t(lang, 'search')} placeholderTextColor={colors.muted} autoCapitalize="characters" autoCorrect={false} returnKeyType="search" />
      {text.trim() !== q || (list.isFetching && !list.isFetchingNextPage && !list.isRefetching) ? <ActivityIndicator style={styles.searching} color={colors.primary} /> : null}
      <View style={styles.chips}>
        <Pressable testID="units-filters" accessibilityRole="button" accessibilityState={{ expanded: showFilters }} onPress={() => setShowFilters((v) => !v)} style={[styles.chip, { borderColor: compound || staleDays ? colors.primary : colors.border }]}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{t(lang, 'filters')}{compound || staleDays ? ' •' : ''}</Text>
        </Pressable>
        {STATUSES.map((s) => (
          <Pressable key={s} accessibilityRole="button" accessibilityState={{ selected: s === status }} onPress={() => setStatus(s)} style={[styles.chip, { borderColor: s === status ? colors.primary : colors.border, backgroundColor: s === status ? colors.primary : 'transparent' }]}>
            <Text style={{ color: s === status ? colors.onPrimary : colors.text, fontWeight: '600' }}>{t(lang, s)}{counts ? ` (${counts[s]})` : ''}</Text>
          </Pressable>
        ))}
        <Pressable testID="units-old" accessibilityRole="button" accessibilityState={{ selected: oldOnly }} onPress={() => { setStatus('active'); setOldOnly((v) => !v); }} style={[styles.chip, { borderColor: oldOnly ? colors.primary : colors.border, backgroundColor: oldOnly ? colors.primary : 'transparent' }]}>
          <Text style={{ color: oldOnly ? colors.onPrimary : colors.text, fontWeight: '600' }}>{t(lang, 'tcOldUnits')}</Text>
        </Pressable>
      </View>
      {rights.dataEntry && status === 'active' && old.data?.cards?.oldUnits ? <View style={styles.oldStrip}><TodayCards cards={old.data.cards} only="oldUnits" onShowAll={() => { setStatus('active'); setOldOnly(true); }} /></View> : null}
      {showFilters ? (
        <View style={styles.panel}>
          {compound ? (
            <Pressable testID="compound-clear" accessibilityRole="button" onPress={() => { setCompound(''); setCompoundText(''); }} style={[styles.chip, { borderColor: colors.primary }]}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{compound} ✕</Text>
            </Pressable>
          ) : (
            <>
              <TextInput testID="compound-input" style={[styles.search2, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={compoundText} onChangeText={setCompoundText} placeholder={t(lang, 'typeCompound')} placeholderTextColor={colors.muted} autoCorrect={false} />
              {(suggest.data?.items ?? []).map((c) => (
                <Pressable key={c.name} accessibilityRole="button" onPress={() => { setCompound(c.name); setCompoundText(c.name); }} style={[styles.suggest, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text }}>{c.name} ({c.n})</Text>
                </Pressable>
              ))}
            </>
          )}
          <Text style={{ color: colors.muted }}>{t(lang, 'staleDays')}</Text>
          <View style={styles.chipsRow}>
            {[0, 30, 60, 90].map((d) => (
              <Pressable key={d} testID={`stale-${d}`} accessibilityRole="button" accessibilityState={{ selected: d === staleDays }} onPress={() => setStaleDays(d)} style={[styles.chip, { borderColor: d === staleDays ? colors.primary : colors.border, backgroundColor: d === staleDays ? colors.primary : 'transparent' }]}>
                <Text style={{ color: d === staleDays ? colors.onPrimary : colors.text, fontWeight: '600' }}>{d === 0 ? '—' : d}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {list.isPending ? (
        <Loading label={t(lang, 'loading')} />
      ) : list.isError && !items.length ? (
        <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => list.refetch()} />
      ) : (
        <FlashList
          key={`cols-${columns}`}
          numColumns={columns}
          data={items}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <UnitCard unit={item} lang={lang} onPress={() => onOpen(item.code)} onEdit={rights.editUnits && (item.mine || rights.dataEntry || rights.manager || rights.agencyOwner) ? () => nav.navigate('AddUnit', { edit: item.code }) : undefined} />}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          onEndReachedThreshold={0.6}
          refreshing={list.isRefetching && !list.isFetchingNextPage}
          onRefresh={() => list.refetch()}
          ListEmptyComponent={<EmptyView title={t(lang, 'noUnits')} hint={t(lang, 'noUnitsHint')} actionLabel={q ? t(lang, 'clearSearch') : undefined} onAction={q ? () => setText('') : undefined} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : list.isError ? <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => list.fetchNextPage()} /> : null}
        />
      )}
      {rights.addUnits ? <View style={styles.add}><Button testID="add-unit" label={`＋ ${t(lang, 'addUnit')}`} onPress={() => nav.navigate('AddUnit')} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  oldStrip: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  flex: { flex: 1 },
  searching: { position: 'absolute', top: spacing.lg + 14, end: spacing.lg + 14 },
  search: { margin: spacing.lg, minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16 },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  panel: { paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  chipsRow: { flexDirection: 'row', gap: spacing.sm },
  search2: { minHeight: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16 },
  suggest: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  footer: { padding: spacing.lg },
  add: { padding: spacing.lg },
});
