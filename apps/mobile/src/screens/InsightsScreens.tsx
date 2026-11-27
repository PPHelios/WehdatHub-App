import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import NetInfo from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Lang } from '@wehdathub/shared';
import type { RootStackParams } from '../navigation';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { FilterPicker, PeriodPicker, type PeriodChoice } from '../components/FilterPicker';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { KpiTile, SectionCard, UrgencyBadge } from '../components/SectionCard';
import { StatRow } from '../components/StatRow';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { stageLabel, t } from '../i18n';
import { APP_BUILD, APP_VERSION } from '../config';
import { usageTrail } from '../usage';
import { spacing, useTheme } from '../theme';
import { toastError } from '../components/Toast';

const num = (n: number) => Number(n).toLocaleString('en-US');

function formatMinutes(m: number | null | undefined, lang: Lang): string {
  if (m === null || m === undefined) return '—';
  if (m < 60) return `${num(m)} ${t(lang, 'ixMin')}`;
  if (m < 48 * 60) return `${num(Math.round(m / 60))} ${t(lang, 'ixHour')}`;
  return `${num(Math.round(m / 1440))} ${t(lang, 'ixDay')}`;
}

/** The agency dashboard for managers: pipeline, the period's totals and the leaderboard. */
export function DashboardScreen({ embedded = false, ranking = false }: { embedded?: boolean; ranking?: boolean } = {}) {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [period, setPeriod] = useState<PeriodChoice>({ days: '30' });
  const [metric, setMetric] = useState<'deals' | 'commission' | 'responseMin' | 'updates'>('deals');
  const [scope, setScope] = useState('');
  const [kind, id] = scope.split(':');
  const rangeParams = period.days === 'custom' && period.from && period.to ? { from: period.from, to: period.to } : undefined;
  const daysNum = period.days === 'custom' ? 30 : Number(period.days);
  const filter = (kind === 'broker' || kind === 'team' || rangeParams)
    ? { ...(kind === 'broker' ? { broker: id } : kind === 'team' ? { team: id } : {}), ...(rangeParams ?? {}) }
    : undefined;
  const scopeNav = kind === 'broker' ? { broker: id } : kind === 'team' ? { team: id } : {};
  const q = useQuery({
    queryKey: ['dashboard', period.days, period.from ?? '', period.to ?? '', scope],
    queryFn: () => filter ? api.dashboard(daysNum, filter) : api.dashboard(daysNum),
  });
  if (q.isPending) return <Loading kind="cards" label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => q.refetch()} altLabel={scope ? t(lang, 'clear') : undefined} onAlt={scope ? () => setScope('') : undefined} />;
  const d = q.data;
  const ar = lang === 'ar';
  const personal = d.mode === 'solo';
  const metricVal = (row: (typeof d.board)[number]): number | null =>
    metric === 'updates' ? (row.updates ?? null) : (row[metric] ?? null);
  const ranked = d.board
    .filter((row) => metricVal(row) != null)
    .sort((a, b) => metric === 'responseMin'
      ? Number(metricVal(a)) - Number(metricVal(b))
      : metric === 'updates'
        ? Number(metricVal(a)) - Number(metricVal(b)) || (b.noNextStep ?? 0) - (a.noNextStep ?? 0)
        : Number(metricVal(b)) - Number(metricVal(a)));
  const boardRows = metric === 'updates'
    ? [...d.board].sort((a, b) => (a.updates ?? 0) - (b.updates ?? 0) || (b.noNextStep ?? 0) - (a.noNextStep ?? 0))
    : d.board;
  const maximum = Math.max(1, ...ranked.map((row) => Number(metricVal(row) ?? 0)));
  const title = ranking ? t(lang, 'ixRank') : personal ? t(lang, 'ixMine') : d.mode === 'team' ? t(lang, 'ixTeamDash') : t(lang, 'ixAgencyDash');
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.pad, embedded && styles.embeddedPad]}>
      <View style={styles.headerBlock}>
        <ScreenHeader title={title} />
      </View>
      <View style={styles.filterBar}>
        <PeriodPicker testID="dash-days" value={period} onChange={setPeriod} />
        {d.team?.length || d.teamLeads?.length ? (
          <FilterPicker
            testID="dash-scope"
            label={t(lang, 'ixScope')}
            value={scope || 'all'}
            onChange={(value) => setScope(value === 'all' ? '' : value)}
            options={[
              { value: 'all', label: t(lang, 'ixAllAgency') },
              ...(d.teamLeads ?? []).map((team) => ({ value: 'team:' + team.id, label: ar ? t(lang, 'ixTeamWord') + ' ' + team.name : team.name + ' ' + t(lang, 'ixTeamWord'), hint: t(lang, 'ixTeamHint') })),
              ...(d.team ?? []).map((broker) => ({ value: 'broker:' + broker.id, label: broker.name })),
            ]}
          />
        ) : null}
      </View>
      {ranking ? <SectionCard title={t(lang, 'ixRankBy')}>
        <Chips animateFilter value={metric} onChange={setMetric} options={[
          { value: 'deals', label: t(lang, 'ixDealsClosed') },
          { value: 'commission', label: t(lang, 'ixCommission') },
          { value: 'responseMin', label: t(lang, 'ixMedianResp') },
          { value: 'updates', label: t(lang, 'ixFewestUpdates') },
        ]} />
        {!ranked.length ? <Text style={{ color: colors.muted }}>{t(lang, 'ixNoData')}</Text> : null}
        {ranked.map((row) => {
          const val = Number(metricVal(row) ?? 0);
          return (
            <StatRow key={row.id} animate label={row.name}
              value={metric === 'responseMin' ? formatMinutes(val, lang) : num(val) + (metric === 'commission' ? ' ' + t(lang, 'egp') : '')}
              pct={metric === 'responseMin' ? undefined : val / maximum * 100} />
          );
        })}
      </SectionCard> : <>
      <SectionCard title={t(lang, 'ixNow')}>
        <View style={styles.kpiGrid}>
          {!personal ? (
            <KpiTile
              testID="kpi-unassigned"
              label={scope ? t(lang, 'ixUnassignedAgency') : t(lang, 'ixUnassignedLeads')}
              value={num(d.unassigned)}
              tone={d.unassigned ? 'warn' : 'neutral'}
              onPress={() => nav.navigate('LeadsList', { queue: 'unassigned' })}
            />
          ) : null}
          {!personal && typeof d.waitingOver1h === 'number' ? (
            <KpiTile
              testID="kpi-waiting-over-1h"
              label={t(lang, 'ixWaiting')}
              value={num(d.waitingOver1h)}
              tone={d.waitingOver1h ? 'critical' : 'ok'}
              onPress={() => nav.navigate('LeadsList', { queue: 'waiting-over-1h', ...scopeNav })}
            />
          ) : null}
          <KpiTile
            testID="kpi-uncontacted"
            label={t(lang, 'ixNotContacted')}
            value={num(d.uncontacted)}
            tone={d.uncontacted ? 'warn' : 'neutral'}
            onPress={() => nav.navigate('LeadsList', { queue: 'uncontacted', ...scopeNav })}
          />
          <KpiTile
            testID="kpi-overdue"
            label={t(lang, 'ixOverdueFu')}
            value={num(d.overdue)}
            tone={d.overdue ? 'critical' : 'ok'}
            onPress={() => nav.navigate('LeadsList', { tab: 'overdue', ...scopeNav })}
          />
          <KpiTile testID="kpi-units" label={t(lang, 'ixActiveUnits')} value={num(d.units.active)} hint={d.units.stale ? `${t(lang, 'ixStale')} ${num(d.units.stale)}` : undefined} tone={d.units.stale ? 'warn' : 'neutral'} />
        </View>
      </SectionCard>
      {d.disciplineSummary ? (
        <SectionCard testID="dash-discipline-summary" title={t(lang, 'ixDiscipline')}>
          <View style={styles.kpiGrid}>
            <KpiTile testID="disc-consistent" label={t(lang, 'ixConsistent')} value={num(d.disciplineSummary.consistent)} tone="ok" />
            <KpiTile testID="disc-lagging" label={t(lang, 'ixLagging')} value={num(d.disciplineSummary.lagging)} tone={d.disciplineSummary.lagging ? 'warn' : 'neutral'} />
            <KpiTile testID="disc-silent" label={t(lang, 'ixSilent48')} value={num(d.disciplineSummary.silent)} tone={d.disciplineSummary.silent ? 'critical' : 'ok'} />
            <KpiTile testID="disc-no-next" label={t(lang, 'ixNoNext')} value={num(d.disciplineSummary.totalNoNextStep)} tone={d.disciplineSummary.totalNoNextStep ? 'warn' : 'ok'} />
          </View>
        </SectionCard>
      ) : null}
      <SectionCard title={t(lang, 'ixThisPeriod')}>
        <View style={styles.kpiGrid}>
          <KpiTile testID="kpi-leads" label={t(lang, 'ixNewLeads')} value={num(d.leads)} />
          <KpiTile testID="kpi-deals" label={t(lang, 'ixDealsCap')} value={num(d.deals.n)} hint={`${num(d.deals.value)} ${t(lang, 'egp')}`} tone={d.deals.n ? 'ok' : 'neutral'} />
          <KpiTile testID="kpi-commission" label={t(lang, 'ixRecordedComm')} value={`${num(d.deals.commission)} ${t(lang, 'egp')}`} />
        </View>
        {d.reports?.sources !== false && d.sources.length ? <Text style={{ color: colors.muted }}>{d.sources.map((s) => `${s.source} ${s.n}`).join(' · ')}</Text> : null}
      </SectionCard>
      <SectionCard title={t(lang, 'ixPipeline')}>
        {Object.entries(d.pipeline).map(([k, v]) => <StatRow key={k} animate label={stageLabel(lang, k)} value={String(v)} pct={(Number(v) / Math.max(1, ...Object.values(d.pipeline).map(Number))) * 100} />)}
      </SectionCard>
      {d.weekly.length ? <SectionCard testID="dash-weekly" title={t(lang, 'ixWeekly')}>
        {d.weekly.map((value, i) => <StatRow key={i} animate label={d.weeklyRanges?.[i]?.label ?? (t(lang, 'ixWeek') + ' ' + String(i + 1))} value={String(value)} pct={value / Math.max(1, ...d.weekly) * 100} />)}
      </SectionCard> : null}
      {!personal ? <SectionCard title={d.mode === 'team' ? t(lang, 'ixTeamWorkload') : t(lang, 'ixLeaderboard')}>
        {boardRows.length ? boardRows.map((b, i) => {
          const badge = b.discipline === 'consistent'
            ? { tone: 'ok' as const, label: t(lang, 'ixConsistent') }
            : b.discipline === 'lagging'
              ? { tone: 'warn' as const, label: t(lang, 'ixLagging') }
              : b.discipline === 'silent'
                ? { tone: 'critical' as const, label: t(lang, 'ixSilentBadge') }
                : null;
          const stats = [
            `${num(b.deals)} ${t(lang, 'ixSDeals')}`,
            `${num(b.leads)} ${t(lang, 'ixSLeads')}`,
            `${num(b.contacted)} ${t(lang, 'ixSContacted')}`,
            b.open != null ? `${num(b.open)} ${t(lang, 'ixSOpen')}` : null,
            b.responseMin != null ? `${t(lang, 'ixSResp')} ${formatMinutes(b.responseMin, lang)}` : null,
            b.updates != null ? `${num(b.updates)} ${t(lang, 'ixSUpdates')}` : null,
            b.noNextStep ? `${num(b.noNextStep)} ${t(lang, 'ixSNoNext')}` : null,
            b.missed ? `${num(b.missed)} ${t(lang, 'ixSMissed')}` : null,
          ].filter(Boolean).join(' · ');
          const last = i === boardRows.length - 1;
          return (
            <View key={b.id} testID={`board-${b.id}`} style={[styles.boardRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
              <View style={styles.boardHead}>
                <Text variant="body" weight="bold" style={[styles.flex1, { color: colors.text }]}>{b.name}</Text>
                <View style={styles.badgeRow}>
                  {badge ? <UrgencyBadge testID={`discipline-badge-${b.id}`} tone={badge.tone} label={badge.label} /> : null}
                  {b.telegramLinked === false ? <UrgencyBadge testID={`telegram-off-${b.id}`} tone="warn" label={t(lang, 'ixTelegramOff')} /> : null}
                  {b.commission > 0 ? <UrgencyBadge tone="ok" label={`${num(b.commission)} ${t(lang, 'egp')}`} /> : null}
                </View>
              </View>
              <Text style={{ color: colors.muted }}>{stats}</Text>
            </View>
          );
        }) : <Text style={{ color: colors.muted }}>{t(lang, 'ixNoActivity')}</Text>}
      </SectionCard> : null}
      </>}
    </ScrollView>
  );
}

/** Price per m² by compound or area, from the agency's own active units. */
export function PricesScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const q = useQuery({ queryKey: ['prices'], queryFn: () => api.pricePerM2() });
  if (q.isPending) return <Loading kind="cards" label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const kinds: ('sale' | 'rent')[] = ['sale', 'rent'];
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
      <Text style={{ color: colors.muted }}>{t(lang, 'ixPricesHint').replace('{n}', String(q.data.minUnits))}</Text>
      {kinds.map((k) => {
        const rows = q.data.items.filter((r) => r.listing_type === k);
        return (
          <SectionCard key={k} title={k === 'sale' ? t(lang, 'ixSale') : t(lang, 'ixRent')} action={<Icon name={k === 'sale' ? 'tag' : 'key'} color={colors.muted} size={20} />}>
            {rows.length ? rows.map((r) => (
              <Text key={r.place} testID={`price-${k}-${r.place}`} style={{ color: colors.text }}>{r.place} · {r.units} · <Text weight="bold">{num(r.median)}</Text> ({num(r.low)}–{num(r.high)})</Text>
            )) : <Text style={{ color: colors.muted }}>{t(lang, 'ixNone')}</Text>}
          </SectionCard>
        );
      })}
    </ScrollView>
  );
}

/** Win and loss for managers: won, lost, why, and per broker and source. */
export function WinLossScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const [period, setPeriod] = useState<PeriodChoice>({ days: '30' });
  const rangeParams = period.days === 'custom' && period.from && period.to ? { from: period.from, to: period.to } : undefined;
  const daysNum = period.days === 'custom' ? 30 : Number(period.days);
  const q = useQuery({
    queryKey: ['winloss', period.days, period.from ?? '', period.to ?? ''],
    queryFn: () => api.winLoss(daysNum, rangeParams),
  });
  if (q.isPending) return <Loading kind="cards" label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const d = q.data;
  const rate = (r: number | null) => (r === null ? '—' : `${r}%`);
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
      <View style={styles.filterBar}>
        <PeriodPicker testID="wl-days" value={period} onChange={setPeriod} />
      </View>
      <SectionCard title={t(lang, 'ixSummary')}>
        <View style={styles.kpiGrid}>
          <KpiTile testID="wl-won" label={t(lang, 'ixWon')} value={num(d.won)} tone="ok" />
          <KpiTile testID="wl-lost" label={t(lang, 'ixLost')} value={num(d.lost)} tone={d.lost ? 'warn' : 'neutral'} />
          <KpiTile testID="wl-rate" label={t(lang, 'ixWinRate')} value={rate(d.rate)} tone="neutral" />
        </View>
        <Text variant="bodySm" testID="wl-summary" style={{ color: colors.muted }}>{t(lang, 'ixWon')} {d.won} · {t(lang, 'ixLost')} {d.lost} · {rate(d.rate)}</Text>
      </SectionCard>
      <SectionCard title={t(lang, 'ixWhyLost')}>
        {d.reasons.length ? d.reasons.map((r) => <StatRow key={r.key} label={r.key.replace(/_/g, ' ')} value={`${r.n} (${r.pct}%)`} pct={r.pct} />) : <Text style={{ color: colors.muted }}>{t(lang, 'ixNoneShort')}</Text>}
      </SectionCard>
      <SectionCard title={t(lang, 'ixPerBroker')}>
        {d.brokers.map((g) => <StatRow key={g.key} label={g.name || '—'} value={`${g.won}/${g.lost} · ${rate(g.rate)}`} pct={g.rate ?? 0} />)}
      </SectionCard>
      <SectionCard title={t(lang, 'ixPerSource')}>
        {d.sources.map((g) => <StatRow key={g.key} label={g.key} value={`${g.won}/${g.lost} · ${rate(g.rate)}`} pct={g.rate ?? 0} />)}
      </SectionCard>
    </ScrollView>
  );
}

/** Contact us: a problem, a suggestion or a request to the team. The app version, phone type, screen and last actions go with it. */
export function ReportScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation();
  const [text, setText] = useState('');
  const [type, setType] = useState<'bug' | 'suggestion' | 'request'>('bug');
  const [msg, setMsg] = useState<string | null>(null);
  const send = async () => {
    setMsg(null);
    if (text.trim().length < 3) return;
    try {
      const routes = nav.getState?.()?.routes ?? [];
      const net = await Promise.resolve().then(() => NetInfo.fetch()).catch(() => null);
      const device = {
        appVersion: `${APP_VERSION} (${APP_BUILD})`,
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        model: String((Platform.constants as { Model?: string })?.Model ?? ''),
        screen: String(routes.length > 1 ? routes[routes.length - 2].name : ''),
        network: net ? `${net.type}${net.isConnected ? '' : ' offline'}` : '',
        locale: lang,
        trail: usageTrail(),
      };
      const r = await api.report(text.trim(), { type, device });
      setMsg(`${t(lang, 'ixSentMsg')} #R${r.id}`);
      setText('');
      setTimeout(() => nav.goBack(), 1200);
    } catch (e) {
      setMsg(toastError(errorText(e, lang)));
    }
  };
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Text style={{ color: colors.muted }}>{t(lang, 'contactHint')}</Text>
      <Text weight="bold" style={{ color: colors.text }}>{t(lang, 'contactType')}</Text>
      <Chips testID="report-type" value={type} options={[{ value: 'bug' as const, label: t(lang, 'typeBug') }, { value: 'suggestion' as const, label: t(lang, 'typeSuggestion') }, { value: 'request' as const, label: t(lang, 'typeRequest') }]} onChange={setType} />
      <Field label={t(lang, 'ixWriteHere')} value={text} onChangeText={setText} multiline testID="report-text" />
      {msg ? <Text testID="report-msg" style={{ color: colors.text }}>{msg}</Text> : null}
      <Button testID="report-send" label={t(lang, 'ixSend')} onPress={send} />
      <Text selectable style={{ color: colors.muted }}>{t(lang, 'contactEmail')} wehdat.hub@gmail.com</Text>
      <Text style={{ color: colors.muted }}>{t(lang, 'appVersionLabel')}: {APP_VERSION} ({APP_BUILD})</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md },
  embeddedPad: { paddingBottom: 90 },
  // ScreenHeader brings its own side padding; cancel the page's.
  headerBlock: { marginHorizontal: -spacing.lg },
  filterBar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  flex1: { flex: 1 },
  boardRow: { paddingVertical: spacing.xs, gap: spacing.xs },
  boardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
