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
import { Card } from './Card';
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
  const locale = lang === 'ar' ? 'ar-EG' : 'en-EG';
  const count = new Intl.NumberFormat(locale);
  const dates = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 });
  const maximum = Math.max(1, ...(summary?.weeks ?? []));
  const lastDay = summary ? new Date(Date.parse(summary.to) - 86400000).getUTCDate() : 31;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" variant="heading" style={{ color: colors.text }}>{t(lang, 'sd_title')}</Text>
      <Chips animateFilter value={period} onChange={(next) => { setPeriod(next); setWeek(undefined); }} options={[
        { value: 'recent', label: t(lang, 'sd_thisMonth') },
        { value: 'last', label: t(lang, 'sd_lastMonth') },
      ]} />
      {query.isPending ? <Loading label={t(lang, 'loading')} /> : null}
      {query.isError ? <ErrorView message={errorText(query.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => query.refetch()} /> : null}
      {unavailable ? <ErrorView message={t(lang, 'sd_unavailable')} retryLabel={t(lang, 'retry')} onRetry={() => query.refetch()} /> : null}
      {summary ? <>
        <Card style={styles.chart}>
          <Text style={{ color: colors.muted }}>{dates.format(new Date(summary.from))}</Text>
          <Text variant="display" style={[styles.total, { color: colors.text }]}>{count.format(summary.weeks.reduce((a, b) => a + b, 0))}</Text>
          <View style={styles.columns}>
            {summary.weeks.map((n, i) => {
              const range = count.format(i * 7 + 1) + '–' + count.format(Math.min(i * 7 + 7, lastDay));
              return <Pressable key={i} accessibilityRole="button" accessibilityState={{ selected: week === i, disabled: query.isPlaceholderData }} disabled={query.isPlaceholderData} accessibilityLabel={range + '، ' + count.format(n)} onPress={() => setWeek(i === week ? undefined : i)} style={styles.column}>
                <Text style={[styles.number, { color: colors.text }]}>{count.format(n)}</Text>
                <View style={[styles.track, { backgroundColor: colors.bg }]}>
                  <Bar ratio={n / maximum} color={week === undefined || week === i ? colors.chartBar : colors.border} />
                </View>
                <Text variant="caption" style={[styles.label, { color: colors.muted }]}>{'‎' + range + '‎'}</Text>
              </Pressable>;
            })}
          </View>
        </Card>
        <Text accessibilityRole="header" variant="heading" style={{ color: colors.text }}>{t(lang, week === undefined ? 'sd_allPeriod' : 'sd_selPeriod')}</Text>
        {!query.isPending && !detail.isPending && query.isFetching && !query.isFetchingNextPage ? <Loading label={t(lang, 'loading')} /> : null}
        {!query.isPlaceholderData && !rows.length ? <Text style={{ color: colors.muted }}>{t(lang, 'sd_none')}</Text> : null}
        {!query.isPlaceholderData ? rows.map((row) => {
          const code = 'D-' + String(row.ref).padStart(4, '0');
          return <Pressable key={code} accessibilityRole="button" onPress={() => setRef(code)} style={[styles.row, { borderColor: colors.border }]}>
            <Text style={[styles.number, { color: colors.text }]}>{code}{row.unit_code ? ' · ' + String(row.unit_code) : ''}</Text>
            <Text style={{ color: colors.muted }}>{money.format(Number(row.price))}</Text>
          </Pressable>;
        }) : null}
        {query.hasNextPage && !query.isPlaceholderData ? <Button variant="secondary" label={t(lang, 'sd_more')} loading={query.isFetchingNextPage} onPress={() => { query.fetchNextPage(); }} /> : null}
      </> : null}
      <Modal visible={Boolean(ref)} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => setRef(undefined)}>
        <View style={styles.overlay}>
          <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text variant="heading" style={{ color: colors.text }}>{ref}</Text>
            {detail.isPending ? <Loading label={t(lang, 'loading')} /> : null}
            {detail.isError ? <ErrorView message={errorText(detail.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => detail.refetch()} /> : null}
            {detail.data ? <Text style={{ color: colors.text }}>{[detail.data.deal.unit_code, detail.data.deal.closing_broker_name, money.format(Number(detail.data.deal.price))].filter(Boolean).join(' · ')}</Text> : null}
            <Button variant="secondary" label={t(lang, 'sd_close')} onPress={() => setRef(undefined)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 90, gap: spacing.md },
  total: { fontVariant: ['tabular-nums'] },
  chart: { gap: spacing.xs },
  columns: { flexDirection: 'row', gap: spacing.xs },
  column: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm },
  track: { height: 108, width: '74%', maxWidth: 48, borderRadius: radius.sm, overflow: 'hidden' },
  bar: { ...StyleSheet.absoluteFill, borderRadius: radius.sm, transformOrigin: 'center bottom' },
  number: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { textAlign: 'center' },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.md, gap: spacing.xs },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { padding: spacing.xl, paddingBottom: 48, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, gap: spacing.md },
});
