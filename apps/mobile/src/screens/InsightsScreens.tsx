import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import NetInfo from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { FilterPicker, PeriodPicker, type PeriodChoice } from '../components/FilterPicker';
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

function formatMinutes(m: number | null | undefined, ar: boolean): string {
  if (m === null || m === undefined) return '—';
  if (m < 60) return `${num(m)} ${ar ? 'د' : 'min'}`;
  if (m < 48 * 60) return `${num(Math.round(m / 60))} ${ar ? 'س' : 'h'}`;
  return `${num(Math.round(m / 1440))} ${ar ? 'يوم' : 'd'}`;
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
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
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
  const title = ranking ? (ar ? 'ترتيب الوسطاء' : 'Broker rankings') : personal ? (ar ? 'ملخصي' : 'My summary') : d.mode === 'team' ? (ar ? 'لوحة الفريق' : 'Team dashboard') : (ar ? 'لوحة الشركة' : 'Agency dashboard');
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.pad, embedded && { paddingBottom: 90 }]}>
      <View style={styles.headerBlock}>
        <Text accessibilityRole="header" style={[styles.h, { color: colors.text }]}>{title}</Text>
      </View>
      <View style={styles.filterBar}>
        <PeriodPicker testID="dash-days" value={period} onChange={setPeriod} />
        {d.team?.length || d.teamLeads?.length ? (
          <FilterPicker
            testID="dash-scope"
            label={ar ? 'النطاق' : 'Scope'}
            value={scope || 'all'}
            onChange={(value) => setScope(value === 'all' ? '' : value)}
            options={[
              { value: 'all', label: ar ? 'كل الشركة' : 'All agency' },
              ...(d.teamLeads ?? []).map((team) => ({ value: 'team:' + team.id, label: ar ? 'فريق ' + team.name : team.name + ' team', hint: ar ? 'فريق' : 'Team' })),
              ...(d.team ?? []).map((broker) => ({ value: 'broker:' + broker.id, label: broker.name })),
            ]}
          />
        ) : null}
      </View>
      {ranking ? <SectionCard title={ar ? 'رتّب حسب' : 'Rank by'}>
        <Chips animateFilter value={metric} onChange={setMetric} options={[
          { value: 'deals', label: ar ? 'عدد الصفقات' : 'Deals closed' },
          { value: 'commission', label: ar ? 'العمولة' : 'Commission' },
          { value: 'responseMin', label: ar ? 'وقت أول رد (الوسيط)' : 'Median first response' },
          { value: 'updates', label: ar ? 'الأقل تحديثاً' : 'Fewest updates' },
        ]} />
        {!ranked.length ? <Text style={{ color: colors.muted }}>{ar ? 'مفيش بيانات للفترة دي.' : 'No data for this period.'}</Text> : null}
        {ranked.map((row) => {
          const val = Number(metricVal(row) ?? 0);
          return (
            <StatRow key={row.id} animate label={row.name}
              value={metric === 'responseMin' ? formatMinutes(val, ar) : num(val) + (metric === 'commission' ? ' ' + t(lang, 'egp') : '')}
              pct={metric === 'responseMin' ? undefined : val / maximum * 100} />
          );
        })}
      </SectionCard> : <>
      <SectionCard title={ar ? 'دلوقتي' : 'Now'}>
        <View style={styles.kpiGrid}>
          {!personal ? (
            <KpiTile
              testID="kpi-unassigned"
              label={scope ? (ar ? 'غير مخصص (على مستوى الشركة)' : 'Unassigned (Agency-wide)') : (ar ? 'عملاء من غير بروكر' : 'Unassigned leads')}
              value={num(d.unassigned)}
              tone={d.unassigned ? 'warn' : 'neutral'}
              onPress={() => nav.navigate('LeadsList', { queue: 'unassigned' })}
            />
          ) : null}
          {!personal && typeof d.waitingOver1h === 'number' ? (
            <KpiTile
              testID="kpi-waiting-over-1h"
              label={ar ? 'انتظار > ساعة' : 'Waiting > 1h'}
              value={num(d.waitingOver1h)}
              tone={d.waitingOver1h ? 'critical' : 'ok'}
              onPress={() => nav.navigate('LeadsList', { queue: 'waiting-over-1h', ...scopeNav })}
            />
          ) : null}
          <KpiTile
            testID="kpi-uncontacted"
            label={ar ? 'ماتكلمش' : 'Not contacted'}
            value={num(d.uncontacted)}
            tone={d.uncontacted ? 'warn' : 'neutral'}
            onPress={() => nav.navigate('LeadsList', { queue: 'uncontacted', ...scopeNav })}
          />
          <KpiTile
            testID="kpi-overdue"
            label={ar ? 'متابعات متأخرة' : 'Overdue follow-ups'}
            value={num(d.overdue)}
            tone={d.overdue ? 'critical' : 'ok'}
            onPress={() => nav.navigate('LeadsList', { tab: 'overdue', ...scopeNav })}
          />
          <KpiTile testID="kpi-units" label={ar ? 'وحدات متاحة' : 'Active units'} value={num(d.units.active)} hint={d.units.stale ? `${ar ? 'قديمة' : 'stale'} ${num(d.units.stale)}` : undefined} tone={d.units.stale ? 'warn' : 'neutral'} />
        </View>
      </SectionCard>
      {d.disciplineSummary ? (
        <SectionCard testID="dash-discipline-summary" title={ar ? 'التزام التحديث في التطبيق' : 'App update discipline'}>
          <View style={styles.kpiGrid}>
            <KpiTile testID="disc-consistent" label={ar ? 'منتظم' : 'Consistent'} value={num(d.disciplineSummary.consistent)} tone="ok" />
            <KpiTile testID="disc-lagging" label={ar ? 'متأخر' : 'Lagging'} value={num(d.disciplineSummary.lagging)} tone={d.disciplineSummary.lagging ? 'warn' : 'neutral'} />
            <KpiTile testID="disc-silent" label={ar ? 'صامت (٤٨ س)' : 'Silent (48h)'} value={num(d.disciplineSummary.silent)} tone={d.disciplineSummary.silent ? 'critical' : 'ok'} />
            <KpiTile testID="disc-no-next" label={ar ? 'بدون خطوة جاية' : 'No next step'} value={num(d.disciplineSummary.totalNoNextStep)} tone={d.disciplineSummary.totalNoNextStep ? 'warn' : 'ok'} />
          </View>
        </SectionCard>
      ) : null}
      <SectionCard title={ar ? 'الفترة' : 'This period'}>
        <View style={styles.kpiGrid}>
          <KpiTile testID="kpi-leads" label={ar ? 'عملاء جدد' : 'New leads'} value={num(d.leads)} />
          <KpiTile testID="kpi-deals" label={ar ? 'صفقات' : 'Deals'} value={num(d.deals.n)} hint={`${num(d.deals.value)} ${t(lang, 'egp')}`} tone={d.deals.n ? 'ok' : 'neutral'} />
          <KpiTile testID="kpi-commission" label={ar ? 'عمولة الصفقات المسجلة' : 'Recorded deal commission'} value={`${num(d.deals.commission)} ${t(lang, 'egp')}`} />
        </View>
        {d.reports?.sources !== false && d.sources.length ? <Text style={{ color: colors.muted }}>{d.sources.map((s) => `${s.source} ${s.n}`).join(' · ')}</Text> : null}
      </SectionCard>
      <SectionCard title={ar ? 'المراحل' : 'Pipeline'}>
        {Object.entries(d.pipeline).map(([k, v]) => <StatRow key={k} animate label={stageLabel(lang, k)} value={String(v)} pct={(Number(v) / Math.max(1, ...Object.values(d.pipeline).map(Number))) * 100} />)}
      </SectionCard>
      {d.weekly.length ? <SectionCard testID="dash-weekly" title={ar ? 'العملاء الجدد · آخر ٨ أسابيع' : 'New leads · last 8 weeks'}>
        {d.weekly.map((value, i) => <StatRow key={i} animate label={d.weeklyRanges?.[i]?.label ?? ((ar ? 'أسبوع ' : 'Week ') + String(i + 1))} value={String(value)} pct={value / Math.max(1, ...d.weekly) * 100} />)}
      </SectionCard> : null}
      {!personal ? <SectionCard title={d.mode === 'team' ? (ar ? 'شغل الفريق' : 'Team workload') : (ar ? 'ترتيب البروكرز' : 'Leaderboard')}>
        {boardRows.length ? boardRows.map((b, i) => {
          const badge = b.discipline === 'consistent'
            ? { tone: 'ok' as const, label: ar ? 'منتظم' : 'Consistent' }
            : b.discipline === 'lagging'
              ? { tone: 'warn' as const, label: ar ? 'متأخر' : 'Lagging' }
              : b.discipline === 'silent'
                ? { tone: 'critical' as const, label: ar ? 'صامت ٤٨ س' : 'Silent 48h' }
                : null;
          const stats = [
            `${num(b.deals)} ${ar ? 'صفقة' : 'deals'}`,
            `${num(b.leads)} ${ar ? 'عميل' : 'leads'}`,
            `${num(b.contacted)} ${ar ? 'تواصل' : 'contacted'}`,
            b.open != null ? `${num(b.open)} ${ar ? 'مفتوح' : 'open'}` : null,
            b.responseMin != null ? `${ar ? 'رد' : 'resp'} ${formatMinutes(b.responseMin, ar)}` : null,
            b.updates != null ? `${num(b.updates)} ${ar ? 'تحديث' : 'updates'}` : null,
            b.noNextStep ? `${num(b.noNextStep)} ${ar ? 'بدون خطوة' : 'no next step'}` : null,
            b.missed ? `${num(b.missed)} ${ar ? 'فايتة' : 'missed'}` : null,
          ].filter(Boolean).join(' · ');
          const last = i === boardRows.length - 1;
          return (
            <View key={b.id} testID={`board-${b.id}`} style={[styles.boardRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
              <View style={styles.boardHead}>
                <Text style={[styles.boardName, { color: colors.text }]}>{b.name}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {badge ? <UrgencyBadge testID={`discipline-badge-${b.id}`} tone={badge.tone} label={badge.label} /> : null}
                  {b.telegramLinked === false ? <UrgencyBadge testID={`telegram-off-${b.id}`} tone="warn" label={ar ? 'تليجرام مش مربوط' : 'Telegram off'} /> : null}
                  {b.commission > 0 ? <UrgencyBadge tone="ok" label={`${num(b.commission)} ${t(lang, 'egp')}`} /> : null}
                </View>
              </View>
              <Text style={{ color: colors.muted }}>{stats}</Text>
            </View>
          );
        }) : <Text style={{ color: colors.muted }}>{ar ? 'مفيش نشاط في الفترة دي.' : 'No activity in this period.'}</Text>}
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
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const ar = lang === 'ar';
  const kinds: ('sale' | 'rent')[] = ['sale', 'rent'];
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
      <Text style={{ color: colors.muted }}>{ar ? `من وحداتك المتاحة بس، لكل مكان فيه ${q.data.minUnits} وحدات أو أكتر. الوسيط = نص الوحدات أغلى ونصها أرخص.` : `From your own active units, for places with ${q.data.minUnits}+ units. Median: half cost more, half less.`}</Text>
      {kinds.map((k) => {
        const rows = q.data.items.filter((r) => r.listing_type === k);
        return (
          <SectionCard key={k} title={k === 'sale' ? (ar ? '🏷️ بيع (ج.م للمتر)' : '🏷️ Sale (EGP per m²)') : (ar ? '🔑 إيجار (ج.م للمتر/شهر)' : '🔑 Rent (EGP per m² a month)')}>
            {rows.length ? rows.map((r) => (
              <Text key={r.place} testID={`price-${k}-${r.place}`} style={{ color: colors.text }}>{r.place} · {r.units} · <Text style={styles.b}>{num(r.median)}</Text> ({num(r.low)}–{num(r.high)})</Text>
            )) : <Text style={{ color: colors.muted }}>{ar ? 'مفيش لسه.' : 'None yet.'}</Text>}
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
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const d = q.data;
  const ar = lang === 'ar';
  const rate = (r: number | null) => (r === null ? '—' : `${r}%`);
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
      <View style={styles.filterBar}>
        <PeriodPicker testID="wl-days" value={period} onChange={setPeriod} />
      </View>
      <SectionCard title={ar ? 'الملخص' : 'Summary'}>
        <View style={styles.kpiGrid}>
          <KpiTile testID="wl-won" label={ar ? 'اتقفلت' : 'Won'} value={num(d.won)} tone="ok" />
          <KpiTile testID="wl-lost" label={ar ? 'ضاعت' : 'Lost'} value={num(d.lost)} tone={d.lost ? 'warn' : 'neutral'} />
          <KpiTile testID="wl-rate" label={ar ? 'نسبة القفل' : 'Win rate'} value={rate(d.rate)} tone="neutral" />
        </View>
        <Text testID="wl-summary" style={{ color: colors.muted, fontSize: 13 }}>{ar ? 'اتقفلت' : 'Won'} {d.won} · {ar ? 'ضاعت' : 'Lost'} {d.lost} · {rate(d.rate)}</Text>
      </SectionCard>
      <SectionCard title={ar ? 'ليه العملاء ضاعوا' : 'Why leads were lost'}>
        {d.reasons.length ? d.reasons.map((r) => <StatRow key={r.key} label={r.key.replace(/_/g, ' ')} value={`${r.n} (${r.pct}%)`} pct={r.pct} />) : <Text style={{ color: colors.muted }}>{ar ? 'مفيش.' : 'None.'}</Text>}
      </SectionCard>
      <SectionCard title={ar ? 'لكل بروكر' : 'Per broker'}>
        {d.brokers.map((g) => <StatRow key={g.key} label={g.name || '—'} value={`${g.won}/${g.lost} · ${rate(g.rate)}`} pct={g.rate ?? 0} />)}
      </SectionCard>
      <SectionCard title={ar ? 'لكل مصدر' : 'Per source'}>
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
  const ar = lang === 'ar';
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
      setMsg(`${ar ? 'وصلنا' : 'Sent'} #R${r.id}`);
      setText('');
      setTimeout(() => nav.goBack(), 1200);
    } catch (e) {
      setMsg(toastError(errorText(e, lang)));
    }
  };
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Text style={{ color: colors.muted }}>{t(lang, 'contactHint')}</Text>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{t(lang, 'contactType')}</Text>
      <Chips testID="report-type" value={type} options={[{ value: 'bug' as const, label: t(lang, 'typeBug') }, { value: 'suggestion' as const, label: t(lang, 'typeSuggestion') }, { value: 'request' as const, label: t(lang, 'typeRequest') }]} onChange={setType} />
      <Field label={ar ? 'اكتب هنا' : 'Write here'} value={text} onChangeText={setText} multiline testID="report-text" />
      {msg ? <Text testID="report-msg" style={{ color: colors.text }}>{msg}</Text> : null}
      <Button testID="report-send" label={ar ? 'ابعت' : 'Send'} onPress={send} />
      <Text selectable style={{ color: colors.muted }}>{t(lang, 'contactEmail')} wehdat.hub@gmail.com</Text>
      <Text style={{ color: colors.muted }}>{t(lang, 'appVersionLabel')}: {APP_VERSION} ({APP_BUILD})</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md },
  headerBlock: { gap: 2 },
  filterBar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  boardRow: { paddingVertical: spacing.xs, gap: 3 },
  boardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  boardName: { fontSize: 15, fontWeight: '700', flex: 1 },
  h: { fontSize: 18, fontWeight: '800' },
  b: { fontWeight: '700' },
});
