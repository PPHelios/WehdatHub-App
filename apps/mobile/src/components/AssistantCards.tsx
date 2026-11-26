import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { ApiClientError, formatEgp, ltr, type AssistantCard, type AssistantQueryResponse, type BrokerDiscipline, type LeadQueue } from '@wehdathub/shared';
import { looksLikePhone } from './PhoneText';
import { errorText } from '../errors';
import { t } from '../i18n';
import { spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { KpiTile, SectionCard, UrgencyBadge, type BadgeTone } from './SectionCard';
import { StatRow } from './StatRow';
import { UnitCard } from './UnitCard';

function disciplineMeta(d: BrokerDiscipline | undefined, ar: boolean): { tone: BadgeTone; label: string } | null {
  if (d === 'consistent') return { tone: 'ok', label: ar ? 'منتظم' : 'Consistent' };
  if (d === 'lagging') return { tone: 'warn', label: ar ? 'متأخر' : 'Lagging' };
  if (d === 'silent') return { tone: 'critical', label: ar ? 'صامت ٤٨ س' : 'Silent 48h' };
  return null;
}

/** Builds a clean summary safe to share externally — never includes client names or phones. */
function buildShareSummary(response: AssistantQueryResponse, ar: boolean): string {
  const lines: string[] = [response.headline];
  if (response.windowLabel) lines.push(response.windowLabel);
  for (const card of response.cards ?? []) {
    if (card.kind === 'metric_row') {
      for (const item of card.items ?? []) lines.push(`${item.label}: ${item.value}${item.unit ? ` ${item.unit}` : ''}`);
    } else if (card.kind === 'bar_breakdown') {
      lines.push(card.title);
      for (const r of (card.rows ?? []).slice(0, 6)) lines.push(`• ${r.label}: ${r.valueLabel ?? r.count}`);
    } else if (card.kind === 'broker_scorecard') {
      const b = card.broker;
      lines.push(`${b.name}: ${b.deals} ${ar ? 'صفقة' : 'deals'} · ${b.updates ?? 0} ${ar ? 'تحديث' : 'updates'} · ${b.noNextStep ?? 0} ${ar ? 'بدون خطوة' : 'no next step'}`);
    } else if (card.kind === 'broker_discipline') {
      const s = card.summary;
      lines.push(ar ? `منتظم ${s.consistent} · متأخر ${s.lagging} · صامت ${s.silent}` : `Consistent ${s.consistent} · Lagging ${s.lagging} · Silent ${s.silent}`);
    } else if (card.kind === 'stuck_leads') {
      lines.push(ar ? `${card.total} عملاء مستنين تحرك: ${card.items.map((i) => i.ref).join('، ')}` : `${card.total} leads needing action: ${card.items.map((i) => i.ref).join(', ')}`);
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
}) {
  const { colors } = useTheme();
  const locale = ar ? 'ar-EG' : 'en-GB';
  const num = (v: number) => v.toLocaleString(locale);

  if (card.kind === 'broker_scorecard') {
    const b = card.broker;
    const badge = disciplineMeta(b.discipline, ar);
    return (
      <SectionCard
        testID="card-broker-scorecard"
        title={b.name}
        action={
          <View style={styles.badgeRow}>
            {badge ? <UrgencyBadge tone={badge.tone} label={badge.label} /> : null}
            {b.telegramLinked === false ? <UrgencyBadge tone="warn" label={ar ? 'تليجرام مش مربوط' : 'Telegram off'} /> : null}
          </View>
        }
      >
        <View style={styles.kpiGrid}>
          <KpiTile label={ar ? 'تحديثات التطبيق' : 'App updates'} value={num(b.updates ?? 0)} hint={ar ? `${num(b.updates48h ?? 0)} آخر ٤٨ س` : `${num(b.updates48h ?? 0)} in 48h`} tone={b.discipline === 'silent' ? 'critical' : b.discipline === 'lagging' ? 'warn' : 'ok'} />
          <KpiTile label={ar ? 'عملاء مفتوحين' : 'Open leads'} value={num(b.open ?? 0)} hint={b.noNextStep ? `${num(b.noNextStep)} ${ar ? 'بدون خطوة' : 'no next step'}` : undefined} tone={b.noNextStep ? 'warn' : 'neutral'} />
          <KpiTile label={ar ? 'أول رد (وسيط)' : 'Median reply'} value={b.responseMin != null ? `${num(b.responseMin)} ${ar ? 'د' : 'min'}` : '—'} />
          <KpiTile label={ar ? 'صفقات / فايتة' : 'Deals / Missed'} value={`${num(b.deals)} / ${num(b.missed ?? 0)}`} tone={b.missed ? 'warn' : 'ok'} />
        </View>
      </SectionCard>
    );
  }

  if (card.kind === 'broker_discipline') {
    const s = card.summary;
    return (
      <SectionCard testID="card-broker-discipline" title={ar ? 'التزام التحديث في التطبيق' : 'App update discipline'}>
        <View style={styles.kpiGrid}>
          <KpiTile label={ar ? 'منتظم' : 'Consistent'} value={num(s.consistent)} tone="ok" />
          <KpiTile label={ar ? 'متأخر' : 'Lagging'} value={num(s.lagging)} tone={s.lagging ? 'warn' : 'neutral'} />
          <KpiTile label={ar ? 'صامت ٤٨ س' : 'Silent 48h'} value={num(s.silent)} tone={s.silent ? 'critical' : 'ok'} />
        </View>
        {card.rows.map((b, idx) => {
          const badge = disciplineMeta(b.discipline, ar);
          return (
            <View key={b.id} style={[styles.rowItem, idx < card.rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.rowName, { color: colors.text }]}>{b.name}</Text>
                <View style={styles.badgeRow}>
                  {badge ? <UrgencyBadge tone={badge.tone} label={badge.label} /> : null}
                  {b.telegramLinked === false ? <UrgencyBadge tone="warn" label={ar ? 'تليجرام مش مربوط' : 'Telegram off'} /> : null}
                </View>
              </View>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                {[
                  `${num(b.updates48h ?? 0)} ${ar ? 'تحديث ٤٨س' : 'updates 48h'}`,
                  `${num(b.noNextStep ?? 0)} ${ar ? 'بدون خطوة' : 'no next step'}`,
                  b.missed ? `${num(b.missed)} ${ar ? 'فايتة' : 'missed'}` : null,
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
      <SectionCard testID="card-stuck-leads" title={card.title || (ar ? 'عملاء محتاجين تحرك سريع' : 'Leads needing quick action')} subtitle={`${num(card.total)}`}>
        {card.items.length === 0 ? (
          <Text style={{ color: colors.muted }}>{ar ? 'مفيش عملاء متأخرين دلوقتي.' : 'No leads waiting in this queue.'}</Text>
        ) : card.items.map((item, idx) => {
          const recs = card.recommendedBrokers.filter((b) => b.id !== item.assigneeId).slice(0, 2);
          const doneTo = reassigned[item.ref];
          const wasNudged = nudged[item.ref];
          const busy = Boolean(busyRefs[item.ref]);
          const rowError = rowErrors[item.ref];
          return (
            <View key={item.ref} style={[styles.rowItem, idx < card.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
              <Pressable accessibilityRole="button" onPress={() => onOpenLead(item.ref)} style={styles.rowTop}>
                <Text style={[styles.rowName, { color: colors.text }]}>{item.ref}{item.name ? ` · ${looksLikePhone(item.name) ? ltr(item.name) : item.name}` : ''}</Text>
                <UrgencyBadge tone="warn" label={doneTo ? `→ ${doneTo}` : (item.assignee || (ar ? 'بدون وسيط' : 'Unassigned'))} />
              </Pressable>
              <Text style={{ color: colors.muted, fontSize: 13 }}>{item.stage}</Text>
              {rowError ? <Text testID={`assistant-row-error-${item.ref}`} style={{ color: colors.danger, fontSize: 13 }}>{rowError}</Text> : null}
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
                    label={wasNudged ? (ar ? '✓ اتبعت تنبيه' : '✓ Nudged') : (ar ? '🔔 اطلب تحديث' : '🔔 Ask for update')}
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

  if (card.kind === 'metric_row') {
    const items = card.items ?? [];
    return (
      <SectionCard testID="card-metric-row">
        <View style={styles.kpiGrid}>
          {items.map((item, i) => {
            const val = typeof item.value === 'number'
              ? (item.unit === 'EGP' ? formatEgp(item.value) : num(item.value))
              : String(item.value);
            return <KpiTile key={`${item.label}-${i}`} label={item.label} value={val} tone={item.tone ?? 'neutral'} />;
          })}
        </View>
      </SectionCard>
    );
  }

  if (card.kind === 'bar_breakdown') {
    const rows = card.rows ?? [];
    const maxCount = Math.max(1, ...rows.map((r) => Number(r.count || 0)));
    return (
      <SectionCard testID="card-bar-breakdown" title={card.title}>
        {rows.map((r) => (
          <StatRow key={r.key} animate label={r.label} value={r.valueLabel ?? num(r.count)} pct={(Number(r.count || 0) / maxCount) * 100} />
        ))}
      </SectionCard>
    );
  }

  if (card.kind === 'disambiguate') {
    const options = card.options ?? [];
    return (
      <SectionCard
        testID="card-disambiguate"
        title={card.prompt ? (ar ? `اختر المقصود بـ "${card.prompt}"` : `Select match for "${card.prompt}"`) : (ar ? 'اختر المقصود' : 'Select match')}
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
      <Text selectable style={{ color: colors.text, fontSize: 16 }}>{card.answer ?? ''}</Text>
      {card.source === 'local' ? <Text style={{ color: colors.muted, fontSize: 13 }}>{ar ? 'إجابة مباشرة من البيانات المحفوظة.' : 'Direct answer from catalogue data.'}</Text> : null}
      {card.dataDates ? <Text style={{ color: colors.muted, fontSize: 12 }}>{card.dataDates}</Text> : null}
    </SectionCard>
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
}) {
  const { colors } = useTheme();
  const lang = ar ? 'ar' : 'en';
  const [reassigned, setReassigned] = useState<Record<string, string>>({});
  const [nudged, setNudged] = useState<Record<string, boolean>>({});
  const busyLockRef = useRef<Record<string, boolean>>({});
  const [busyRefs, setBusyRefs] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const pivotAction = response.actions?.find((a) => a.kind === 'pivot_mode');
  const viewAllMarketsAction = response.actions?.find((a): a is Extract<typeof a, { kind: 'view_all_markets' }> => a.kind === 'view_all_markets');
  const queueActions = (response.actions ?? []).filter((a): a is Extract<typeof a, { kind: 'open_queue' }> => a.kind === 'open_queue');
  const appliedFilters = response.understood?.appliedFilters ?? [];
  const showPivot = Boolean(response.suggestPrimary || pivotAction);

  const formatActionError = (e: unknown): string => {
    if (e instanceof ApiClientError && e.status === 409) {
      return ar ? 'حد تاني عدّل العميل ده بالفعل — حدّث النتيجة.' : 'Another manager already updated this lead — refresh results.';
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

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text testID="assistant-headline" accessibilityRole="header" style={[styles.headline, { color: colors.text }]}>{response.headline}</Text>
          {response.windowLabel ? <Text style={{ color: colors.muted, fontSize: 13 }}>{response.windowLabel}</Text> : null}
        </View>
        <Chip
          testID="assistant-share-summary"
          label={ar ? 'مشاركة الملخص' : 'Share summary'}
          onPress={() => {
            onShareSummary?.();
            void Share.share({ message: buildShareSummary(response, ar) }).catch(() => undefined);
          }}
        />
      </View>

      {actionError ? <Text testID="assistant-action-error" style={{ color: colors.danger, fontSize: 13 }}>{actionError}</Text> : null}

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
        />
      ))}

      {response.units?.items?.length ? (
        <View style={styles.unitList}>
          {response.units.items.map((u) => (
            <UnitCard key={u.id} unit={u} lang={lang} onPress={() => onOpenUnit(u.code)} />
          ))}
        </View>
      ) : null}

      {viewAllMarketsAction && onViewAllMarkets ? (
        <Button
          testID="assistant-view-all-markets"
          variant="secondary"
          label={viewAllMarketsAction.label}
          onPress={() => onViewAllMarkets(query)}
        />
      ) : null}

      {showPivot ? (
        <Button
          testID="assistant-pivot-primary"
          variant="secondary"
          label={pivotAction?.label || (ar ? 'ابحث في مشاريع المطورين بدل كده' : 'Search Primary projects instead')}
          onPress={() => onPivotPrimary(query)}
        />
      ) : null}

      {onChangeSearch && query.trim() ? (
        <Button
          testID="assistant-change-search"
          variant="quiet"
          label={ar ? 'تعديل البحث' : 'Change search'}
          onPress={() => onChangeSearch(query)}
        />
      ) : null}

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
      {response.intent !== 'clarify' && !response.cards.length && !response.units?.items?.length && !extraFooter && !viewAllMarketsAction && !showPivot ? (
        <Text style={{ color: colors.muted }}>{t(lang, 'noResults')}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 110, gap: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  headerCopy: { flex: 1, gap: 2 },
  headline: { fontSize: 18, fontWeight: '700' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  rowItem: { paddingVertical: spacing.sm, gap: spacing.xs },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  rowName: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: 4 },
  unitList: { gap: spacing.sm },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
