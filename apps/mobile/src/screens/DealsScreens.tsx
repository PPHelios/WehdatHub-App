import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ltr } from '@wehdathub/shared';
import type { DealsFilterOpts, Lang } from '@wehdathub/shared';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText as Text } from '../components/AppText';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chips } from '../components/Chips';
import { DealForm } from '../components/DealForm';
import { Field } from '../components/Field';
import { Section } from '../components/Section';
import { KpiTile, SectionCard, UrgencyBadge } from '../components/SectionCard';
import { Sheet } from '../components/Sheet';
import { SkeletonRow } from '../components/Skeleton';
import { StatRow } from '../components/StatRow';
import { useRights } from '../rights';
import { ErrorView, Loading } from '../components/StateViews';
import { rowDate } from '../dates';
import { errorText } from '../errors';
import { t } from '../i18n';
import { enter, layout } from '../motion';
import type { RootStackParams } from '../navigation';
import { spacing, useTheme } from '../theme';
import { toast, toastError } from '../components/Toast';

const num = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-US'));
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const EMPTY_ROUTE = { params: {} };
const useSafeRoute = typeof useRoute === 'function' ? useRoute : () => EMPTY_ROUTE;

function Gate<T>({ q, children }: { q: { isPending: boolean; isError: boolean; error: unknown; data?: T; refetch: () => Promise<unknown> }; children: (d: T) => React.ReactElement }) {
  const lang = currentLang();
  if (q.isPending) return <Loading kind="cards" label={t(lang, 'loading')} />;
  if (q.isError || !q.data) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  return children(q.data);
}

/** Confirm sheet for unsaved spend: keep editing, or discard and carry on. */
function DiscardSheet({ ask, onClose, lang }: { ask: { body: string; run: () => void } | null; onClose: () => void; lang: Lang }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={Boolean(ask)} onClose={onClose} title={t(lang, 'dlUnsavedTitle')} testID="sources-discard-sheet">
      <Text variant="bodySm" style={{ color: colors.muted }}>{ask?.body}</Text>
      <Button testID="sources-discard-keep" variant="secondary" label={t(lang, 'dlKeepEditing')} onPress={onClose} />
      <Button testID="sources-discard-confirm" variant="danger" label={t(lang, 'dlDiscard')} onPress={() => { const run = ask?.run; onClose(); run?.(); }} />
    </Sheet>
  );
}

/** A deal's status in the screen's language (the server sends the English key). */
export const dealStatusLabel = (s: string, ar: boolean) => (ar ? ({ pending: 'مستني', signed: 'اتوقّع', paid: 'اتدفع', cancelled: 'اتلغى' } as Record<string, string>)[s] : undefined) ?? s;

/** Deals: the monthly totals and the list; whoever may edit a deal can change its status. */
export function DealsScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const qc = useQueryClient();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const route = useSafeRoute() as RouteProp<RootStackParams, 'Deals'>;
  const rights = useRights();
  const [fix, setFix] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const { from, to, brokerId, brokerRole, market, area } = route.params ?? {};
  const [filters, setFilters] = useState<DealsFilterOpts>(() => ({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(brokerId ? { brokerId } : {}),
    ...(brokerRole ? { brokerRole } : {}),
    ...(market ? { market } : {}),
    ...(area ? { area } : {}),
  }));
  useEffect(() => {
    setFilters({
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(brokerId ? { brokerId } : {}),
      ...(brokerRole ? { brokerRole } : {}),
      ...(market ? { market } : {}),
      ...(area ? { area } : {}),
    });
  }, [from, to, brokerId, brokerRole, market, area]);
  const hasFilters = Boolean(filters.from || filters.to || filters.brokerId || filters.market || filters.area);
  const queryKey = hasFilters ? ['deals', status, filters] : ['deals', status];
  const q = useInfiniteQuery({
    queryKey,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => (hasFilters ? api.deals(status || undefined, pageParam, { ...filters, summary: true }) : api.deals(status || undefined, pageParam)),
    getNextPageParam: (lastPage, _pages, lastPageParam) => (lastPage.more ? lastPageParam + 1 : undefined),
  });
  const setDeal = async (ref: string, next: string, version: unknown) => {
    try { await api.dealStatus(ref, next, Number(version)); await qc.invalidateQueries({ queryKey: ['deals'] }); } catch (e) { toast(errorText(e, lang), true); }
  };
  if (q.isPending) return <Loading kind="rows" label={t(lang, 'loading')} />;
  const firstPage = q.data?.pages[0];
  if (q.isError || !firstPage) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const items = q.data.pages.flatMap((p) => p.items);
  const dealSummary = firstPage.dealSummary;
  return (
    <FlashList
      testID="deals-list"
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.listPad}
      keyboardShouldPersistTaps="handled"
      data={items}
      keyExtractor={(x, i) => str(x.ref ?? i)}
      onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
      onEndReachedThreshold={0.6}
      ListHeaderComponent={(
        <View style={styles.head}>
          <Section testID="sec-new-deal" title={t(lang, 'newDeal')}><DealForm /></Section>
          {hasFilters ? (
            <View style={styles.wrapRow}>
              {(filters.from || filters.to) ? (
                <Button testID="deals-filter-window" size="sm" variant="secondary" label={`${t(lang, 'dlWindow')}: ${(filters.from ?? '').slice(0, 10)} → ${(filters.to ?? '').slice(0, 10)} ×`} onPress={() => setFilters((f) => ({ ...f, from: undefined, to: undefined }))} />
              ) : null}
              {filters.market ? (
                <Button testID="deals-filter-market" size="sm" variant="secondary" label={`${t(lang, 'dlMarket')}: ${filters.market} ×`} onPress={() => setFilters((f) => ({ ...f, market: undefined }))} />
              ) : null}
              {filters.area ? (
                <Button testID="deals-filter-area" size="sm" variant="secondary" label={`${t(lang, 'dlArea')}: ${filters.area} ×`} onPress={() => setFilters((f) => ({ ...f, area: undefined }))} />
              ) : null}
              {filters.brokerId ? (
                <Button testID="deals-filter-broker" size="sm" variant="secondary" label={`${filters.brokerRole === 'participant' ? t(lang, 'dlInvolved') : t(lang, 'dlCloser')} ×`} onPress={() => setFilters((f) => ({ ...f, brokerId: undefined, brokerRole: undefined }))} />
              ) : null}
            </View>
          ) : null}
          {dealSummary ? (
            <Card variant="elevated" style={styles.cardGap} testID="deals-summary-banner">
              <Text variant="body" weight="bold" style={{ color: colors.text }}>
                {`${num(dealSummary.deals)} ${t(lang, 'dlDeals')} · ${num(dealSummary.commissionBasis === 'broker_share' && dealSummary.brokerShareTotal != null ? dealSummary.brokerShareTotal : dealSummary.commissionTotal)} EGP (${dealSummary.commissionBasis === 'broker_share' ? t(lang, 'dlBrokerShare') : t(lang, 'dlRecorded')})`}
              </Text>
              <Text variant="bodySm" style={{ color: colors.muted }}>
                {dealSummary.brokerRole === 'participant' ? t(lang, 'dlCloserOrSplit') : t(lang, 'dlClosingOnly')}
              </Text>
              {dealSummary.unknownMarketCount > 0 || dealSummary.unknownAreaCount > 0 ? (
                <Text variant="caption" style={{ color: colors.muted }}>
                  {[dealSummary.unknownMarketCount > 0 ? `${dealSummary.unknownMarketCount} ${t(lang, 'dlUnknownMarket')}` : '', dealSummary.unknownAreaCount > 0 ? `${dealSummary.unknownAreaCount} ${t(lang, 'dlUnknownArea')}` : ''].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </Card>
          ) : null}
          <Chips animateFilter testID="deal-status" value={status} onChange={(v) => setStatus(v === status ? '' : v)} options={firstPage.statuses.map((s) => ({ value: s, label: dealStatusLabel(s, ar) }))} />
          <Card variant="elevated" style={styles.cardGap}>
            <Text variant="body" weight="bold" style={{ color: colors.text }}>{t(lang, 'dlMonthly')}</Text>
            {firstPage.totals.map((m) => <StatRow key={str(m.month)} label={str(m.month)} value={`${num(m.deals)} ${t(lang, 'dlDeals')} · ${num(m.commission ?? m.mine)}`} pct={(Number(m.deals) / Math.max(1, ...firstPage.totals.map((x) => Number(x.deals)))) * 100} />)}
          </Card>
        </View>
      )}
      renderItem={({ item: x, index }) => (
        <Animated.View style={styles.item} entering={enter(Math.min(index, 8))} layout={layout}>
          <Card variant="elevated" style={styles.cardGap} testID={`deal-${str(x.ref)}`}>
            <Text variant="body" weight="bold" style={{ color: colors.text }}>#{str(x.ref)} · {dealStatusLabel(str(x.status), ar)}</Text>
            <Text style={{ color: colors.text }}>{[str(x.client_name), str(x.unit_code), str(x.price) ? num(x.price) : ''].filter(Boolean).join(' · ')}</Text>
            {str(x.deal_type) === 'rent' && x.unit_code ? <Button testID={`add-lease-${str(x.ref)}`} variant="secondary" label={t(lang, 'addLease')} onPress={() => nav.navigate('Unit', { code: str(x.unit_code), lease: { tenantName: x.lead_ref ? `L-${String(x.lead_ref).padStart(4, '0')}` : str(x.client_name), startDate: str(x.closed_at).slice(0, 10), rent: x.price === null || x.price === undefined ? '' : String(Math.round(Number(x.price))) } })} /> : null}
            {rights.manager || rights.agencyOwner ? (
              <Section testID={`sec-fix-${str(x.ref)}`} title={t(lang, 'correctDeal')}>
                <Field label={t(lang, 'dealCommission')} value={fix[str(x.ref)] ?? ''} onChangeText={(v) => setFix({ ...fix, [str(x.ref)]: v })} />
                <Button testID={`fix-${str(x.ref)}`} label={t(lang, 'save')} disabled={!(fix[str(x.ref)] ?? '').trim()} onPress={async () => { try { await api.correctDeal(`D-${String(x.ref).padStart(4, '0')}`, { commission: fix[str(x.ref)], version: Number(x.version) }); await qc.invalidateQueries({ queryKey: ['deals'] }); } catch (e) { toast(errorText(e, lang), true); } }} />
              </Section>
            ) : null}
            {firstPage.statuses.length ? <Chips value={str(x.status)} onChange={(s) => { setDeal(str(x.ref), s, x.version); }} options={(Array.isArray(x.allowed) ? (x.allowed as string[]) : firstPage.statuses).map((s) => ({ value: s, label: dealStatusLabel(s, ar) }))} /> : null}
          </Card>
        </Animated.View>
      )}
      ListFooterComponent={q.isFetchingNextPage ? <View style={styles.footer}><SkeletonRow /></View> : null}
    />
  );
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function currentCairoMonth(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
}

/** Commissions: resale (from deals) or developer commissions with Claimable vs Overdue split and developer drill-through. */
export function CommissionsScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const params = useRoute<RouteProp<RootStackParams, 'Commissions'>>().params;
  const [kind, setKind] = useState<'resale' | 'developers'>(params?.kind ?? 'resale');
  const [filter, setFilter] = useState<'all' | 'claimable' | 'overdue'>(params?.overdue ? 'overdue' : 'all');
  const [developerId, setDeveloperId] = useState<string | undefined>(params?.developerId);
  const [developerName, setDeveloperName] = useState<string | undefined>(params?.developerName);

  useEffect(() => {
    if (!params) return;
    if (params.kind) setKind(params.kind);
    if (params.overdue !== undefined) setFilter(params.overdue ? 'overdue' : 'all');
    if (params.developerId !== undefined) setDeveloperId(params.developerId);
    if (params.developerName !== undefined) setDeveloperName(params.developerName);
  }, [params]);

  const statusArg = kind === 'developers' && filter === 'claimable' ? 'claimable' : undefined;
  const overdueArg = kind === 'developers' && filter === 'overdue';
  const devArg = kind === 'developers' ? developerId : undefined;
  const q = useInfiniteQuery({
    queryKey: ['commissions', kind, filter, devArg],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => kind === 'developers'
      ? api.commissions(kind, statusArg, pageParam, { developer: devArg, overdue: overdueArg, period: 'all' })
      : api.commissions(kind, statusArg, pageParam),
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return lastPage.items.length > 0 && loaded < (lastPage.total ?? 0) ? lastPageParam + 1 : undefined;
    },
  });
  if (q.isPending) return <Loading kind="rows" label={t(lang, 'loading')} />;
  const d = q.data?.pages[0];
  if (q.isError || !d) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const totals = d.totals;
  const devs = kind === 'developers' ? (d.byDeveloper ?? []) : [];
  const items = q.data.pages.flatMap((p) => p.items);
  return (
    <FlashList
      testID="commissions-list"
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.listPad}
      keyboardShouldPersistTaps="handled"
      data={items}
      keyExtractor={(x, i) => str(x.id ?? i)}
      onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
      onEndReachedThreshold={0.6}
      ListHeaderComponent={(
        <View style={styles.head}>
          <Chips<'resale' | 'developers'> testID="comm-kind" value={kind} onChange={(k) => { setKind(k); if (k === 'resale') { setFilter('all'); setDeveloperId(undefined); setDeveloperName(undefined); } }} options={[{ value: 'resale', label: t(lang, 'dlResale') }, { value: 'developers', label: t(lang, 'dlDevelopers') }]} />
          {kind === 'developers' ? (
            <>
              <Chips<'all' | 'claimable' | 'overdue'> testID="comm-filter" value={filter} onChange={setFilter} options={[
                { value: 'all', label: t(lang, 'dlAll') },
                { value: 'claimable', label: t(lang, 'dlClaimable') },
                { value: 'overdue', label: t(lang, 'dlOverdue') },
              ]} />
              {totals ? (
                <SectionCard testID="comm-split-summary" title={t(lang, 'dlSplitTitle')}>
                  <View style={styles.kpiGrid}>
                    <KpiTile testID="comm-claimable" label={t(lang, 'dlClaimableNI')} value={`${num(totals.claimable ?? 0)} ${t(lang, 'egp')}`} hint={totals.claimableCount ? `${num(totals.claimableCount)} ${t(lang, 'dlDeals')}` : undefined} tone={Number(totals.claimable || 0) > 0 ? 'warn' : 'ok'} />
                    <KpiTile testID="comm-overdue" label={t(lang, 'dlOverdueAmt')} value={`${num(totals.overdueAmount ?? 0)} ${t(lang, 'egp')}`} hint={totals.overdue ? `${num(totals.overdue)} ${t(lang, 'dlOverdueCount')}` : undefined} tone={Number(totals.overdue || 0) > 0 ? 'critical' : 'ok'} />
                  </View>
                </SectionCard>
              ) : null}
              {developerId ? (
                <View style={styles.rowBetween}>
                  <UrgencyBadge testID="comm-active-dev" tone="neutral" label={`${t(lang, 'dlDeveloper')}: ${developerName || developerId.slice(0, 8)}`} />
                  <Button testID="comm-clear-dev" size="sm" variant="quiet" label={t(lang, 'dlAllDevs')} onPress={() => { setDeveloperId(undefined); setDeveloperName(undefined); }} />
                </View>
              ) : devs.length > 0 ? (
                <SectionCard testID="comm-by-developer" title={t(lang, 'dlByDev')}>
                  {devs.map((dev) => (
                    <Pressable
                      key={dev.developerId}
                      testID={`comm-dev-${dev.developerId}`}
                      accessibilityRole="button"
                      onPress={() => { setDeveloperId(dev.developerId); setDeveloperName(dev.developerName); }}
                      style={({ pressed }) => [styles.devRow, { borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}
                    >
                      <View style={styles.devCopy}>
                        <Text variant="body" weight="bold" style={{ color: colors.text }}>{dev.developerName}</Text>
                        <Text style={{ color: colors.muted }}>
                          {`${t(lang, 'dlClaimableShort')} ${num(dev.claimable)} · ${t(lang, 'dlOutstanding')} ${num(dev.outstanding)}`}
                        </Text>
                      </View>
                      <View style={styles.wrapRow}>
                        {dev.overdueCount > 0 ? <UrgencyBadge tone="critical" label={`${dev.overdueCount} ${t(lang, 'dlOverdueBadge')}`} /> : null}
                        {dev.claimable > 0 ? <UrgencyBadge tone="warn" label={t(lang, 'dlClaim')} /> : null}
                      </View>
                    </Pressable>
                  ))}
                </SectionCard>
              ) : null}
            </>
          ) : null}
          <Text style={{ color: colors.muted }}>{d.total} · {d.period}</Text>
        </View>
      )}
      renderItem={({ item: x, index: i }) => (
        <Animated.View style={styles.item} entering={enter(Math.min(i, 8))} layout={layout}>
          <Card variant="elevated" style={styles.cardGap} testID={`comm-${str(x.id ?? i)}`}>
            <Text variant="body" weight="bold" style={{ color: colors.text }}>{str(x.unit_code)} {x.developer_name ? `· ${str(x.developer_name)}` : ''}{x.status ? ` · ${str(x.status)}` : ''}</Text>
            <Text style={{ color: colors.text }}>{num(x.amount ?? x.commission_total ?? x.expected_amount ?? x.my_share ?? x.mine)}</Text>
          </Card>
        </Animated.View>
      )}
      ListFooterComponent={q.isFetchingNextPage ? <View style={styles.footer}><SkeletonRow /></View> : null}
    />
  );
}

/** Lead sources for a month, with month switcher, cohort note, signed-only filter, and silent ad-burn alerts. */
export function SourcesScreen({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void } = {}) {
  const { colors } = useTheme();
  const lang = currentLang();
  const qc = useQueryClient();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const initialSigned = Boolean(useRoute<RouteProp<RootStackParams, 'Sources'>>().params?.signedOnly);
  const [signedOnly, setSignedOnly] = useState(initialSigned);
  const maxMonth = currentCairoMonth();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const q = useQuery({
    queryKey: ['sources', month ?? 'current', signedOnly],
    queryFn: () => month || signedOnly ? api.sources(month, signedOnly) : api.sources(),
  });
  const [draftsByMonth, setDraftsByMonth] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<{ month: string | null; text: string } | null>(null);
  const [ask, setAsk] = useState<{ body: string; run: () => void } | null>(null);
  const currentMonth = q.data?.month?.slice(0, 7) ?? month ?? maxMonth;
  const spend = draftsByMonth[currentMonth] ?? {};
  const hasDirty = Boolean(
    q.data && q.data.rows.some((r) => spend[r.source] !== undefined && spend[r.source] !== str(r.spend ?? '')),
  );
  useEffect(() => {
    onDirtyChange?.(hasDirty);
  }, [hasDirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);
  useEffect(() => {
    if (!nav?.addListener) return undefined;
    return nav.addListener('beforeRemove', (e) => {
      if (!hasDirty) return;
      e.preventDefault();
      setAsk({
        body: t(lang, 'dlUnsavedExit'),
        run: () => {
          setDraftsByMonth((prev) => {
            const next = { ...prev };
            delete next[currentMonth];
            return next;
          });
          nav.dispatch?.(e.data.action);
        },
      });
    });
  }, [nav, hasDirty, lang, currentMonth]);

  const changeMonth = (nextMonth: string, activeMonth: string) => {
    if (hasDirty) {
      setAsk({
        body: t(lang, 'dlUnsavedMonth'),
        run: () => {
          setDraftsByMonth((prev) => {
            const n = { ...prev };
            delete n[activeMonth];
            return n;
          });
          setSavedMsg(null);
          setMonth(nextMonth);
        },
      });
      return;
    }
    setSavedMsg(null);
    setMonth(nextMonth);
  };
  const save = async (submittedMonth: string) => {
    if (saving) return;
    setSaving(true);
    setSavedMsg(null);
    const payload = draftsByMonth[submittedMonth] ?? {};
    try {
      await api.saveSpend(submittedMonth, payload);
      setDraftsByMonth((prev) => {
        const n = { ...prev };
        delete n[submittedMonth];
        return n;
      });
      await qc.invalidateQueries({ queryKey: ['sources'] });
      setSavedMsg({
        month: submittedMonth,
        text: `${t(lang, 'dlSavedSpend')} ${submittedMonth}.`,
      });
    } catch (e) {
      setSavedMsg({ month: null, text: toastError(errorText(e, lang)) });
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
    <Gate q={q}>
      {(d) => {
        const activeMonth = d.month.slice(0, 7);
        const monthSpend = draftsByMonth[activeMonth] ?? {};
        const canNext = activeMonth < maxMonth;
        const visibleMsg = savedMsg && (savedMsg.month === null || savedMsg.month === activeMonth) ? savedMsg.text : null;
        return (
          <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
            <View style={styles.rowBetween}>
              <Button testID="sources-prev-month" size="sm" variant="secondary" label={t(lang, 'dlPrev')} onPress={() => changeMonth(shiftMonth(activeMonth, -1), activeMonth)} />
              <Text testID="sources-month-label" variant="body" weight="bold" style={{ color: colors.text }}>{activeMonth}</Text>
              <Button testID="sources-next-month" size="sm" variant="secondary" label={t(lang, 'dlNext')} disabled={!canNext} onPress={() => changeMonth(shiftMonth(activeMonth, 1), activeMonth)} />
            </View>
            <Chips<'all' | 'signed'>
              testID="sources-signed-toggle"
              value={signedOnly ? 'signed' : 'all'}
              onChange={(v) => setSignedOnly(v === 'signed')}
              options={[
                { value: 'all', label: t(lang, 'dlAllActive') },
                { value: 'signed', label: t(lang, 'dlSignedOnly') },
              ]}
            />
            <Text testID="sources-cohort-note" style={{ color: colors.muted }}>
              {signedOnly ? t(lang, 'dlNoteSigned') : t(lang, 'dlNoteAll')}
            </Text>
            {d.rows.map((r) => {
              const burn = Boolean(r.adBurn ?? (r.spend && r.spend > 0 && (r.leads === 0 || (r.leads >= 5 && r.deals === 0))));
              return (
                <Card variant="elevated" style={styles.cardGap} key={r.source} testID={`source-${r.source}`}>
                  <View style={styles.rowBetween}>
                    <Text variant="body" weight="bold" style={{ color: colors.text }}>{r.source}</Text>
                    {burn ? <UrgencyBadge testID={`source-burn-${r.source}`} tone="critical" label={r.leads === 0 ? t(lang, 'dlSpendNoLeads') : t(lang, 'dlSpendNoDeals')} /> : null}
                  </View>
                  <Text style={{ color: colors.text }}>{r.leads} {t(lang, 'dlLeads')} · {r.deals} {t(lang, 'dlDeals')} · {num(r.commission)}</Text>
                  <Text style={{ color: colors.muted }}>{t(lang, 'dlPerLead')} {num(r.perLead)} · {t(lang, 'dlPerDeal')} {num(r.perDeal)}</Text>
                  <Field
                    label={t(lang, 'dlSpendEgp')}
                    value={monthSpend[r.source] ?? str(r.spend ?? '')}
                    onChangeText={(v) => {
                      const nextMap = { ...monthSpend, [r.source]: v };
                      const nextDirty = d.rows.some((row) => nextMap[row.source] !== undefined && nextMap[row.source] !== str(row.spend ?? ''));
                      onDirtyChange?.(nextDirty);
                      setDraftsByMonth((prev) => ({
                        ...prev,
                        [activeMonth]: { ...(prev[activeMonth] ?? {}), [r.source]: v },
                      }));
                    }}
                    keyboardType="numeric"
                  />
                </Card>
              );
            })}
            {visibleMsg ? <Text testID="sources-msg" style={{ color: colors.text }}>{visibleMsg}</Text> : null}
            <Button testID="sources-save" disabled={saving} label={t(lang, 'dlSaveSpend')} onPress={() => { save(activeMonth); }} />
          </ScrollView>
        );
      }}
    </Gate>
    <DiscardSheet ask={ask} onClose={() => setAsk(null)} lang={lang} />
    </>
  );
}

/** Portal enquiries (Bayut, Dubizzle, Nawy): add the number to turn one into a lead. */
export function PortalScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['portal'], queryFn: () => api.portalEnquiries() });
  const [phones, setPhones] = useState<Record<string, string>>({});
  const assign = async (id: string) => {
    try { await api.assignEnquiry(id, { phone: phones[id] ?? '' }); await qc.invalidateQueries({ queryKey: ['portal'] }); } catch (e) { toast(errorText(e, lang), true); }
  };
  return (
    <Gate q={q}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          {d.items.length === 0 ? <Text style={{ color: colors.muted }}>{t(lang, 'dlNoEnquiries')}</Text> : null}
          {d.items.map((x) => (
            <Card variant="elevated" style={styles.cardGap} key={str(x.id)} testID={`enquiry-${str(x.id)}`}>
              <Text variant="body" weight="bold" style={{ color: colors.text }}>{str(x.name) || '—'} · {str(x.portal)}</Text>
              <Text style={{ color: colors.muted }}>{str(x.unit_code)} {str(x.status)}</Text>
              <Field label={t(lang, 'dlMobile')} value={phones[str(x.id)] ?? ''} onChangeText={(v) => setPhones({ ...phones, [str(x.id)]: v })} keyboardType="phone-pad" />
              <Button testID={`enquiry-assign-${str(x.id)}`} variant="secondary" label={t(lang, 'dlMakeLead')} onPress={() => assign(str(x.id))} />
            </Card>
          ))}
        </ScrollView>
      )}
    </Gate>
  );
}

type LinkRowData = Record<string, unknown>;
const whenText = (v: unknown, lang: Lang) => (v ? rowDate(lang, String(v)) : '');

const LinkItem = memo(function LinkItemView({ x, lang, index }: { x: LinkRowData; lang: Lang; index: number }) {
  const { colors } = useTheme();
  const lead = x.lead as { name?: string | null; ref?: string | null; phone?: string | null } | null;
  return (
    <Animated.View style={styles.item} entering={enter(Math.min(index, 8))} layout={layout}>
      <Card variant="elevated" style={styles.cardGap} testID="link-row">
        <View style={styles.rowBetween}>
          <Text weight="bold" style={[styles.flex1, { color: colors.primaryInk }]}>{str(x.unit_code)}{x.compound ? ` · ${str(x.compound)}` : ''}</Text>
          <Text weight="bold" style={{ color: Number(x.open_count) ? colors.accentInk : colors.muted }}>{Number(x.open_count) ? `${num(x.open_count)} ${t(lang, 'dlOpens')} · ${num(x.devices)} ${t(lang, 'dlDevices')}` : t(lang, 'dlNotOpened')}</Text>
        </View>
        <Text style={{ color: colors.text }}>{[lead?.name || lead?.ref, (str(x.recipient_phone) || lead?.phone) ? ltr(str(x.recipient_phone) || lead?.phone || '') : ''].filter(Boolean).join(' · ') || t(lang, 'dlNoClient')}</Text>
        <Text style={{ color: colors.muted }}>{t(lang, 'dlSent')} {whenText(x.created_at, lang)}{x.sent_by ? ` · ${str(x.sent_by)}` : ''}</Text>
        {x.last_opened_at ? <Text style={{ color: colors.muted }}>{t(lang, 'dlLastOpened')} {whenText(x.last_opened_at, lang)}</Text> : null}
      </Card>
    </Animated.View>
  );
});

/** Links sent to clients: when, to whom, by whom, how often opened. Last 7 days first; filters and "load more" keep it short as it grows. */
export function LinksScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const picked = useRoute<RouteProp<RootStackParams, 'Links'>>().params;
  const [days, setDays] = useState(picked?.days ? String(picked.days) : picked?.leadRef ? 'all' : '7');
  const [status, setStatus] = useState(picked?.opened ? 'opened' : 'all');
  const [text, setText] = useState(picked?.search ?? '');
  const [search, setSearch] = useState(picked?.search ?? '');
  const list = useInfiniteQuery({
    queryKey: ['openedLinks', days, status, search, picked?.leadRef],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.openedLinks(status === 'all' ? undefined : status, pageParam, search || undefined, days === 'all' ? undefined : Number(days), picked?.leadRef),
    getNextPageParam: (last) => (last.page + 1 < last.pages ? last.page + 1 : undefined),
  });
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.rows) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? 0;
  const renderItem = useCallback(({ item, index }: { item: LinkRowData; index: number }) => <LinkItem x={item} lang={lang} index={index} />, [lang]);
  return (
    <FlashList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.listPad}
      keyboardShouldPersistTaps="handled"
      data={rows}
      keyExtractor={(x, i) => str(x.token_hash ?? i)}
      renderItem={renderItem}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
      onEndReachedThreshold={0.6}
      ListHeaderComponent={(
        <View style={styles.head}>
          {picked?.leadRef ? <Text style={{ color: colors.text }}>{[picked.leadLabel, picked.leadRef].filter(Boolean).join(' · ')}</Text> : null}
          <Chips animateFilter testID="links-days" value={days} options={[{ value: '7', label: t(lang, 'dlLast7') }, { value: '30', label: t(lang, 'dlLast30') }, { value: 'all', label: t(lang, 'dlAll') }]} onChange={setDays} />
          <Chips animateFilter testID="links-status" value={status} options={[{ value: 'all', label: t(lang, 'dlAnyStatus') }, { value: 'opened', label: t(lang, 'dlOpened') }, { value: 'never', label: t(lang, 'dlNever') }, { value: 'repeat', label: t(lang, 'dlRepeat') }]} onChange={setStatus} />
          <Field testID="links-search" label={t(lang, 'dlSearchLabel')} value={text} onChangeText={setText} returnKeyType="search" onSubmitEditing={() => setSearch(text.trim())} />
          <Button testID="links-search-go" variant="secondary" label={t(lang, 'dlSearch')} onPress={() => setSearch(text.trim())} />
          {!list.isPending && !list.isError ? <Text style={{ color: colors.muted }}>{total} {t(lang, total === 1 ? 'dlLinkOne' : 'dlLinks')}</Text> : null}
        </View>
      )}
      ListEmptyComponent={list.isPending ? <Loading kind="rows" label={t(lang, 'loading')} /> : list.isError ? <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} /> : <Text style={{ color: colors.muted }}>{t(lang, 'dlNoLinks')}</Text>}
      ListFooterComponent={list.isFetchingNextPage ? <View style={styles.footer}><SkeletonRow /></View> : null}
    />
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md },
  listPad: { padding: spacing.lg },
  item: { marginBottom: spacing.md },
  head: { gap: spacing.md, marginBottom: spacing.md },
  footer: { padding: spacing.lg },
  cardGap: { gap: spacing.xs },
  flex1: { flex: 1 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  devRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  devCopy: { flex: 1, gap: spacing.xs },
});
