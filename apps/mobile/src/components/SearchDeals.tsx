import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { errorText } from '../errors';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Chips } from './Chips';
import { ErrorView, Loading } from './StateViews';

type Period = 'recent' | 'last';

function Bar({ ratio, color }: { ratio: number; color: string }) {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withTiming(ratio, { duration: 230, reduceMotion: ReduceMotion.System });
  }, [ratio, scale]);
  const motion = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, motion]} />;
}

export function SearchDeals({ initialPeriod }: { initialPeriod: Period }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const lang = currentLang();
  const ar = lang === 'ar';
  const [period, setPeriod] = useState(initialPeriod);
  const [week, setWeek] = useState<number>();
  const [ref, setRef] = useState<string>();
  const query = useInfiniteQuery({
    queryKey: ['search-deals', period, week],
    queryFn: ({ pageParam }) => api.dealReport(period, week, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => last.more ? pages.length : undefined,
    placeholderData: keepPreviousData,
  });
  const detail = useQuery({ queryKey: ['search-deal', ref], queryFn: () => api.dealDetail(ref!), enabled: Boolean(ref) });
  const summary = query.data?.pages[0]?.summary;
  const unavailable = query.isSuccess && !summary;
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];
  const count = new Intl.NumberFormat(ar ? 'ar-EG' : 'en-EG');
  const dates = new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-EG', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const money = new Intl.NumberFormat(ar ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 });
  const maximum = Math.max(1, ...(summary?.weeks ?? []));
  const lastDay = summary ? new Date(Date.parse(summary.to) - 86400000).getUTCDate() : 31;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{ar ? 'الصفقات اللي اتقفلت' : 'Closed deals'}</Text>
      <Chips animateFilter value={period} onChange={(next) => { setPeriod(next); setWeek(undefined); }} options={[
        { value: 'recent', label: ar ? 'الشهر ده' : 'This month' },
        { value: 'last', label: ar ? 'الشهر اللي فات' : 'Last month' },
      ]} />
      {query.isPending ? <Loading label={t(lang, 'loading')} /> : null}
      {query.isError ? <ErrorView message={errorText(query.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => query.refetch()} /> : null}
      {unavailable ? <ErrorView message={ar ? 'تقرير الصفقات مش متاح دلوقتي' : 'The deals report is unavailable right now'} retryLabel={t(lang, 'retry')} onRetry={() => query.refetch()} /> : null}
      {summary ? <>
        <View style={[styles.chart, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.muted }}>{dates.format(new Date(summary.from))}</Text>
          <Text style={[styles.total, { color: colors.text }]}>{count.format(summary.weeks.reduce((a, b) => a + b, 0))}</Text>
          <View style={styles.columns}>
            {summary.weeks.map((n, i) => {
              const range = count.format(i * 7 + 1) + '–' + count.format(Math.min(i * 7 + 7, lastDay));
              return <Pressable key={i} accessibilityRole="button" accessibilityState={{ selected: week === i, disabled: query.isPlaceholderData }} disabled={query.isPlaceholderData} accessibilityLabel={range + '، ' + count.format(n)} onPress={() => setWeek(i === week ? undefined : i)} style={styles.column}>
                <Text style={[styles.number, { color: colors.text }]}>{count.format(n)}</Text>
                <View style={[styles.track, { backgroundColor: colors.bg }]}>
                  <Bar ratio={n / maximum} color={week === undefined || week === i ? colors.chartBar : colors.border} />
                </View>
                <Text style={[styles.label, { color: colors.muted }]}>{'‎' + range + '‎'}</Text>
              </Pressable>;
            })}
          </View>
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{week === undefined ? (ar ? 'كل صفقات الفترة' : 'All deals in period') : (ar ? 'صفقات الفترة المختارة' : 'Deals in selected period')}</Text>
        {query.isFetching && !query.isFetchingNextPage ? <Loading label={t(lang, 'loading')} /> : null}
        {!query.isPlaceholderData && !rows.length ? <Text style={{ color: colors.muted }}>{ar ? 'مفيش صفقات في الفترة دي' : 'No deals in this period'}</Text> : null}
        {!query.isPlaceholderData ? rows.map((row) => {
          const code = 'D-' + String(row.ref).padStart(4, '0');
          return <Pressable key={code} accessibilityRole="button" onPress={() => setRef(code)} style={[styles.row, { borderColor: colors.border }]}>
            <Text style={[styles.number, { color: colors.text }]}>{code}{row.unit_code ? ' · ' + String(row.unit_code) : ''}</Text>
            <Text style={{ color: colors.muted }}>{money.format(Number(row.price))}</Text>
          </Pressable>;
        }) : null}
        {query.hasNextPage && !query.isPlaceholderData ? <Button variant="secondary" label={ar ? 'صفقات أكتر' : 'More deals'} loading={query.isFetchingNextPage} onPress={() => { void query.fetchNextPage(); }} /> : null}
      </> : null}
      <Modal visible={Boolean(ref)} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => setRef(undefined)}>
        <View style={styles.overlay}>
          <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.title, { color: colors.text }]}>{ref}</Text>
            {detail.isPending ? <Loading label={t(lang, 'loading')} /> : null}
            {detail.isError ? <ErrorView message={errorText(detail.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => detail.refetch()} /> : null}
            {detail.data ? <Text style={{ color: colors.text }}>{[detail.data.deal.unit_code, detail.data.deal.closing_broker_name, money.format(Number(detail.data.deal.price))].filter(Boolean).join(' · ')}</Text> : null}
            <Button variant="secondary" label={ar ? 'قفل' : 'Close'} onPress={() => setRef(undefined)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 90, gap: spacing.md },
  title: { fontWeight: '700', fontSize: 20 },
  total: { fontWeight: '800', fontSize: 34, fontVariant: ['tabular-nums'] },
  chart: { padding: spacing.lg, borderRadius: radius.card, gap: spacing.xs },
  columns: { flexDirection: 'row', gap: spacing.xs },
  column: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm },
  track: { height: 108, width: '74%', maxWidth: 48, borderRadius: 5, overflow: 'hidden' },
  bar: { ...StyleSheet.absoluteFill, borderRadius: 5, transformOrigin: 'center bottom' },
  number: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { fontSize: 12, textAlign: 'center' },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.md, gap: spacing.xs },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
  sheet: { padding: spacing.xl, paddingBottom: 48, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, gap: spacing.md },
});
