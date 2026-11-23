import React, { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { useAuth } from '../auth';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Chevron, Icon, type IconName } from './Icon';
import { TodayDetails } from './TodayDetails';

const enter = FadeInDown.duration(240).reduceMotion(ReduceMotion.System);
const exit = FadeOut.duration(120).reduceMotion(ReduceMotion.System);
const reflow = LinearTransition.duration(220).reduceMotion(ReduceMotion.System);

export function SearchHome({ openQueue, openDeals, invitation, children }: {
  openQueue: (queue: 'unassigned' | 'uncontacted' | 'delayed-first-contact' | 'viewings-tomorrow') => void;
  openDeals: () => void;
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
  const home = useQuery({
    queryKey: ['today', 'home', broker?.id, lang], queryFn: () => api.searchHome(),
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

  const metric = (title: string, value: string, icon: IconName, detail?: string, countId?: string, action = false) => (
    <View style={[styles.metric, { backgroundColor: colors.primarySoft }]}>
      <View style={styles.grow}>
        <Animated.View key={value} entering={enter}>
          <Text accessibilityLiveRegion="polite" testID={countId} style={[styles.count, { color: colors.primaryInk }]}>{value}</Text>
        </Animated.View>
        <Text style={[styles.heading, { color: colors.text }]}>{title}</Text>
        {detail ? <Text style={{ color: colors.muted }}>{detail}</Text> : null}
        {action ? <View style={styles.action}><Text style={[styles.actionText, { color: colors.primaryInk }]}>{ar ? 'عرض التفاصيل' : 'View details'}</Text><Chevron rtl={ar} color={colors.primaryInk} /></View> : null}
      </View>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.medallion, { borderColor: colors.primary }]}>
        <View style={[styles.medallionInner, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Icon name={icon} size={32} color={colors.primaryInk} />
        </View>
      </View>
    </View>
  );
  const row = (key: string, title: string, detail: string | undefined, onPress: () => void, side?: string, icon?: IconName, featured = false, ageRatio?: number) => (
    <Animated.View key={key} entering={enter} exiting={exit} layout={reflow}>
      <Pressable testID={key} accessibilityRole="button" onPress={onPress}
        accessibilityLabel={featured ? [title, side, detail].filter(Boolean).join(', ') : undefined}
        style={({ pressed }) => [!featured && styles.row, { borderTopColor: colors.border, opacity: pressed ? 0.65 : 1 }]}>
        {featured && side && icon ? metric(title, side, icon, detail, undefined, true) : <>
          {icon ? <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}><Icon name={icon} size={17} color={colors.primaryInk} /></View> : null}
          <View style={styles.grow}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
            {detail ? <Text style={{ color: colors.muted }} numberOfLines={2}>{detail}</Text> : null}
            {ageRatio !== undefined ? <View importantForAccessibility="no-hide-descendants" style={[styles.ageTrack, { backgroundColor: colors.border }]}>
              <Animated.View layout={reflow} style={[styles.ageFill, { width: String(Math.round(ageRatio * 100)) + '%' as `${number}%`, backgroundColor: colors.primary }]} />
            </View> : null}
          </View>
          {side ? <Text style={[styles.rowCount, { color: colors.primaryInk }]}>{side}</Text> : null}
          <Chevron rtl={ar} color={colors.muted} />
        </>}
      </Pressable>
    </Animated.View>
  );

  const rows: React.ReactNode[] = [];
  const priority = (key: string, title: string, detail: string | undefined, onPress: () => void, value: number, icon: IconName) => {
    rows.push(row(key, title, detail, onPress, n(value), icon, rows.length === 0));
  };
  if (entry) {
    const units = all ? overdue.data?.pages.flatMap((page) => page.items) ?? [] : data?.units?.items ?? [];
    const oldest = Math.max(1, units[0]?.days ?? 0);
    for (const unit of units) {
      rows.push(row(`home-unit-${unit.code}`, unit.code, unit.line, () => nav.navigate('Unit', { code: unit.code }),
        unit.hidden ? (ar ? 'مخفية' : 'Hidden') : ar ? `من ${n(unit.days)} يوم` : `${n(unit.days)} days`, 'units', false, unit.days / oldest));
    }
  } else if (data) {
    const ops = data.ops;
    if (ops?.unassigned) priority('home-unassigned', ar ? 'عملاء من غير وسيط' : 'Unassigned leads', undefined, () => openQueue('unassigned'), ops.unassigned, 'user-plus');
    if (ops?.uncontactedOld) priority('home-uncontacted', ar ? 'تأخر أول تواصل' : 'Delayed first contact', ar ? 'أكتر من ٢٤ ساعة' : 'Over 24 hours', () => openQueue('delayed-first-contact'), ops.uncontactedOld, 'pulse');
    const late = ops?.overdue ?? data.overdue;
    if (late) priority('home-late', ar ? 'متابعات متأخرة' : 'Overdue follow-ups', undefined, () => nav.navigate('LeadsList', { tab: 'overdue' }), late, 'bell');
    if (data.nextViewing) {
      const next = data.nextViewing;
      const at = new Date(next.at!).toLocaleTimeString(locale, { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' });
      rows.push(row('home-viewing', ar ? 'المعاينة الجاية' : 'Next viewing', next.name ?? next.ref, () => nav.navigate('Lead', { ref: next.ref }), at, 'calendar'));
    }
    if (data.tomorrowViewings) priority('home-tomorrow', ar ? 'معاينات بكرة' : 'Viewings tomorrow', undefined, () => openQueue('viewings-tomorrow'), data.tomorrowViewings, 'calendar');
    if (data.calls) priority('home-calls', ar ? 'مكالمات النهارده' : 'Calls due today', undefined, () => nav.navigate('LeadsList', { tab: 'due_today' }), data.calls, 'chat');
    if (data.newLeads && !ops?.uncontactedOld) priority('home-new-leads', ar ? 'عملاء عندك لسه محدش كلمهم' : 'Your leads awaiting first contact', undefined, () => openQueue('uncontacted'), data.newLeads, 'leads');
  }

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
      {summary && !all ? (manager
        ? <Pressable accessibilityRole="button" onPress={openDeals} accessibilityHint={ar ? 'افتح تقرير صفقات الشهر' : 'Open this month’s deals report'} style={styles.summaryAction}><Text style={{ color: colors.primaryInk }}>{summary}</Text><Chevron rtl={ar} color={colors.primaryInk} /></Pressable>
        : <Text style={{ color: colors.muted }}>{summary}</Text>) : null}
      <View style={styles.brief}>
        {!loading && !failed && entry ? <>
          {metric(heading, n(total), 'units', undefined, 'home-overdue-total')}
          {!all && total > 0 ? <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.muted }]}>{ar ? 'الأقدم أولاً' : 'Longest overdue'}</Text> : null}
        </> : null}
        {!entry || loading || failed ? <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.muted }]}>{heading}</Text> : null}
        {loading ? <View style={[styles.state, styles.loading, { backgroundColor: colors.primarySoft }]}><ActivityIndicator accessibilityLabel={t(lang, 'loading')} color={colors.primaryInk} /></View> :
          failed ? row('home-retry', ar ? 'حاول تاني' : 'Retry brief', undefined, () => void refresh.refetch()) :
          rows.length ? (all ? rows : rows.slice(0, 3)) :
            <Animated.View entering={enter} exiting={exit} style={styles.state}>
              <Text style={{ color: colors.muted }}>{entry ? (ar ? 'كل الوحدات محدّثة' : 'All units are up to date') : (ar ? 'مفيش حاجة عاجلة دلوقتي' : 'Nothing urgent right now')}</Text>
            </Animated.View>}
        {entry && !all && total > 0 ? row('home-all-units', ar ? 'عرض كل الوحدات المتأخرة' : 'View all overdue units', undefined, () => setAll(true)) : null}
        {all && overdue.hasNextPage ? row('home-more-units', overdue.isFetchingNextPage ? t(lang, 'loading') : ar ? 'عرض وحدات أكتر' : 'Show more units', undefined,
          () => { if (!overdue.isFetchingNextPage) void overdue.fetchNextPage(); }) : null}
        {all ? row('home-back', ar ? 'رجوع للملخص' : 'Back to brief', undefined, () => setAll(false)) : null}
      </View>
      {!all ? <Animated.View entering={enter} style={styles.todayContent}><TodayDetails /></Animated.View> : null}
      {!all ? children : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: 150, gap: spacing.sm },
  date: { fontSize: 13, fontWeight: '600' },
  greeting: { fontSize: 29, fontWeight: '800' },
  todayContent: { marginTop: spacing.md },
  brief: { marginTop: spacing.md, gap: spacing.xs },
  metric: { minHeight: 120, flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md, borderRadius: radius.card },
  medallion: { width: 78, height: 78, borderRadius: 39, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  medallionInner: { width: 61, height: 61, borderRadius: 31, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', paddingVertical: spacing.sm },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  actionText: { fontSize: 13, fontWeight: '700' },
  ageTrack: { borderRadius: 2, height: 3, width: '72%', overflow: 'hidden', marginTop: spacing.xs },
  ageFill: { height: 3, borderRadius: 2 },
  loading: { minHeight: 120, borderRadius: radius.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  grow: { flex: 1, gap: 3 },
  count: { fontSize: 45, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rowCount: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heading: { fontSize: 17, fontWeight: '700' },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  state: { minHeight: 64, justifyContent: 'center', borderTopWidth: 0 },
  summaryAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
