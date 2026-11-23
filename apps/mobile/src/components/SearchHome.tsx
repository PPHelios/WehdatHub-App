import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError, type SearchHomeData } from '@wehdathub/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import type { IconName } from './Icon';
import { HomeRow } from './HomeRow';
import { OldUnitActions } from './TodayCards';
import { TodayCall, TodayDetails } from './TodayDetails';

export function SearchHome({ openQueue, invitation, children }: {
  openQueue: (queue: 'unassigned' | 'uncontacted' | 'delayed-first-contact' | 'viewings-tomorrow') => void;
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

  const rows: React.ReactNode[] = [];
  const priority = (key: string, title: string, detail: string | undefined, onPress: () => void, value: number, icon: IconName) => {
    rows.push(<HomeRow key={key} testID={key} title={title} detail={detail} onPress={onPress} value={n(value)} icon={icon} featured={rows.length === 0} />);
  };
  const next = data?.nextViewing;
  if (entry) {
    const units = all ? overdue.data?.pages.flatMap((page) => page.items) ?? [] : data?.units?.items ?? [];
    for (const unit of units) {
      rows.push(<HomeRow key={unit.code} testID={`home-unit-${unit.code}`} title={unit.code} detail={unit.line} icon="units"
        value={unit.hidden ? t(lang, 'tcHidden') : `${n(unit.days)} ${t(lang, 'tcDays')}`} onPress={() => nav.navigate('Unit', { code: unit.code })}>
        <OldUnitActions code={unit.code} />
      </HomeRow>);
    }
  } else if (data) {
    const ops = data.ops;
    if (ops?.unassigned) priority('home-unassigned', ar ? 'عملاء من غير وسيط' : 'Unassigned leads', undefined, () => openQueue('unassigned'), ops.unassigned, 'user-plus');
    if (ops?.uncontactedOld) priority('home-uncontacted', ar ? 'تأخر أول تواصل' : 'Delayed first contact', ar ? 'أكتر من ٢٤ ساعة' : 'Over 24 hours', () => openQueue('delayed-first-contact'), ops.uncontactedOld, 'pulse');
    const late = ops?.overdue ?? data.overdue;
    if (late) priority('home-late', ar ? 'متابعات متأخرة' : 'Overdue follow-ups', undefined, () => nav.navigate('LeadsList', { tab: 'overdue' }), late, 'bell');
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
        {!entry || loading || failed ? <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>{heading}</Text> : null}
        {loading ? <View style={[styles.loading, { backgroundColor: colors.card, borderColor: colors.border }]}><ActivityIndicator accessibilityLabel={t(lang, 'loading')} color={colors.primaryInk} /></View> :
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
      {!all ? <TodayDetails brief={failed ? undefined : { ops: Boolean(data?.ops), units: entry && Boolean(data?.units), viewing: !entry && next?.at ? next : null }} /> : null}
      {!all ? children : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: 90, gap: spacing.sm },
  date: { fontSize: 13, fontWeight: '600' },
  greeting: { fontSize: 29, fontWeight: '800' },
  brief: { marginTop: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '800', paddingVertical: spacing.xs },
  loading: { minHeight: 52, justifyContent: 'center', borderWidth: 1, borderRadius: radius.card },
});
