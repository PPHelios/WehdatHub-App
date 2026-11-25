import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError, type LeadQueue, type SearchHomeData, type SearchHomePriority } from '@wehdathub/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { t } from '../i18n';
import { usage } from '../usage';
import type { RootStackParams } from '../navigation';
import { useRightsState } from '../rights';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Icon, type IconName } from './Icon';
import { HomeRow } from './HomeRow';
import { SectionCard, UrgencyBadge } from './SectionCard';
import { OldUnitActions } from './TodayCards';
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
  ar: boolean,
  gates: { canTeam: boolean; canSources: boolean; canWinLoss: boolean; isSolo: boolean },
): DiscoveryTip[] {
  const r = (role ?? '').toLowerCase();
  if (r === 'data_entry') {
    return [
      { id: 'de-confirm', icon: 'units', label: ar ? 'وحدات محتاجة تأكيد' : 'Units needing confirmation', query: ar ? 'وحدات محتاجة مراجعة' : 'units to check' },
      { id: 'de-photos', icon: 'units', label: ar ? 'وحدات من غير صور' : 'Units missing photos', query: ar ? 'وحدات من غير صور' : 'missing photos' },
    ];
  }
  if (r === 'owner' || r === 'manager' || r === 'admin') {
    return [
      { id: 'mgr-overdue', icon: 'bell', label: ar ? 'المتابعات المتأخرة' : 'Overdue follow-ups', query: ar ? 'متابعات متأخرة' : 'overdue follow-ups' },
      ...(gates.canTeam && !gates.isSolo ? [{ id: 'mgr-team', icon: 'team' as const, label: ar ? 'أداء وشغل الفريق' : 'Team workload', query: ar ? 'شغل الفريق' : 'team workload' }] : []),
      { id: 'mgr-dashboard', icon: 'dashboard', label: gates.isSolo ? (ar ? 'إحصائياتي' : 'My stats') : (ar ? 'لوحة أداء الشركة' : 'Agency dashboard'), query: gates.isSolo ? (ar ? 'ملخصي' : 'my stats') : (ar ? 'لوحة الشركة' : 'agency dashboard') },
      ...(gates.canSources && !gates.isSolo ? [{ id: 'mgr-sources', icon: 'link' as const, label: ar ? 'أداء مصادر العملاء' : 'Lead sources performance', query: ar ? 'مصادر العملاء' : 'lead sources' }] : []),
      ...(gates.canWinLoss && !gates.isSolo ? [{ id: 'mgr-losses', icon: 'chart' as const, label: ar ? 'أسباب خسارة الصفقات' : 'Deal win/loss reasons', query: ar ? 'أسباب الخسارة' : 'win/loss' }] : []),
    ];
  }
  if (r === 'team_lead') {
    return [
      { id: 'tl-overdue', icon: 'bell', label: ar ? 'المتابعات المتأخرة' : 'Overdue follow-ups', query: ar ? 'متابعات متأخرة' : 'overdue follow-ups' },
      { id: 'tl-uncontacted', icon: 'leads', label: ar ? 'عملاء لسه محدش كلمهم' : 'Uncontacted leads', query: ar ? 'عملاء محدش كلمهم' : 'uncontacted leads' },
      { id: 'tl-resale', icon: 'search', label: ar ? 'فيلا للبيع في زايد' : 'Villa for sale in Zayed', query: ar ? 'فيلا للبيع في زايد' : 'villa for sale in Zayed' },
    ];
  }
  return [
    { id: 'brk-today', icon: 'chat', label: ar ? 'متابعات ومكالمات النهارده' : 'Follow-ups due today', query: ar ? 'متابعات النهارده' : 'follow-ups today' },
    { id: 'brk-photos', icon: 'units', label: ar ? 'وحدات ناقصها صور' : 'Units missing photos', query: ar ? 'وحدات من غير صور' : 'missing photos' },
    { id: 'brk-resale', icon: 'search', label: ar ? 'شقة أقل من 5 مليون' : 'Apartments under 5M', query: ar ? 'شقة أقل من 5 مليون' : 'apartment under 5m' },
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
  const ar = broker?.lang !== 'en';
  const lang = ar ? 'ar' : 'en';
  const locale = ar ? 'ar-EG' : 'en-GB';
  const n = (value: number) => value.toLocaleString(locale);
  const [all, setAll] = useState(false);
  const queries = useQueryClient();

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
  const greeting = ar ? (evening ? 'مساء الخير' : morning ? 'صباح الخير' : 'أهلاً') : evening ? 'Good evening' : morning ? 'Good morning' : 'Good afternoon';
  const name = broker?.name?.trim().split(/\s+/)[0];
  const date = new Intl.DateTimeFormat(locale, { timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const entry = broker?.role === 'data_entry';
  const manager = ['owner', 'manager', 'admin'].includes(broker?.role ?? '');
  const total = all ? overdue.data?.pages[0]?.total ?? data?.units?.total ?? 0 : data?.units?.total ?? 0;

  const row = (key: string, title: string, onPress: () => void) => (
    <HomeRow key={key} testID={key} title={title} onPress={onPress} />
  );

  const openPriorityAction = (p: SearchHomePriority) => {
    usage('home_priority_tapped', true, undefined, { screen: p.id });
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

  const formatPriority = (p: SearchHomePriority): { testID: string; title: string; detail?: string; value: string; icon: IconName; callPhone?: string | null } => {
    const extra = p.extra ?? {};
    switch (p.id) {
      case 'unassigned':
        return { testID: 'home-unassigned', title: ar ? 'عملاء من غير وسيط' : 'Unassigned leads', value: n(p.count), icon: 'user-plus' };
      case 'waiting-over-1h': {
        const over24 = Number(extra.over24h || 0);
        return {
          testID: 'home-waiting-1h',
          title: ar ? 'عملاء مستنين رد (> ساعة)' : 'Waiting > 1h for first contact',
          detail: over24 > 0 ? (ar ? `منهم ${n(over24)} أكتر من ٢٤ ساعة` : `Includes ${n(over24)} over 24h`) : undefined,
          value: n(p.count),
          icon: 'pulse',
        };
      }
      case 'uncontacted-old':
        return { testID: 'home-uncontacted', title: ar ? 'تأخر أول تواصل' : 'Delayed first contact', detail: ar ? 'أكتر من ٢٤ ساعة' : 'Over 24 hours', value: n(p.count), icon: 'pulse' };
      case 'overdue':
        return { testID: 'home-late', title: ar ? 'متابعات متأخرة' : 'Overdue follow-ups', value: n(p.count), icon: 'bell' };
      case 'intake': {
        const disc = Number(extra.disconnected || 0);
        const fail = Number(extra.failed || 0);
        const parts = [
          disc > 0 ? (ar ? `${n(disc)} قناة مفصولة` : `${n(disc)} disconnected`) : '',
          fail > 0 ? (ar ? `${n(fail)} عميل فشل` : `${n(fail)} failed`) : '',
        ].filter(Boolean);
        return {
          testID: 'home-intake',
          title: ar ? 'مشكلة في استقبال العملاء' : 'Lead intake alert',
          detail: parts.join(' · ') || undefined,
          value: n(p.count),
          icon: 'link',
        };
      }
      case 'approvals':
        return {
          testID: 'home-approvals',
          title: ar ? 'طلبات كشف التفاصيل' : 'Access requests awaiting approval',
          value: n(p.count),
          icon: 'lock',
        };
      case 'owner-names':
        return {
          testID: 'home-owner-names',
          title: ar ? 'طلبات تعديل أسماء الملاك' : 'Owner name edits awaiting approval',
          value: n(p.count),
          icon: 'owners',
        };
      case 'commissions':
        return { testID: 'home-commissions', title: ar ? 'عمولات مطورين للمتابعة' : 'Developer commissions due', value: n(p.count), icon: 'money' };
      case 'leases-soon':
        return { testID: 'home-leases', title: ar ? 'عقود إيجار قربت تخلص' : 'Leases ending soon', value: n(p.count), icon: 'calendar' };
      case 'tomorrow-viewings':
        return { testID: 'home-tomorrow', title: ar ? 'معاينات بكرة' : 'Viewings tomorrow', value: n(p.count), icon: 'calendar' };
      case 'calls':
        return { testID: 'home-calls', title: ar ? 'مكالمات النهارده' : 'Calls due today', value: n(p.count), icon: 'chat' };
      case 'new-leads':
        return { testID: 'home-new-leads', title: ar ? 'عملاء جداد لسه محدش كلمهم' : 'New leads awaiting contact', value: n(p.count), icon: 'leads' };
      case 'missing-photos':
        return { testID: 'home-missing-photos', title: ar ? 'وحدات من غير صور' : 'Units missing photos', value: n(p.count), icon: 'units' };
      case 'next-viewing': {
        const validDate = typeof extra.at === 'string' && Number.isFinite(Date.parse(extra.at));
        const at = validDate ? new Date(extra.at as string).toLocaleTimeString(locale, { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' }) : '';
        return {
          testID: 'home-viewing',
          title: ar ? 'المعاينة الجاية' : 'Next viewing',
          detail: [extra.name ?? extra.ref, extra.unitCode].filter(Boolean).join(' · ') || undefined,
          value: at || n(1),
          icon: 'calendar',
          callPhone: typeof extra.phone === 'string' ? extra.phone : null,
        };
      }
      default:
        return { testID: `home-priority-${p.id}`, title: p.id, value: n(p.count), icon: 'bell' };
    }
  };

  const rows: React.ReactNode[] = [];
  const priority = (key: string, title: string, detail: string | undefined, onPress: () => void, value: number, icon: IconName, urgent = false, allowFeatured = true) => {
    rows.push(<HomeRow key={key} testID={key} title={title} detail={detail} onPress={onPress} value={n(value)} icon={icon} urgent={urgent} featured={allowFeatured && rows.length === 0} />);
  };
  const next = data?.nextViewing;
  const serverPriorities = !entry && Array.isArray(data?.priorities) ? data.priorities : null;

  if (entry) {
    const units = all ? overdue.data?.pages.flatMap((page) => page.items) ?? [] : data?.units?.items ?? [];
    for (const unit of units) {
      rows.push(<HomeRow key={unit.code} testID={`home-unit-${unit.code}`} title={unit.code} detail={unit.line} icon="units"
        value={unit.hidden ? t(lang, 'tcHidden') : `${n(unit.days)} ${t(lang, 'tcDays')}`} onPress={() => nav.navigate('Unit', { code: unit.code })}>
        <OldUnitActions code={unit.code} />
      </HomeRow>);
    }
    if (!all && data?.missingPhotos) {
      priority('home-missing-photos', ar ? 'وحدات من غير صور' : 'Units missing photos', undefined, () => nav.navigate('UnitsList', { missingPhotos: true }), data.missingPhotos, 'units', false, false);
    }
  } else if (serverPriorities) {
    for (const p of serverPriorities) {
      const cfg = formatPriority(p);
      rows.push(
        <HomeRow
          key={cfg.testID}
          testID={cfg.testID}
          title={cfg.title}
          detail={cfg.detail}
          value={cfg.value}
          icon={cfg.icon}
          urgent={p.urgency === 'high'}
          featured={rows.length === 0}
          onPress={() => openPriorityAction(p)}
        >
          {cfg.callPhone ? <TodayCall phone={cfg.callPhone} label={t(lang, 'call')} /> : null}
        </HomeRow>,
      );
    }
  } else if (data) {
    const ops = data.ops;
    if (ops?.unassigned) priority('home-unassigned', ar ? 'عملاء من غير وسيط' : 'Unassigned leads', undefined, () => openQueue('unassigned'), ops.unassigned, 'user-plus', true);
    if (ops?.uncontactedOld) priority('home-uncontacted', ar ? 'تأخر أول تواصل' : 'Delayed first contact', ar ? 'أكتر من ٢٤ ساعة' : 'Over 24 hours', () => openQueue('delayed-first-contact'), ops.uncontactedOld, 'pulse', true);
    const late = ops?.overdue ?? data.overdue;
    if (late) priority('home-late', ar ? 'متابعات متأخرة' : 'Overdue follow-ups', undefined, () => nav.navigate('LeadsList', { tab: 'overdue' }), late, 'bell', true);
    if (next?.at) {
      const at = new Date(next.at).toLocaleTimeString(locale, { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' });
      rows.push(<HomeRow key="home-viewing" testID="home-viewing" title={ar ? 'المعاينة الجاية' : 'Next viewing'}
        detail={[next.name ?? next.ref, next.unitCode].filter(Boolean).join(' · ')}
        onPress={() => nav.navigate('Lead', { ref: next.ref })} value={at} icon="calendar" featured={rows.length === 0}>
        {next.phone ? <TodayCall phone={next.phone} label={t(lang, 'call')} /> : null}
      </HomeRow>);
    }
    if (data.tomorrowViewings) priority('home-tomorrow', ar ? 'معاينات بكرة' : 'Viewings tomorrow', undefined, () => openQueue('viewings-tomorrow'), data.tomorrowViewings, 'calendar');
    if (data.calls) priority('home-calls', ar ? 'مكالمات النهارده' : 'Calls due today', undefined, () => nav.navigate('LeadsList', { tab: 'due_today' }), data.calls, 'chat');
    if (data.newLeads && !ops?.uncontactedOld) priority('home-new-leads', ar ? 'عملاء عندك لسه محدش كلمهم' : 'Your leads awaiting first contact', undefined, () => openQueue('uncontacted'), data.newLeads, 'leads');
  }

  const { rights, nav: serverNav, workspace } = useRightsState();
  const isSolo = Boolean(workspace?.solo || workspace?.mode === 'solo');
  const hasNavApp = (app: string) => Boolean(serverNav && (serverNav.tabs.some((x) => x.app === app) || serverNav.groups.some((g) => g.items.some((i) => i.app === app))));
  const canTeam = !isSolo && (rights.team || hasNavApp('Team'));
  const canSources = !isSolo && hasNavApp('Sources');
  const canWinLoss = !isSolo && hasNavApp('WinLoss');

  const urgentCount = useMemo(
    () => (serverPriorities ? serverPriorities.filter((p) => p.urgency === 'high').length : 0),
    [serverPriorities],
  );
  const hasPriority = (id: string) => Boolean(serverPriorities?.some((p) => p.id === id));

  const untriedTips = useMemo(() => {
    if (!onTryPrompt || learnedTips === null) return [];
    const learned = new Set(learnedTips);
    return tipsForRole(broker?.role, ar, { canTeam, canSources, canWinLoss, isSolo }).filter((tip) => !learned.has(tip.id)).slice(0, 2);
  }, [onTryPrompt, learnedTips, broker?.role, ar, canTeam, canSources, canWinLoss, isSolo]);

  const heading = entry ? (ar ? 'وحدات محتاجة تحديث' : 'Units overdue for an update') : ar ? 'الأولويات' : 'Priorities';
  const completed = data?.completed;
  const summary = completed === undefined ? null : entry
    ? (ar ? `وحدات حدّثتها النهارده · ${n(completed)}` : `Units you updated today · ${n(completed)}`)
    : manager ? (ar ? `صفقات اتقفلت النهارده · ${n(completed)}` : `Deals closed today · ${n(completed)}`)
      : (ar ? `متابعات خلصت النهارده · ${n(completed)}` : `Follow-ups completed today · ${n(completed)}`);
  const refresh = all ? overdue : home;
  const loading = all ? overdue.isPending : home.isPending && Boolean(broker?.id);
  const failed = refresh.isError && !refresh.data;

  return (
    <ScrollView testID="search-home" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refresh.isRefetching} onRefresh={async () => { await Promise.all([refresh.refetch(), queries.refetchQueries({ queryKey: ['today'], exact: true, type: 'active' })]); }} />}>
      <Text style={[styles.date, { color: colors.muted }]}>{date}</Text>
      <Text accessibilityRole="header" style={[styles.greeting, { color: colors.text }]}>{greeting}{name ? (ar ? ` يا ${name}` : `, ${name}`) : ''}</Text>
      {!all ? invitation : null}
      {summary && !all ? <Text style={{ color: colors.muted }}>{summary}</Text> : null}
      <View style={styles.brief}>
        {!loading && !failed && entry ? <>
          <HomeRow testID="home-overdue-total" title={heading} value={n(total)} icon="units" featured />
          {!all && total > 0 ? <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>{ar ? 'الأقدم أولاً' : 'Longest overdue'}</Text> : null}
        </> : null}
        {!entry || loading || failed ? (
          <View style={styles.sectionHead}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>{heading}</Text>
            {urgentCount > 0 ? <UrgencyBadge testID="home-urgent-badge" tone="critical" label={ar ? `${n(urgentCount)} عاجل` : `${n(urgentCount)} urgent`} /> : null}
          </View>
        ) : null}
        {loading ? <View style={[styles.loading, { backgroundColor: colors.card, borderColor: colors.border }]}><ActivityIndicator accessibilityLabel={t(lang, 'loading')} color={colors.spinner} /></View> :
          failed ? row('home-retry', ar ? 'حاول تاني' : 'Retry brief', () => void refresh.refetch()) :
          rows.length ? rows :
            <HomeRow title={entry ? (ar ? 'كل الوحدات محدّثة' : 'All units are up to date') : (ar ? 'مفيش حاجة عاجلة دلوقتي' : 'Nothing urgent right now')} icon="check" />}
        {entry && !all && total > 0 ? row('home-all-units',
          data?.legacy ? t(lang, 'openUnits') : ar ? 'عرض كل الوحدات المتأخرة' : 'View all overdue units',
          () => { if (data?.legacy) nav.navigate('UnitsList', { old: true }); else setAll(true); }) : null}
        {all && overdue.hasNextPage ? row('home-more-units', overdue.isFetchingNextPage ? t(lang, 'loading') : ar ? 'عرض وحدات أكتر' : 'Show more units',
          () => { if (!overdue.isFetchingNextPage) void overdue.fetchNextPage(); }) : null}
        {all ? row('home-back', ar ? 'رجوع للملخص' : 'Back to brief', () => setAll(false)) : null}
      </View>
      {!all ? (
        <TodayDetails
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
            title={ar ? 'جرّب تسأل' : 'Try asking'}
            subtitle={ar ? 'اختصارات سريعة لدورك — هتختفي لما تجربها' : 'Quick role shortcuts — retire once tried'}
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
                  <Text style={[styles.tipText, { color: colors.text }]}>{tip.label}</Text>
                </Pressable>
                <Pressable
                  testID={`try-tip-dismiss-${tip.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={ar ? 'إخفاء الاقتراح' : 'Dismiss suggestion'}
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
  date: { fontSize: 13, fontWeight: '600' },
  greeting: { fontSize: 29, fontWeight: '800' },
  brief: { marginTop: spacing.md, gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '800', paddingVertical: spacing.xs },
  loading: { minHeight: 52, justifyContent: 'center', borderWidth: 1, borderRadius: radius.card },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tipBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 44 },
  tipText: { flex: 1, fontSize: 14, fontWeight: '600' },
  tipDismiss: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
