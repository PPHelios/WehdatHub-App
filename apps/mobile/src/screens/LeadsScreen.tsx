import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ApiLead, LeadTab, LeadsPage } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t, type StringKey } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

const TABS: [LeadTab, StringKey][] = [['all', 'tabAll'], ['due_today', 'tabDue'], ['overdue', 'tabOverdue'], ['new', 'st_new'], ['interested', 'st_interested'], ['viewing', 'st_viewing'], ['negotiation', 'st_negotiation'], ['no_next_step', 'tabNoStep']];

export function LeadsScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [tab, setTab] = useState<LeadTab>('all');
  const [text, setText] = useState('');
  const q = text.trim();
  const list = useInfiniteQuery({
    queryKey: ['leads', tab, q],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.leads({ tab, q, offset: pageParam }),
    getNextPageParam: (last: LeadsPage) => (last.more ? last.offset + last.limit : undefined),
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <TextInput testID="leads-search" style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={text} onChangeText={setText} placeholder={t(lang, 'searchLeads')} placeholderTextColor={colors.muted} autoCorrect={false} returnKeyType="search" />
      <View style={styles.chipsBox}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {TABS.map(([v, k]) => (
            <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: v === tab }} onPress={() => setTab(v)} style={[styles.chip, { borderColor: v === tab ? colors.primary : colors.border }, v === tab && { backgroundColor: colors.primary }]}>
              <Text style={[styles.chipText, { color: v === tab ? colors.onPrimary : colors.text }]}>{t(lang, k)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={styles.flex}>
        {list.isPending ? (
          <Loading label={t(lang, 'loading')} />
        ) : list.isError && !items.length ? (
          <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} />
        ) : (
          <FlashList
            data={items}
            keyExtractor={(l) => l.ref}
            renderItem={({ item }) => <LeadRow lead={item} onPress={() => nav.navigate('Lead', { ref: item.ref })} />}
            onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
            onEndReachedThreshold={0.6}
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => list.refetch()}
            ListEmptyComponent={<EmptyView title={t(lang, 'noLeads')} hint={t(lang, 'noLeadsHint')} actionLabel={t(lang, 'newLead')} onAction={() => nav.navigate('NewLead')} />}
            ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null}
          />
        )}
      </View>
      <View style={styles.fab}><Button testID="new-lead" label={`＋ ${t(lang, 'newLead')}`} onPress={() => nav.navigate('NewLead')} /></View>
    </View>
  );
}

function LeadRow({ lead, onPress }: { lead: ApiLead; onPress: () => void }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const due = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
  const late = due !== null && due.getTime() < Date.now();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{lead.name || lead.ref}</Text>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{t(lang, `st_${lead.stage}` as StringKey)}</Text>
      </View>
      <Text style={{ color: colors.muted }}>{lead.ref}{lead.phones[0] ? ` · ${lead.phones[0]}` : ''}</Text>
      {due ? <Text style={{ color: late ? colors.danger : colors.accent, fontWeight: '600' }}>{late ? `${t(lang, 'tabOverdue')} · ` : ''}{due.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { margin: spacing.lg, minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16 },
  chipsBox: { height: 48 },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, height: 40, justifyContent: 'center' },
  chipText: { fontWeight: '600' },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  name: { fontSize: 16, fontWeight: '700', flex: 1 },
  footer: { padding: spacing.lg },
  fab: { padding: spacing.lg },
});
