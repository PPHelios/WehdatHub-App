import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ApiLead, Lang, LeadQueue, LeadTab, LeadsPage } from '@wehdathub/shared';
import { PlanLockedError } from '@wehdathub/shared';
import { usePlanLock } from '../planLock';
import { usePlanState } from '../planState';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { LeadCard } from '../components/LeadCard';
import { BulkAssign } from '../components/BulkAssign';
import { useRights } from '../rights';
import { SwipeRow } from '../components/SwipeRow';
import { CoachMark } from '../components/CoachMark';
import { tick } from '../haptics';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { stageLabel, t, type StringKey } from '../i18n';
import type { RootStackParams } from '../navigation';
import { Split, useColumns, useWide } from '../layout';
import { LeadScreen } from './LeadScreen';
import { useSelectionHighlight } from '../components/SelectionHighlight';
import { greenGradient, radius, spacing, useTheme } from '../theme';
import { useDebounced } from '../useDebounced';
import { toast } from '../components/Toast';

const TABS: [LeadTab, StringKey][] = [['all', 'tabAll'], ['due_today', 'tabDue'], ['overdue', 'tabOverdue'], ['new', 'st_new'], ['interested', 'st_interested'], ['viewing', 'st_viewing'], ['negotiation', 'st_negotiation'], ['no_next_step', 'tabNoStep']];

export function LeadsScreen() {
  const wide = useWide();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [picked, setPicked] = useState<string | null>(null);
  const openLead = useCallback((r: string) => nav.navigate('Lead', { ref: r }), [nav]);
  if (!wide) return <LeadsList onOpen={openLead} />;
  return <Split list={<LeadsList onOpen={setPicked} single />} detail={picked ? <LeadScreen leadRef={picked} key={picked} /> : <View style={styles.flex} />} />;
}

function LeadsList({ onOpen, single = false }: { onOpen: (ref: string) => void; single?: boolean }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const params = (useRoute().params ?? {}) as { tab?: LeadTab; broker?: string; team?: string; queue?: LeadQueue };
  const [tab, setTab] = useState<LeadTab>(params.tab ?? 'all');
  const selection = useSelectionHighlight(tab, greenGradient);
  const brokerFilter = params.broker;
  const teamFilter = params.team;
  const queueFilter = params.queue;
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
    queryKey: ['leads', tab, q, unassigned, brokerFilter, teamFilter, queueFilter],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.leads({ tab, q, offset: pageParam, broker: unassigned ? 'none' : brokerFilter, team: teamFilter, queue: queueFilter }),
    getNextPageParam: (last: LeadsPage) => (last.more ? last.offset + last.limit : undefined),
  });
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const tabCounts = useQuery({
    queryKey: ['leads', 'counts', { q }],
    queryFn: () => api.leadCounts(q || undefined),
    select: (d) => d.counts,
    placeholderData: (previous) => previous,
  }).data;
  const queries = useQueryClient();
  // Press and hold a lead: call it, or mark it as called, without opening it.
  const callLead = useCallback((l: ApiLead) => {
    tick();
    if (l.phones[0]) Linking.openURL(`tel:${l.phones[0]}`).catch(() => undefined);
  }, []);
  const markLead = useCallback((l: ApiLead) => {
    tick();
    api.leadCalled(l.ref, l.version).then(() => { tick(); return queries.invalidateQueries({ queryKey: ['leads'] }); }).catch((e) => toast(errorText(e, lang), true));
  }, [queries, lang]);
  const quick = useCallback((l: ApiLead) => {
    tick();
    const buttons = [
      ...(l.phones[0] ? [{ text: t(lang, 'quickCall'), onPress: () => { Linking.openURL(`tel:${l.phones[0]}`).catch(() => undefined); } }] : []),
      { text: t(lang, 'markCalled'), onPress: () => { api.leadCalled(l.ref, l.version).then(() => { tick(); return queries.invalidateQueries({ queryKey: ['leads'] }); }).catch((e) => toast(errorText(e, lang), true)); } },
      { text: t(lang, 'cancel'), style: 'cancel' as const },
    ];
    Alert.alert(l.name || l.ref, undefined, buttons);
  }, [queries, lang]);
  const press = useCallback((l: ApiLead) => {
    if (!selecting) { onOpen(l.ref); return; }
    setSel((c) => { const n = { ...c }; if (n[l.ref]) delete n[l.ref]; else n[l.ref] = l; return n; });
  }, [selecting, onOpen]);
  const renderItem = useCallback(
    ({ item, index }: { item: ApiLead; index: number }) => <LeadItem coach={index === 0} lead={item} lang={lang} picked={selecting ? Boolean(sel[item.ref]) : undefined} onPress={press} onQuick={quick} onCall={callLead} onMark={markLead} />,
    [lang, selecting, sel, press, quick, callLead, markLead],
  );
  const listExtra = useMemo(() => ({ selecting, sel }), [selecting, sel]);

  const planState = usePlanState();
  const onNewLead = useCallback(() => {
    if (planState.phase === 'readonly') {
      usePlanLock.getState().show(new PlanLockedError('plan_readonly'));
      return;
    }
    nav.navigate('NewLead');
  }, [nav, planState.phase]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Icon name="search" size={18} color={colors.primaryInk} />
        <TextInput testID="leads-search" style={[styles.searchInput, { color: colors.text }]} value={text} onChangeText={setText} placeholder={t(lang, 'searchLeads')} placeholderTextColor={colors.muted} autoCorrect={false} returnKeyType="search" />
        {!list.isPending && (text.trim() !== q || (list.isFetching && !list.isFetchingNextPage && !list.isRefetching)) ? <ActivityIndicator color={colors.primaryInk} /> : null}
      </View>
      <View style={styles.chipsBox}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {manager ? (
            <Pressable testID="chip-unassigned" accessibilityRole="button" accessibilityState={{ selected: unassigned }} onPress={() => setUnassigned((u) => !u)} style={[styles.chip, { borderColor: unassigned ? colors.primaryLine : colors.border, backgroundColor: unassigned ? colors.primarySoft : 'transparent' }]}>
              <Text style={[styles.chipText, { color: unassigned ? colors.primaryInk : colors.text }]}>{t(lang, 'unassigned')}</Text>
            </Pressable>
          ) : null}
          {selection.highlight}
          {TABS.map(([v, k]) => (
            <Pressable key={v} testID={`lead-filter-${v}`} onLayout={selection.measure(v)} accessibilityRole="button" accessibilityState={{ selected: v === tab }} onPress={() => setTab(v)} style={[styles.chip, styles.countedChip, { borderColor: v === tab ? colors.primary : colors.border }, v === tab && !selection.highlight && greenGradient]}>
              <Text style={[styles.chipText, { color: v === tab ? colors.onPrimary : colors.muted }]}>{k.startsWith('st_') ? stageLabel(lang, k.slice(3)) : t(lang, k)}</Text>
              <Text testID={`lead-filter-count-${v}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.chipText, styles.chipCount, { color: v === tab ? colors.onPrimary : colors.muted }]}>
                {tabCounts?.[v] === undefined ? '' : `(${tabCounts[v]})`}
              </Text>
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
            renderItem={renderItem}
            extraData={listExtra}
            onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
            onEndReachedThreshold={0.6}
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => list.refetch()}
            ListEmptyComponent={<EmptyView icon="leads" title={t(lang, 'noLeads')} hint={t(lang, 'noLeadsHint')} actionLabel={t(lang, 'newLead')} onAction={onNewLead} />}
            ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primaryInk} /> : null}
          />
        )}
      </View>
      <View style={[styles.actions, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        {selecting ? (
          <>
            <View style={styles.flex}><Button testID="assign-selected" size="sm" label={`${t(lang, 'assignTo')} (${Object.keys(sel).length})`} disabled={!Object.keys(sel).length} onPress={() => setAssigning(true)} /></View>
            <Button testID="select-done" size="sm" variant="secondary" label={t(lang, 'doneSelect')} onPress={() => { setSelecting(false); setSel({}); }} />
          </>
        ) : (
          <>
            <View style={styles.flex}><Button testID="new-lead" size="sm" label={t(lang, 'newLead')} onPress={onNewLead} /></View>
            {manager ? <Button testID="select-leads" size="sm" variant="secondary" label={t(lang, 'selectLeads')} onPress={() => setSelecting(true)} /> : null}
          </>
        )}
      </View>
      {assigning ? <BulkAssign leads={Object.values(sel)} onCancel={() => setAssigning(false)} onDone={() => { setAssigning(false); setSelecting(false); setSel({}); tick(); queries.invalidateQueries({ queryKey: ['leads'] }); }} /> : null}
    </View>
  );
}

/** One row: swipe to call or mark called, tap to open, press and hold for the quick menu. */
const LeadItem = memo(function LeadItem({ coach, lead, lang, picked, onPress, onQuick, onCall, onMark }: { coach?: boolean; lead: ApiLead; lang: Lang; picked?: boolean; onPress: (l: ApiLead) => void; onQuick: (l: ApiLead) => void; onCall: (l: ApiLead) => void; onMark: (l: ApiLead) => void }) {
  const slot = useRef<React.ComponentRef<typeof View>>(null);
  return (
    <View ref={slot} collapsable={false} style={styles.cardSlot}>
      {coach ? <CoachMark id="leadSwipe" targetRef={slot} text={t(lang, 'coachSwipe')} /> : null}
      <SwipeRow rightLabel={t(lang, 'quickCall')} leftLabel={t(lang, 'markCalled')} onSwipeRight={() => onCall(lead)} onSwipeLeft={() => onMark(lead)}>
        <LeadCard lead={lead} lang={lang} selected={picked} phoneVisibility="full" onPress={() => onPress(lead)} onLongPress={() => onQuick(lead)} />
      </SwipeRow>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm, minHeight: 46, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, minHeight: 44, paddingVertical: spacing.xs, fontSize: 14 },
  chipsBox: { height: 48 },
  chips: { gap: spacing.xs, paddingHorizontal: spacing.lg },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, height: 40, justifyContent: 'center' },
  countedChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chipText: { fontSize: 12, fontWeight: '700' },
  // Counts can change digit width as a search updates without moving the filter pills.
  chipCount: { width: 32, textAlign: 'center', fontVariant: ['tabular-nums'] },
  cardSlot: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: radius.card, overflow: 'hidden' },
  footer: { padding: spacing.lg },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
