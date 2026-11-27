import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { ApiClientError, ltr, type Lang, type AssistantCard, type AssistantQueryResponse, type BrokerDiscipline, type LeadQueue } from '@wehdathub/shared';
import { looksLikePhone } from './PhoneText';
import { errorText } from '../errors';
import { t } from '../i18n';
import { spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Chip } from './Chip';
import { KpiTile, SectionCard, UrgencyBadge, type BadgeTone } from './SectionCard';
import { BarBreakdown } from './charts/BarBreakdown';
import { Compare } from './charts/Compare';
import { MetricRow } from './charts/MetricRow';
import { PriceRange } from './charts/PriceRange';
import { Share as ShareChart } from './charts/Share';
import { Trend } from './charts/Trend';
import { UnitCard } from './UnitCard';

const langOf = (isAr: boolean): Lang => (isAr ? 'ar' : 'en');
/** Fills `{key}` placeholders in a translated string. */
const fill = (s: string, vars: Record<string, string | number>): string => s.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? ''));

function disciplineMeta(d: BrokerDiscipline | undefined, lang: Lang): { tone: BadgeTone; label: string } | null {
  if (d === 'consistent') return { tone: 'ok', label: t(lang, 'ac_consistent') };
  if (d === 'lagging') return { tone: 'warn', label: t(lang, 'ac_lagging') };
  if (d === 'silent') return { tone: 'critical', label: t(lang, 'ac_silent48') };
  return null;
}

/** Builds a clean summary safe to share externally — never includes client names or phones. */
function buildShareSummary(response: AssistantQueryResponse, lang: Lang): string {
  const lines: string[] = [response.headline];
  if (response.windowLabel) lines.push(response.windowLabel);
  for (const card of response.cards ?? []) {
    if (card.kind === 'metric_row') {
      for (const item of card.items ?? []) lines.push(`${item.label}: ${item.value}${item.unit ? ` ${item.unit}` : ''}`);
    } else if (card.kind === 'bar_breakdown') {
      lines.push(card.title);
      for (const r of (card.rows ?? []).slice(0, 6)) lines.push(`• ${r.label}: ${r.valueLabel ?? r.count}`);
    } else if (card.kind === 'trend' || card.kind === 'share' || card.kind === 'price_range' || card.kind === 'compare') {
      lines.push(card.summary);
    } else if (card.kind === 'broker_scorecard') {
      const b = card.broker;
      lines.push(`${b.name}: ${b.deals} ${t(lang, 'ac_deals')} · ${b.updates ?? 0} ${t(lang, 'ac_updatesW')} · ${b.noNextStep ?? 0} ${t(lang, 'ac_noStep')}`);
    } else if (card.kind === 'broker_discipline') {
      const s = card.summary;
      lines.push(fill(t(lang, 'ac_shDisc'), { c: s.consistent, l: s.lagging, s: s.silent }));
    } else if (card.kind === 'stuck_leads') {
      lines.push(fill(t(lang, 'ac_shStuck'), { n: card.total, list: card.items.map((i) => i.ref).join(`${t(lang, 'ac_sep')} `) }));
    } else if (card.kind === 'text_answer') {
      lines.push(card.answer ?? '');
    }
  }
  return lines.filter(Boolean).join('\n');
}

function CardBody({
  card,
  ar,
  reassigned,
  nudged,
  busyRefs,
  rowErrors,
  onAssign,
  onNudge,
  onOpenLead,
  onSelectOption,
  onNavigate,
}: {
  card: AssistantCard;
  ar: boolean;
  reassigned: Record<string, string>;
  nudged: Record<string, boolean>;
  busyRefs: Record<string, boolean>;
  rowErrors: Record<string, string>;
  onAssign: (ref: string, brokerId: string, brokerName: string, version?: number) => void;
  onNudge: (ref: string) => void;
  onOpenLead: (ref: string) => void;
  onSelectOption?: (query: string) => void;
  onNavigate?: (screen: string, params?: Record<string, unknown>) => void;
}) {
  const { colors } = useTheme();
  const lang = langOf(ar);
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const num = (v: number) => v.toLocaleString(locale);

  if (card.kind === 'broker_scorecard') {
    const b = card.broker;
    const badge = disciplineMeta(b.discipline, lang);
    return (
      <SectionCard
        testID="card-broker-scorecard"
        title={b.name}
        action={
          <View style={styles.badgeRow}>
            <Avatar name={b.name} uri={b.avatarUrl} size={40} />
            {badge ? <UrgencyBadge tone={badge.tone} label={badge.label} /> : null}
            {b.telegramLinked === false ? <UrgencyBadge tone="warn" label={t(lang, 'ac_tgOff')} /> : null}
          </View>
        }
      >
        <View style={styles.kpiGrid}>
          <KpiTile label={t(lang, 'ac_appUpdates')} value={num(b.updates ?? 0)} hint={fill(t(lang, 'ac_updates48'), { n: num(b.updates48h ?? 0) })} tone={b.discipline === 'silent' ? 'critical' : b.discipline === 'lagging' ? 'warn' : 'ok'} />
          <KpiTile label={t(lang, 'ac_openLeads')} value={num(b.open ?? 0)} hint={b.noNextStep ? `${num(b.noNextStep)} ${t(lang, 'ac_noStep')}` : undefined} tone={b.noNextStep ? 'warn' : 'neutral'} />
          <KpiTile label={t(lang, 'ac_medianReply')} value={b.responseMin != null ? `${num(b.responseMin)} ${t(lang, 'ac_min')}` : '—'} />
          <KpiTile label={t(lang, 'ac_dealsMissed')} value={`${num(b.deals)} / ${num(b.missed ?? 0)}`} tone={b.missed ? 'warn' : 'ok'} />
        </View>
      </SectionCard>
    );
  }

  if (card.kind === 'broker_discipline') {
    const s = card.summary;
    return (
      <SectionCard testID="card-broker-discipline" title={t(lang, 'ac_discTitle')}>
        <View style={styles.kpiGrid}>
          <KpiTile label={t(lang, 'ac_consistent')} value={num(s.consistent)} tone="ok" />
          <KpiTile label={t(lang, 'ac_lagging')} value={num(s.lagging)} tone={s.lagging ? 'warn' : 'neutral'} />
          <KpiTile label={t(lang, 'ac_silent48')} value={num(s.silent)} tone={s.silent ? 'critical' : 'ok'} />
        </View>
        {card.rows.map((b, idx) => {
          const badge = disciplineMeta(b.discipline, lang);
          return (
            <View key={b.id} style={[styles.rowItem, idx < card.rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
              <View style={styles.rowTop}>
                <Text variant="bodySm" weight="bold" style={[styles.rowName, { color: colors.text }]}>{b.name}</Text>
                <View style={styles.badgeRow}>
                  {badge ? <UrgencyBadge tone={badge.tone} label={badge.label} /> : null}
                  {b.telegramLinked === false ? <UrgencyBadge tone="warn" label={t(lang, 'ac_tgOff')} /> : null}
                </View>
              </View>
              <Text variant="bodySm" style={{ color: colors.muted }}>
                {[
                  `${num(b.updates48h ?? 0)} ${t(lang, 'ac_upd48')}`,
                  `${num(b.noNextStep ?? 0)} ${t(lang, 'ac_noStep')}`,
                  b.missed ? `${num(b.missed)} ${t(lang, 'ac_missed')}` : null,
                ].filter(Boolean).join(' · ')}
              </Text>
            </View>
          );
        })}
      </SectionCard>
    );
  }

  if (card.kind === 'stuck_leads') {
    return (
      <SectionCard testID="card-stuck-leads" title={card.title || t(lang, 'ac_stuckTitle')} subtitle={`${num(card.total)}`}>
        {card.items.length === 0 ? (
          <Text style={{ color: colors.muted }}>{t(lang, 'ac_noneStuck')}</Text>
        ) : card.items.map((item, idx) => {
          const recs = card.recommendedBrokers.filter((b) => b.id !== item.assigneeId).slice(0, 2);
          const doneTo = reassigned[item.ref];
          const wasNudged = nudged[item.ref];
          const busy = Boolean(busyRefs[item.ref]);
          const rowError = rowErrors[item.ref];
          return (
            <View key={item.ref} style={[styles.rowItem, idx < card.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
              <Pressable accessibilityRole="button" onPress={() => onOpenLead(item.ref)} style={styles.rowTop}>
                <View style={styles.rowWho}>
                  {item.assigneeId ? <Avatar name={item.assignee} uri={item.avatarUrl} size={28} /> : null}
                  <Text variant="bodySm" weight="bold" style={[styles.rowName, { color: colors.text }]}>{item.ref}{item.name ? ` · ${looksLikePhone(item.name) ? ltr(item.name) : item.name}` : ''}</Text>
                </View>
                <UrgencyBadge tone="warn" label={doneTo ? `→ ${doneTo}` : (item.assignee || t(lang, 'ac_noBroker'))} />
              </Pressable>
              <Text variant="bodySm" style={{ color: colors.muted }}>{item.stage}</Text>
              {rowError ? <Text variant="bodySm" testID={`assistant-row-error-${item.ref}`} style={{ color: colors.danger }}>{rowError}</Text> : null}
              <View style={styles.actionsWrap}>
                {card.canAssign && !doneTo && recs.map((b) => (
                  <Chip
                    key={b.id}
                    testID={`assistant-reassign-${item.ref}-${b.id}`}
                    disabled={busy}
                    label={`→ ${b.name} (${num(b.open)})`}
                    onPress={() => { if (!busy) onAssign(item.ref, b.id, b.name, item.version); }}
                  />
                ))}
                {card.canNudge && item.assigneeId ? (
                  <Chip
                    testID={`assistant-nudge-${item.ref}`}
                    disabled={busy || Boolean(wasNudged)}
                    selected={Boolean(wasNudged)}
                    label={t(lang, wasNudged ? 'ac_nudged' : 'ac_askUpdate')}
                    onPress={() => { if (!busy && !wasNudged) onNudge(item.ref); }}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
      </SectionCard>
    );
  }

  if (card.kind === 'metric_row') return <MetricRow card={card} num={num} onNavigate={onNavigate} />;
  if (card.kind === 'bar_breakdown') return <BarBreakdown card={card} num={num} onNavigate={onNavigate} />;
  if (card.kind === 'trend') return <Trend card={card} onNavigate={onNavigate} />;
  if (card.kind === 'share') return <ShareChart card={card} num={num} onNavigate={onNavigate} />;
  if (card.kind === 'price_range') return <PriceRange card={card} onNavigate={onNavigate} />;
  if (card.kind === 'compare') return <Compare card={card} onNavigate={onNavigate} />;

  if (card.kind === 'disambiguate') {
    const options = card.options ?? [];
    return (
      <SectionCard
        testID="card-disambiguate"
        title={card.prompt ? fill(t(lang, 'ac_pickFor'), { q: card.prompt }) : t(lang, 'ac_pick')}
      >
        <View style={styles.actionsWrap}>
          {options.map((opt) => (
            <Chip key={opt.id} testID={`disambiguate-opt-${opt.id}`} label={opt.label} onPress={() => onSelectOption?.(opt.query)} />
          ))}
        </View>
      </SectionCard>
    );
  }

  return (
    <SectionCard testID="card-text-answer">
      <Text selectable variant="body" style={{ color: colors.text }}>{card.answer ?? (card as { summary?: string }).summary ?? ''}</Text>
      {card.source === 'local' ? <Text variant="bodySm" style={{ color: colors.muted }}>{t(lang, 'ac_localAnswer')}</Text> : null}
      {card.dataDates ? <Text variant="caption" style={{ color: colors.muted }}>{card.dataDates}</Text> : null}
    </SectionCard>
  );
}

/** The server's next-step buttons: search every market, pivot to Primary, change the search. `serverOnly` skips the generic "change search" button when the server sent no such action. */
export function AssistantActions({ response, query, ar, onViewAllMarkets, onPivotPrimary, onChangeSearch, serverOnly }: {
  response: AssistantQueryResponse;
  query: string;
  ar: boolean;
  onViewAllMarkets?: (q: string) => void;
  onPivotPrimary: (q: string) => void;
  onChangeSearch?: (q: string) => void;
  serverOnly?: boolean;
}) {
  const lang = langOf(ar);
  const pivotAction = response.actions?.find((a) => a.kind === 'pivot_mode');
  const viewAllMarketsAction = response.actions?.find((a): a is Extract<typeof a, { kind: 'view_all_markets' }> => a.kind === 'view_all_markets');
  const changeSearchAction = response.actions?.find((a): a is Extract<typeof a, { kind: 'change_search' }> => a.kind === 'change_search');
  const showPivot = Boolean(response.suggestPrimary || pivotAction);
  return (
    <>
      {viewAllMarketsAction && onViewAllMarkets ? (
        <Button testID="assistant-view-all-markets" variant="secondary" label={viewAllMarketsAction.label} onPress={() => onViewAllMarkets(query)} />
      ) : null}
      {showPivot ? (
        <Button
          testID="assistant-pivot-primary"
          variant="secondary"
          label={pivotAction?.label || t(lang, 'ac_pivotPrimary')}
          onPress={() => onPivotPrimary(query)}
        />
      ) : null}
      {onChangeSearch && (changeSearchAction || (!serverOnly && query.trim())) ? (
        <Button testID="assistant-change-search" variant="quiet" label={changeSearchAction?.label || t(lang, 'changeSearch')} onPress={() => onChangeSearch(changeSearchAction?.query ?? query)} />
      ) : null}
    </>
  );
}

/** Renders Option B visual accountability/executive/resale assistant responses with inline actions. */
export function AssistantCards({
  response,
  query,
  ar,
  onAssignLead,
  onNudgeLead,
  onOpenLead,
  onOpenUnit,
  onPivotPrimary,
  onNavigateLink,
  onOpenQueue,
  onShareSummary,
  onViewAllMarkets,
  onChangeSearch,
  onSelectOption,
  extraFooter,
  embedded,
  leadLine,
}: {
  response: AssistantQueryResponse;
  query: string;
  ar: boolean;
  onAssignLead: (ref: string, brokerId: string, version?: number) => Promise<void>;
  onNudgeLead: (ref: string) => Promise<void>;
  onOpenLead: (ref: string) => void;
  onOpenUnit: (code: string) => void;
  onPivotPrimary: (q: string) => void;
  onNavigateLink: (screen: string, params?: Record<string, unknown>) => void;
  onOpenQueue: (queue: LeadQueue) => void;
  onShareSummary?: () => void;
  onViewAllMarkets?: (q: string) => void;
  onChangeSearch?: (q: string) => void;
  onSelectOption?: (query: string) => void;
  extraFooter?: React.ReactNode;
  /** Inside a chat turn: no own scroll view, and the turn supplies the opening line. */
  embedded?: boolean;
  leadLine?: string;
}) {
  const { colors } = useTheme();
  const lang = langOf(ar);
  const [reassigned, setReassigned] = useState<Record<string, string>>({});
  const [nudged, setNudged] = useState<Record<string, boolean>>({});
  const busyLockRef = useRef<Record<string, boolean>>({});
  const [busyRefs, setBusyRefs] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const viewAllMarketsAction = response.actions?.find((a) => a.kind === 'view_all_markets');
  const pivotAction = response.actions?.find((a) => a.kind === 'pivot_mode');
  const showPivot = Boolean(response.suggestPrimary || pivotAction);
  const queueActions = (response.actions ?? []).filter((a): a is Extract<typeof a, { kind: 'open_queue' }> => a.kind === 'open_queue');
  const appliedFilters = response.understood?.appliedFilters ?? [];

  const formatActionError = (e: unknown): string => {
    if (e instanceof ApiClientError && e.status === 409) {
      return t(lang, 'ac_conflict');
    }
    return errorText(e, lang);
  };

  const clearRowError = (ref: string) => {
    setRowErrors((prev) => {
      if (!prev[ref]) return prev;
      const next = { ...prev };
      delete next[ref];
      return next;
    });
  };

  const handleAssign = async (ref: string, brokerId: string, brokerName: string, version?: number) => {
    if (busyLockRef.current[ref]) return;
    busyLockRef.current[ref] = true;
    setBusyRefs((prev) => ({ ...prev, [ref]: true }));
    setActionError(null);
    clearRowError(ref);
    try {
      await onAssignLead(ref, brokerId, version);
      setReassigned((prev) => ({ ...prev, [ref]: brokerName }));
    } catch (e) {
      const msg = formatActionError(e);
      setRowErrors((prev) => ({ ...prev, [ref]: msg }));
      setActionError(msg);
    } finally {
      busyLockRef.current[ref] = false;
      setBusyRefs((prev) => ({ ...prev, [ref]: false }));
    }
  };

  const handleNudge = async (ref: string) => {
    if (busyLockRef.current[ref]) return;
    busyLockRef.current[ref] = true;
    setBusyRefs((prev) => ({ ...prev, [ref]: true }));
    setActionError(null);
    clearRowError(ref);
    try {
      await onNudgeLead(ref);
      setNudged((prev) => ({ ...prev, [ref]: true }));
    } catch (e) {
      const msg = formatActionError(e);
      setRowErrors((prev) => ({ ...prev, [ref]: msg }));
      setActionError(msg);
    } finally {
      busyLockRef.current[ref] = false;
      setBusyRefs((prev) => ({ ...prev, [ref]: false }));
    }
  };

  const Root: React.ElementType = embedded ? View : ScrollView;
  const rootProps = embedded ? { style: styles.embedded } : { keyboardShouldPersistTaps: 'handled', contentContainerStyle: styles.container };

  return (
    <Root {...rootProps}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text variant="heading" testID="assistant-headline" accessibilityRole="header" style={{ color: colors.text }}>{leadLine ?? response.headline}</Text>
          {response.windowLabel ? <Text variant="bodySm" style={{ color: colors.muted }}>{response.windowLabel}</Text> : null}
        </View>
        <Chip
          testID="assistant-share-summary"
          label={t(lang, 'shareSummary')}
          onPress={() => {
            onShareSummary?.();
            void Share.share({ message: buildShareSummary(response, lang) }).catch(() => undefined);
          }}
        />
      </View>

      {actionError ? <Text testID="assistant-action-error" variant="bodySm" style={{ color: colors.danger }}>{actionError}</Text> : null}

      {appliedFilters.length ? (
        <View testID="assistant-understood" style={styles.badgeRow}>
          {appliedFilters.map((f, i) => (
            <Chip key={`${f}-${i}`} label={f} />
          ))}
        </View>
      ) : null}

      {(response.cards ?? []).map((card, i) => (
        <CardBody
          key={`${card.kind}-${i}`}
          card={card}
          ar={ar}
          reassigned={reassigned}
          nudged={nudged}
          busyRefs={busyRefs}
          rowErrors={rowErrors}
          onAssign={(ref, id, name, version) => void handleAssign(ref, id, name, version)}
          onNudge={(ref) => void handleNudge(ref)}
          onOpenLead={onOpenLead}
          onSelectOption={onSelectOption}
          onNavigate={onNavigateLink}
        />
      ))}

      {response.units?.items?.length ? (
        <View style={styles.unitList}>
          {response.units.items.map((u) => (
            <UnitCard key={u.id} unit={u} lang={lang} onPress={() => onOpenUnit(u.code)} />
          ))}
        </View>
      ) : null}

      <AssistantActions response={response} query={query} ar={ar} onViewAllMarkets={onViewAllMarkets} onPivotPrimary={onPivotPrimary} onChangeSearch={onChangeSearch} />

      {(queueActions.length || response.links?.length) ? (
        <View style={styles.footerLinks}>
          {queueActions.map((a, i) => (
            <Button key={`act-${i}`} variant="secondary" label={a.label} onPress={() => onOpenQueue(a.queue as LeadQueue)} />
          ))}
          {response.links?.map((l, i) => (
            <Button key={`lnk-${i}`} variant="quiet" label={l.label} onPress={() => onNavigateLink(l.screen, l.params)} />
          ))}
        </View>
      ) : null}

      {extraFooter}
      {response.intent === 'unit_search' && !response.cards.length && !response.units?.items?.length && !extraFooter && !viewAllMarketsAction && !showPivot ? (
        <Text style={{ color: colors.muted }}>{t(lang, 'noResults')}</Text>
      ) : null}
    </Root>
  );
}

const styles = StyleSheet.create({
  embedded: { gap: spacing.md },
  container: { padding: spacing.lg, paddingBottom: 110, gap: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  headerCopy: { flex: 1, gap: spacing.xs },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  rowItem: { paddingVertical: spacing.sm, gap: spacing.xs },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  rowWho: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  rowName: { flexShrink: 1 },
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.xs },
  unitList: { gap: spacing.sm },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
