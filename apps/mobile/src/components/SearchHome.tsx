import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError, type Lang, type LeadQueue, type SearchHomeData, type SearchHomePriority } from '@wehdathub/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { t } from '../i18n';
import { usage } from '../usage';
import type { RootStackParams } from '../navigation';
import { useRightsState } from '../rights';
import { useColumns, useWide } from '../layout';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Icon, type IconName } from './Icon';
import { Card } from './Card';
import { PressableScale } from './PressableScale';
import { HomeRow } from './HomeRow';
import { SectionCard, UrgencyBadge } from './SectionCard';
import { OldUnitActions } from './TodayCards';
import { StarterCard, useStarterDismissed } from './StarterCard';
import { DecisionCard } from './DecisionCard';
import { allClearLine, decisionSummary, formatPriority, nextStepForRole, priorityPrompt, priorityTitle, type PriorityView } from '../assistant/priorityCopy';
import { TodayCall, TodayDetails } from './TodayDetails';

interface DiscoveryTip {
  id: string;
  label: string;
  query: string;
  icon: IconName;
}

const TIPS_STORAGE_PREFIX = 'wehdathub.learnedTips';

function tipsForRole(
  role: string | undefined,
  lang: Lang,
  gates: { canTeam: boolean; canSources: boolean; canWinLoss: boolean; isSolo: boolean },
): DiscoveryTip[] {
  const r = (role ?? '').toLowerCase();
  if (r === 'data_entry') {
    return [
      { id: 'de-confirm', icon: 'units', label: t(lang, 'sh_tipConfirm'), query: t(lang, 'sh_qConfirm') },
      { id: 'de-photos', icon: 'units', label: t(lang, 'pc_photos'), query: t(lang, 'sh_qPhotos') },
    ];
  }
  if (r === 'owner' || r === 'manager' || r === 'admin') {
    return [
      { id: 'mgr-overdue', icon: 'bell', label: priorityTitle('overdue', lang), query: priorityPrompt('overdue', lang) ?? '' },
      ...(gates.canTeam && !gates.isSolo ? [{ id: 'mgr-team', icon: 'team' as const, label: t(lang, 'sh_tipTeam'), query: t(lang, 'sh_qTeam') }] : []),
      { id: 'mgr-dashboard', icon: 'dashboard', label: t(lang, gates.isSolo ? 'sh_tipStats' : 'sh_tipAgency'), query: t(lang, gates.isSolo ? 'sh_qStats' : 'sh_qAgency') },
      ...(gates.canSources && !gates.isSolo ? [{ id: 'mgr-sources', icon: 'link' as const, label: t(lang, 'sh_tipSources'), query: t(lang, 'sh_qSources') }] : []),
      ...(gates.canWinLoss && !gates.isSolo ? [{ id: 'mgr-losses', icon: 'chart' as const, label: t(lang, 'sh_tipLosses'), query: t(lang, 'sh_qLosses') }] : []),
    ];
  }
  if (r === 'team_lead') {
    return [
      { id: 'tl-overdue', icon: 'bell', label: priorityTitle('overdue', lang), query: priorityPrompt('overdue', lang) ?? '' },
      { id: 'tl-uncontacted', icon: 'leads', label: t(lang, 'pq_newLeads'), query: priorityPrompt('new-leads', lang) ?? '' },
      { id: 'tl-resale', icon: 'search', label: t(lang, 'sh_tipVilla'), query: t(lang, 'sh_qVilla') },
    ];
  }
  return [
    { id: 'brk-today', icon: 'chat', label: t(lang, 'sh_tipFollow'), query: t(lang, 'sh_qFollow') },
    { id: 'brk-resale', icon: 'search', label: t(lang, 'sh_tipApt'), query: t(lang, 'sh_qApt') },
  ];
}

export function SearchHome({ openQueue, onTryPrompt, invitation, children }: {
  openQueue: (queue: LeadQueue) => void;
  onTryPrompt?: (prompt: string) => void;
  invitation?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const broker = useAuth((s) => s.broker);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const focused = useIsFocused();
  const lang: Lang = broker?.lang === 'en' ? 'en' : 'ar';
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const n = (value: number) => value.toLocaleString(locale);
  const [all, setAll] = useState(false);
  const queries = useQueryClient();
  const grid = useColumns() >= 2;
  const wide = useWide();

  const tipsKey = broker?.id ? `${TIPS_STORAGE_PREFIX}:${broker.id}:${broker.role}` : null;
  const [learnedTips, setLearnedTips] = useState<string[] | null>(null);
  useEffect(() => {
    let active = true;
    if (!tipsKey) {
      setLearnedTips(null);
      return;
    }
    AsyncStorage.getItem(tipsKey)
      .then((raw) => {
        if (!active) return;
        const parsed = raw ? JSON.parse(raw) : [];
        setLearnedTips(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
      })
      .catch(() => {
        if (active) setLearnedTips([]);
      });
    return () => { active = false; };
  }, [tipsKey]);

  const markTipLearned = (tipId: string) => {
    setLearnedTips((prev) => {
      const next = prev ? (prev.includes(tipId) ? prev : [...prev, tipId]) : [tipId];
      if (tipsKey) AsyncStorage.setItem(tipsKey, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  };

  const home = useQuery({
    queryKey: ['today', 'home', broker?.id, lang],
    queryFn: async (): Promise<Partial<SearchHomeData> & { legacy?: true }> => {
      try {
        return await api.searchHome();
      } catch (error) {
        if (!(error instanceof ApiClientError) || error.status !== 404) throw error;
        // Older servers expose the scoped Today data without the dedicated brief.
        const today = await queries.fetchQuery({ queryKey: ['today'], queryFn: () => api.today(), staleTime: 30_000 });
        const now = Date.now();
        return {
          legacy: true,
          units: today.cards?.oldUnits,
          ops: today.cards?.ops,
          overdue: today.moreTasks === 0 ? today.tasks.filter((task) => task.kind === 'late').length : undefined,
          calls: today.counts.followUpsToday - today.counts.viewings,
          newLeads: today.counts.newLeads,
          nextViewing: today.tasks.find((task) => task.kind === 'viewing' && task.at && Date.parse(task.at) >= now),
        };
      }
    },
    enabled: focused && Boolean(broker?.id), refetchInterval: 300_000, staleTime: 0,
  });
  const overdue = useInfiniteQuery({
    queryKey: ['today', 'overdue-units', broker?.id, lang], queryFn: ({ pageParam }) => api.overdueUnits(pageParam),
    enabled: all && focused, initialPageParam: 0, staleTime: 0,
    getNextPageParam: (page, pages) => {
      const loaded = pages.reduce((total, item) => total + item.items.length, 0);
      return page.items.length && loaded < page.total ? loaded : undefined;
    },
  });

  const data = home.data;
  const hour = data?.hour ?? Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const evening = hour >= 17;
  const morning = hour < 12;
  const greeting = t(lang, evening ? 'sh_greetEve' : morning ? 'sh_greetMorn' : 'sh_greetDay');
  const name = broker?.name?.trim().split(/\s+/)[0];
  const date = new Intl.DateTimeFormat(locale, { timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const entry = broker?.role === 'data_entry';
  const manager = ['owner', 'manager', 'admin'].includes(broker?.role ?? '');
  const total = all ? overdue.data?.pages[0]?.total ?? data?.units?.total ?? 0 : data?.units?.total ?? 0;

  const row = (key: string, title: string, onPress: () => void) => (
    <HomeRow key={key} testID={key} title={title} onPress={onPress} />
  );

  const openPriorityAction = (p: SearchHomePriority, v: PriorityView) => {
    usage('home_priority_tapped', true, undefined, { screen: p.id });
    if (onTryPrompt && v.chatFirst && v.prompt) {
      onTryPrompt(v.prompt);
      return;
    }
    const a = p.action;
    if (a.kind === 'queue') openQueue(a.queue);
    else if (a.kind === 'leads_tab') nav.navigate('LeadsList', { tab: a.tab });
    else if (a.kind === 'screen') {
      if (a.screen === 'Commissions') nav.navigate('Commissions', { kind: 'developers', overdue: Number(p.extra?.overdue || 0) > 0 });
      else nav.navigate(a.screen);
    }
    else if (a.kind === 'lead') nav.navigate('Lead', { ref: a.ref });
    else if (a.kind === 'units_missing_photos') nav.navigate('UnitsList', { missingPhotos: true });
    else if (a.kind === 'units_old') nav.navigate('UnitsList', { old: true });
  };

  const askAbout = (p: SearchHomePriority, v: PriorityView) => {
    usage('home_tip_tapped', true);
    if (onTryPrompt && v.prompt) onTryPrompt(v.prompt);
  };

  const rows: React.ReactNode[] = [];
  const next = data?.nextViewing;
  const serverPriorities = !entry && Array.isArray(data?.priorities) ? data.priorities : null;
  // Older servers send no priorities: build the same items from the raw counts.
  const legacyPriorities = (): SearchHomePriority[] => {
    if (!data || entry || serverPriorities) return [];
    const ops = data.ops;
    const late = ops?.overdue ?? data.overdue;
    const item = (id: string, urgency: SearchHomePriority['urgency'], count: number | undefined, action: SearchHomePriority['action'], extra?: SearchHomePriority['extra']): SearchHomePriority[] =>
      count ? [{ id, urgency, count, action, extra }] : [];
    return [
      ...item('unassigned', 'high', ops?.unassigned, { kind: 'queue', queue: 'unassigned' }),
      ...item('uncontacted-old', 'high', ops?.uncontactedOld, { kind: 'queue', queue: 'delayed-first-contact' }),
      ...item('overdue', 'high', late, { kind: 'leads_tab', tab: 'overdue' }),
      ...(next?.at ? item('next-viewing', 'medium', 1, { kind: 'lead', ref: next.ref }, { ref: next.ref, name: next.name ?? null, unitCode: next.unitCode ?? null, phone: next.phone ?? null, at: next.at }) : []),
      ...item('tomorrow-viewings', 'low', data.tomorrowViewings, { kind: 'queue', queue: 'viewings-tomorrow' }),
      ...item('calls', 'medium', data.calls, { kind: 'leads_tab', tab: 'due_today' }),
      ...(ops?.uncontactedOld ? [] : item('new-leads', 'medium', data.newLeads, { kind: 'queue', queue: 'uncontacted' })),
    ];
  };
  // Ids this app version does not know are dropped, never shown raw.
  const decisions = (serverPriorities ?? legacyPriorities())
    .map((p) => ({ p, v: formatPriority(p, lang) }))
    .filter((x): x is { p: SearchHomePriority; v: PriorityView } => x.v !== null);

  if (entry) {
    const units = all ? overdue.data?.pages.flatMap((page) => page.items) ?? [] : data?.units?.items ?? [];
    for (const unit of units) {
      rows.push(<HomeRow key={unit.code} testID={`home-unit-${unit.code}`} title={unit.code} detail={unit.line} icon="units"
        value={unit.hidden ? t(lang, 'tcHidden') : `${n(unit.days)} ${t(lang, 'tcDays')}`} onPress={() => nav.navigate('Unit', { code: unit.code })}>
        <OldUnitActions code={unit.code} />
      </HomeRow>);
    }
    if (!all && data?.missingPhotos) {
      rows.push(<HomeRow key="home-missing-photos" testID="home-missing-photos" title={t(lang, 'pc_photos')} value={n(data.missingPhotos)} icon="units"
        onPress={() => nav.navigate('UnitsList', { missingPhotos: true })} />);
    }
  } else {
    decisions.forEach(({ p, v }, i) => {
      const isViewing = p.id === 'next-viewing';
      rows.push(
        <DecisionCard
          key={v.testID}
          testID={v.testID}
          index={i}
          urgency={p.urgency}
          label={isViewing ? v.value : t(lang, p.urgency === 'high' ? 'pc_urgent' : p.urgency === 'medium' ? 'pc_today' : 'pc_update')}
          value={isViewing ? undefined : v.value}
          title={v.title}
          why={[p.why, v.detail].filter(Boolean).join(' · ') || undefined}
          icon={v.icon}
          primary={{ label: t(lang, 'pc_open'), onPress: () => openPriorityAction(p, v) }}
          secondary={!v.chatFirst && v.prompt && onTryPrompt ? { label: t(lang, 'pc_ask'), testID: `${v.testID}-ask`, onPress: () => askAbout(p, v) } : undefined}
          extra={v.callPhone ? <TodayCall phone={v.callPhone} label={t(lang, 'call')} /> : null}
        />,
      );
    });
  }

  const { rights, nav: serverNav, workspace } = useRightsState();
  const isSolo = Boolean(workspace?.solo || workspace?.mode === 'solo');
  const hasNavApp = (app: string) => Boolean(serverNav && (serverNav.tabs.some((x) => x.app === app) || serverNav.groups.some((g) => g.items.some((i) => i.app === app))));
  const canTeam = !isSolo && (rights.team || hasNavApp('Team'));
  const canSources = !isSolo && hasNavApp('Sources');
  const canWinLoss = !isSolo && hasNavApp('WinLoss');

  const urgentCount = useMemo(
    () => decisions.filter(({ p }) => p.urgency === 'high').length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );
  const hasPriority = (id: string) => decisions.some(({ p }) => p.id === id);
  const decisionCount = data?.summary?.decisions ?? decisions.filter(({ p }) => p.urgency !== 'low').length;
  const metrics = entry || !data ? [] : [
    { key: 'calls', label: t(lang, 'followUps'), value: data.calls ?? 0 },
    { key: 'new', label: t(lang, 'newLeads'), value: data.newLeads ?? 0 },
    { key: 'late', label: t(lang, 'late'), value: data.ops?.overdue ?? data.overdue ?? 0 },
    ...(wide ? [{ key: 'urgent', label: t(lang, 'urgentTile'), value: urgentCount }] : []),
  ];
  const nextStep = nextStepForRole(broker?.role, lang);
  const runNextStep = () => {
    if (nextStep.action === 'add-unit') nav.navigate('AddUnit');
    else if (nextStep.action === 'share-unit') nav.navigate('UnitsList', {});
    else nav.navigate('LeadsList', { tab: 'all' });
  };

  const untriedTips = useMemo(() => {
    if (!onTryPrompt || learnedTips === null) return [];
    const learned = new Set(learnedTips);
    return tipsForRole(broker?.role, lang, { canTeam, canSources, canWinLoss, isSolo }).filter((tip) => !learned.has(tip.id)).slice(0, 2);
  }, [onTryPrompt, learnedTips, broker?.role, lang,canTeam, canSources, canWinLoss, isSolo]);

  const heading = t(lang, entry ? 'sh_headEntry' : 'sh_headPrio');
  const completed = data?.completed;
  const summary = completed === undefined ? null
    : t(lang, entry ? 'sh_doneEntry' : manager ? 'sh_doneMgr' : 'sh_doneBroker').replace('{n}', n(completed));
  const refresh = all ? overdue : home;
  const loading = all ? overdue.isPending : home.isPending && Boolean(broker?.id);
  const failed = refresh.isError && !refresh.data;

  const [starterDismissed, dismissStarter] = useStarterDismissed(broker?.id);
  const meQ = useQuery({ queryKey: ['me'], queryFn: ({ signal }) => api.me(signal), staleTime: 60_000 });
  const planQ = useQuery({ queryKey: ['plan'], queryFn: () => api.plan(), enabled: rights.manager || rights.agencyOwner, staleTime: 60_000 });
  const onboarding = meQ.data?.onboarding;
  const trialDaysLeft = useMemo(() => {
    const a = planQ.data?.allowance;
    if (!a || a.source !== 'trial' || !a.until) return null;
    return Math.max(0, Math.ceil((new Date(a.until).getTime() - Date.now()) / 86_400_000));
  }, [planQ.data]);

  return (
    <ScrollView testID="search-home" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refresh.isRefetching} onRefresh={async () => { await Promise.all([refresh.refetch(), queries.refetchQueries({ queryKey: ['today'], exact: true, type: 'active' })]); }} />}>
      <View style={styles.topRow}>
        <Text variant="bodySm" weight="bold" style={{ color: colors.muted }}>{date}</Text>
        {trialDaysLeft !== null ? (
          <Pressable testID="trial-status-pill" onPress={() => nav.navigate('Usage')} style={[styles.trialPill, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text variant="caption" weight="bold" style={{ color: trialDaysLeft <= 3 ? colors.warn : colors.muted }}>
              {`${t(lang, 'trialPill')} · ${n(trialDaysLeft)}${t(lang, 'sh_daysShort')}`}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text accessibilityRole="header" variant="display" style={{ color: colors.text }}>{greeting}{name ? t(lang, 'sh_withName').replace('{n}', name) : ''}</Text>
      {!all && !starterDismissed && onboarding ? (
        <StarterCard
          onboarding={onboarding}
          onAddUnit={() => nav.navigate('AddUnit')}
          onShareSample={() => nav.navigate('UnitsList', {})}
          onConnectTelegram={() => nav.navigate('ConnectTelegram')}
          onAsk={() => (nav.navigate as (...a: unknown[]) => void)('Tabs', { screen: 'Search', params: { at: Date.now() } })}
          onAddPhotos={() => nav.navigate('UnitsList', { missingPhotos: true })}
          onDismiss={dismissStarter}
        />
      ) : null}
      {!all ? invitation : null}
      {!entry && !all && !loading && !failed && data ? (
        <Text testID="home-decisions" variant="body" style={{ color: colors.muted }}>{decisionSummary(decisionCount, lang)}</Text>
      ) : null}
      {!all && !loading && !failed && metrics.length ? (
        <View testID="home-metrics" style={styles.metrics}>
          {metrics.map((m) => (
            <Card key={m.key} testID={`home-metric-${m.key}`} style={styles.metric}>
              <Text variant="title" style={{ color: colors.text }}>{n(m.value)}</Text>
              <Text variant="caption" style={{ color: colors.muted }}>{m.label}</Text>
            </Card>
          ))}
        </View>
      ) : null}
      {summary && !all ? <Text style={{ color: colors.muted }}>{summary}</Text> : null}
      <View style={styles.brief}>
        {!loading && !failed && entry ? <>
          <HomeRow testID="home-overdue-total" title={heading} value={n(total)} icon="units" featured />
          {!all && total > 0 ? <Text accessibilityRole="header" variant="body" weight="bold" style={[styles.sectionTitle, { color: colors.text }]}>{t(lang, 'sh_longest')}</Text> : null}
        </> : null}
        {!entry || loading || failed ? (
          <View style={styles.sectionHead}>
            <Text accessibilityRole="header" variant="body" weight="bold" style={[styles.sectionTitle, { color: colors.text }]}>{heading}</Text>
            {urgentCount > 0 ? <UrgencyBadge testID="home-urgent-badge" tone="critical" label={t(lang, 'sh_urgentN').replace('{n}', n(urgentCount))} /> : null}
          </View>
        ) : null}
        {loading ? <Card style={styles.loading}><ActivityIndicator accessibilityLabel={t(lang, 'loading')} color={colors.spinner} /></Card> :
          failed ? row('home-retry', t(lang, 'sh_retry'), () => { refresh.refetch(); }) :
          rows.length ? (grid && !entry ? <View style={styles.grid}>{rows.map((r, i) => <View key={(r as React.ReactElement).key ?? i} style={styles.cell}>{r}</View>)}</View> : rows) :
            <Card testID="home-all-clear" style={styles.clear}>
              <Icon name="check" size={20} color={colors.primaryInk} />
              <Text variant="body" weight="bold" style={{ color: colors.text }}>{entry ? t(lang, 'sh_allUnitsOk') : allClearLine(lang)}</Text>
              <PressableScale testID="home-next-step" onPress={runNextStep} style={[styles.nextBtn, { backgroundColor: colors.primary }]}>
                <Text variant="bodySm" weight="bold" style={{ color: colors.onPrimary }}>{nextStep.label}</Text>
              </PressableScale>
            </Card>}
        {entry && !all && total > 0 ? row('home-all-units',
          t(lang, data?.legacy ? 'openUnits' : 'sh_viewAllOverdue'),
          () => { if (data?.legacy) nav.navigate('UnitsList', { old: true }); else setAll(true); }) : null}
        {all && overdue.hasNextPage ? row('home-more-units', overdue.isFetchingNextPage ? t(lang, 'loading') : t(lang, 'sh_moreUnits'),
          () => { if (!overdue.isFetchingNextPage) overdue.fetchNextPage(); }) : null}
        {all ? row('home-back', t(lang, 'sh_back'), () => setAll(false)) : null}
      </View>
      {!all ? (
        <TodayDetails
          suppressLoading={loading}
          brief={failed ? undefined : {
            ops: Boolean(data?.ops) || hasPriority('waiting-over-1h') || hasPriority('overdue'),
            units: entry && Boolean(data?.units),
            viewing: !entry && next?.at ? next : null,
            approvalsAccess: hasPriority('approvals'),
            approvalsNames: hasPriority('owner-names'),
            commissions: hasPriority('commissions'),
            leases: hasPriority('leases-soon'),
          }}
        />
      ) : null}
      {!all && untriedTips.length && onTryPrompt ? (
        <Animated.View entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}>
          <SectionCard
            testID="try-asking-card"
            title={t(lang, 'sh_tryAsking')}
            subtitle={t(lang, 'sh_tryAskingHint')}
          >
            {untriedTips.map((tip) => (
              <View key={tip.id} style={styles.tipRow}>
                <Pressable
                  testID={`try-tip-${tip.id}`}
                  accessibilityRole="button"
                  onPress={() => {
                    usage('home_tip_tapped', true);
                    markTipLearned(tip.id);
                    onTryPrompt(tip.query);
                  }}
                  style={({ pressed }) => [styles.tipBtn, { backgroundColor: colors.cardSubtle, borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}
                >
                  <Icon name={tip.icon} size={16} color={colors.primaryInk} />
                  <Text variant="bodySm" weight="bold" style={[styles.tipText, { color: colors.text }]}>{tip.label}</Text>
                </Pressable>
                <Pressable
                  testID={`try-tip-dismiss-${tip.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t(lang, 'sh_dismissTip')}
                  hitSlop={6}
                  onPress={() => {
                    usage('home_tip_dismissed', true);
                    markTipLearned(tip.id);
                  }}
                  style={({ pressed }) => [styles.tipDismiss, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Icon name="cross" size={14} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </SectionCard>
        </Animated.View>
      ) : null}
      {!all ? children : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: 90, gap: spacing.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trialPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  brief: { marginTop: spacing.md, gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sectionTitle: { paddingVertical: spacing.xs },
  loading: { minHeight: 52, justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexBasis: '48%', flexGrow: 1 },
  metrics: { flexDirection: 'row', gap: spacing.sm },
  metric: { flex: 1, padding: spacing.md, gap: spacing.xs },
  clear: { gap: spacing.sm, alignItems: 'flex-start' },
  nextBtn: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tipBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 44 },
  tipText: { flex: 1 },
  tipDismiss: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
