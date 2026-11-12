import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ApiLead, LeadTab, LeadsPage } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { BulkAssign } from '../components/BulkAssign';
import { useRights } from '../rights';
import { SwipeRow } from '../components/SwipeRow';
import { tick } from '../haptics';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { stageLabel, t, type StringKey } from '../i18n';
import type { RootStackParams } from '../navigation';
import { Split, useColumns, useWide } from '../layout';
import { LeadScreen } from './LeadScreen';
import { radius, spacing, useTheme } from '../theme';
import { useDebounced } from '../useDebounced';

const TABS: [LeadTab, StringKey][] = [['all', 'tabAll'], ['due_today', 'tabDue'], ['overdue', 'tabOverdue'], ['new', 'st_new'], ['interested', 'st_interested'], ['viewing', 'st_viewing'], ['negotiation', 'st_negotiation'], ['no_next_step', 'tabNoStep']];

export function LeadsScreen() {
  const wide = useWide();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [picked, setPicked] = useState<string | null>(null);
  if (!wide) return <LeadsList onOpen={(r) => nav.navigate('Lead', { ref: r })} />;
  return <Split list={<LeadsList onOpen={setPicked} single />} detail={picked ? <LeadScreen leadRef={picked} key={picked} /> : <View style={styles.flex} />} />;
}

function LeadsList({ onOpen, single = false }: { onOpen: (ref: string) => void; single?: boolean }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [tab, setTab] = useState<LeadTab>('all');
  const [text, setText] = useState('');
  const manager = useRights().manager;
  const [unassigned, setUnassigned] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Record<string, ApiLead>>({});
  const [assigning, setAssigning] = useState(false);
  const wideColumns = useColumns();
  const columns = single ? 1 : wideColumns;
  const q = useDebounced(text.trim());
  const list = useInfiniteQuery({
    queryKey: ['leads', tab, q, unassigned],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.leads({ tab, q, offset: pageParam, broker: unassigned ? 'none' : undefined }),
    getNextPageParam: (last: LeadsPage) => (last.more ? last.offset + last.limit : undefined),
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  // The number on every tab, from the start.
  const tabCounts = useQuery({ queryKey: ['leads', 'counts', q], queryFn: () => api.leadCounts(q || undefined), select: (d) => d.counts }).data;
  const queries = useQueryClient();
  // Press and hold a lead: call it, or mark it as called, without opening it.
  const callLead = (l: ApiLead) => {
    tick();
    if (l.phones[0]) Linking.openURL(`tel:${l.phones[0]}`).catch(() => undefined);
  };
  const markLead = (l: ApiLead) => {
    tick();
    api.leadCalled(l.ref, l.version).then(() => { tick(); return queries.invalidateQueries({ queryKey: ['leads'] }); }).catch((e) => Alert.alert(errorText(e, lang)));
  };
  const quick = (l: ApiLead) => {
    tick();
    const buttons = [
      ...(l.phones[0] ? [{ text: t(lang, 'quickCall'), onPress: () => { Linking.openURL(`tel:${l.phones[0]}`).catch(() => undefined); } }] : []),
      { text: t(lang, 'markCalled'), onPress: () => { api.leadCalled(l.ref, l.version).then(() => { tick(); return queries.invalidateQueries({ queryKey: ['leads'] }); }).catch((e) => Alert.alert(errorText(e, lang))); } },
      { text: t(lang, 'cancel'), style: 'cancel' as const },
    ];
    Alert.alert(l.name || l.ref, undefined, buttons);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <TextInput testID="leads-search" style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={text} onChangeText={setText} placeholder={t(lang, 'searchLeads')} placeholderTextColor={colors.muted} autoCorrect={false} returnKeyType="search" />
      {text.trim() !== q || (list.isFetching && !list.isFetchingNextPage && !list.isRefetching) ? <ActivityIndicator style={styles.searching} color={colors.primary} /> : null}
      <View style={styles.chipsBox}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {manager ? (
            <Pressable testID="chip-unassigned" accessibilityRole="button" accessibilityState={{ selected: unassigned }} onPress={() => setUnassigned((u) => !u)} style={[styles.chip, { borderColor: unassigned ? colors.accent : colors.border }, unassigned && { backgroundColor: colors.accent }]}>
              <Text style={[styles.chipText, { color: unassigned ? colors.onPrimary : colors.text }]}>{t(lang, 'unassigned')}</Text>
            </Pressable>
          ) : null}
          {TABS.map(([v, k]) => (
            <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: v === tab }} onPress={() => setTab(v)} style={[styles.chip, { borderColor: v === tab ? colors.primary : colors.border }, v === tab && { backgroundColor: colors.primary }]}>
              <Text style={[styles.chipText, { color: v === tab ? colors.onPrimary : colors.text }]}>{k.startsWith('st_') ? stageLabel(lang, k.slice(3)) : t(lang, k)}{tabCounts && tabCounts[v] !== undefined ? ` (${tabCounts[v]})` : ''}</Text>
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
          key={`cols-${columns}`}
          numColumns={columns}
            data={items}
            keyExtractor={(l) => l.ref}
            renderItem={({ item }) => (
              <SwipeRow rightLabel={`📞 ${t(lang, 'quickCall')}`} leftLabel={`✓ ${t(lang, 'markCalled')}`} onSwipeRight={() => callLead(item)} onSwipeLeft={() => markLead(item)}>
                <LeadRow lead={item} picked={selecting ? Boolean(sel[item.ref]) : undefined} onPress={() => (selecting ? setSel((c) => { const n = { ...c }; if (n[item.ref]) delete n[item.ref]; else n[item.ref] = item; return n; }) : onOpen(item.ref))} onQuick={() => quick(item)} />
              </SwipeRow>
            )}
            onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
            onEndReachedThreshold={0.6}
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => list.refetch()}
            ListEmptyComponent={<EmptyView title={t(lang, 'noLeads')} hint={t(lang, 'noLeadsHint')} actionLabel={t(lang, 'newLead')} onAction={() => nav.navigate('NewLead')} />}
            ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null}
          />
        )}
      </View>
      {selecting ? (
        <View style={styles.fab}>
          <Button testID="assign-selected" label={`${t(lang, 'assignTo')} (${Object.keys(sel).length})`} disabled={!Object.keys(sel).length} onPress={() => setAssigning(true)} />
          <Button testID="select-done" variant="secondary" label={t(lang, 'doneSelect')} onPress={() => { setSelecting(false); setSel({}); }} />
        </View>
      ) : (
        <View style={styles.fab}>
          <Button testID="new-lead" label={`＋ ${t(lang, 'newLead')}`} onPress={() => nav.navigate('NewLead')} />
          {manager ? <Button testID="select-leads" variant="secondary" label={t(lang, 'selectLeads')} onPress={() => setSelecting(true)} /> : null}
        </View>
      )}
      {assigning ? <BulkAssign leads={Object.values(sel)} onCancel={() => setAssigning(false)} onDone={() => { setAssigning(false); setSelecting(false); setSel({}); tick(); queries.invalidateQueries({ queryKey: ['leads'] }); }} /> : null}
    </View>
  );
}

function LeadRow({ lead, picked, onPress, onQuick }: { lead: ApiLead; picked?: boolean; onPress: () => void; onQuick: () => void }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const due = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
  const late = due !== null && due.getTime() < Date.now();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} onLongPress={onQuick} style={[styles.card, { backgroundColor: colors.card, borderColor: picked ? colors.primary : colors.border }, picked && { borderWidth: 2 }]}>
      <View style={styles.cardTop}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{picked === undefined ? '' : picked ? '☑ ' : '☐ '}{lead.name || lead.ref}</Text>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{stageLabel(lang, lead.stage)}</Text>
      </View>
      <Text style={{ color: colors.muted }}>{lead.ref}{lead.phones[0] ? ` · ${lead.phones[0]}` : ''} · {lead.assignee ?? t(lang, 'unassigned')}</Text>
      {due ? <Text style={{ color: late ? colors.danger : colors.accent, fontWeight: '600' }}>{late ? `${t(lang, 'tabOverdue')} · ` : ''}{due.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searching: { position: 'absolute', top: spacing.lg + 14, end: spacing.lg + 14 },
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
