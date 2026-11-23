import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { BusySwitch } from './BusySwitch';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiClientError } from '@wehdathub/shared';
import type { AskAction, ProjectFilters, ProjectSort } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { numberOf } from '../projectRules';
import { fill, pt } from '../projectText';
import { plain, withCommas } from '../readback';
import { radius, spacing, useTheme } from '../theme';
import { useDebounced } from '../useDebounced';
import { Button } from './Button';
import { Chips } from './Chips';
import { Field } from './Field';
import { EmptyView, ErrorView, Loading } from './StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { Count, Pager, ProjectCardView } from './ProjectList';

const SORTS: ProjectSort[] = ['best', 'cheap', 'pricey', 'small', 'big', 'down'];
const SORT_KEY = { best: 'sortBest', cheap: 'sortCheap', pricey: 'sortPricey', small: 'sortSmall', big: 'sortBig', down: 'sortDown' } as const;
const RANGES = ['pmin', 'pmax', 'amin', 'amax', 'dmax'] as const;
type Range = (typeof RANGES)[number];

/** A chip's value as one line: a plain value, or the numbers of the filter it stands for. */
export const chipText = (v: unknown): string => (v && typeof v === 'object' ? Object.values(v as Record<string, unknown>).flat().filter((x) => x !== null && x !== '').join(' · ') : String(v ?? ''));

/**
 * Ask's results, grouped by project: a count, a chip per filter read from the question (each can be dropped), sort pills, a filter row
 * (price range, area range, max down payment, bedrooms), project cards with their offers or the notes that fit, WhatsApp, and pages.
 * The same cards as the catalogue list.
 */
export function AskResults({ q, onOpenProject, showStatus = false }: { q: string; onOpenProject?: (id: string, name: string) => void; showStatus?: boolean }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const T = pt(lang);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ProjectSort>('best');
  const [drop, setDrop] = useState<string[]>([]);
  const [range, setRange] = useState<Record<Range, string>>({ pmin: '', pmax: '', amin: '', amax: '', dmax: '' });
  const [bed, setBed] = useState<number | undefined>(undefined);
  const [unitsOnly, setUnitsOnly] = useState(false);
  const [report, setReport] = useState<'closed' | 'open' | 'done' | 'again'>('closed');
  const [note, setNote] = useState('');
  // The first answer's token and log id ride along on every later page, sort and filter, so the question is read and logged once.
  const link = useRef<{ token?: string; logId?: string }>({});
  const typed = useDebounced(range, 500);
  const filters: ProjectFilters = { ...Object.fromEntries(RANGES.map((k) => [k, numberOf(typed[k])]).filter(([, v]) => v !== undefined)), ...(bed ? { bed } : {}) };
  const active = Object.keys(filters).length > 0;
  const r = useQuery({
    queryKey: ['askResults', q, page, sort, drop.join(','), JSON.stringify(filters), unitsOnly],
    queryFn: async () => {
      const r = await api.askResults({ q, page, sort, drop, ...filters, ...(unitsOnly ? { units: true } : {}), ...link.current });
      if (!link.current.token && r.token) link.current = { token: r.token, logId: r.log_id ?? undefined };
      return r;
    },
    placeholderData: keepPreviousData,
  });
  if (showStatus && r.isError) return <ErrorView message={errorText(r.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => r.refetch()} />;
  if (showStatus && r.isPending) return <Loading label={t(lang, 'loading')} />;
  if (!r.data || (!r.data.projects.length && !drop.length && !active)) return showStatus ? <EmptyView title={T.noMatch} /> : null;
  const d = r.data;
  const reset = () => setPage(1);
  // What the broker does next goes to the search log; a failure never shows.
  const log = (action: AskAction, detail?: string) => { const id = link.current.logId ?? d.log_id; if (id) api.askAction(id, action, detail)?.catch?.(() => undefined); };
  const sendReport = async () => {
    const id = link.current.logId ?? d.log_id;
    if (!id) return;
    try { await api.askReport(id, note.trim()); setReport('done'); } catch (e) { setReport(e instanceof ApiClientError && e.status === 409 ? 'again' : 'open'); }
  };
  const box = (k: Range, label: string) => (
    <View style={styles.flex} key={k}><Field testID={`ask-${k}`} label={label} value={withCommas(range[k])} onChangeText={(v) => { setRange({ ...range, [k]: plain(v) }); reset(); }} onEndEditing={() => log('filter', k)} keyboardType="number-pad" /></View>
  );
  return (
    <View testID="ask-results" style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text }]}>{T.askResults}</Text>
      {d.answer_line ? <Text testID="ask-line" style={{ color: colors.text }}>{d.answer_line}</Text> : null}
      <Count projects={d.total_projects} options={d.total_options ?? d.total_offers} lang={lang} />
      {d.chips.length ? (
        <View style={styles.chips}>
          {d.chips.map((c) => (
            <Pressable key={c.key} testID={`ask-chip-${c.key}`} accessibilityRole="button" accessibilityLabel={fill(T.removeChip, { s: chipText(c.value) })} onPress={() => { log('chip_drop', c.key); setDrop([...drop, c.key]); reset(); }} style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={{ color: colors.text }}>{chipText(c.value)}  ×</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Text style={[styles.label, { color: colors.muted }]}>{T.sortBy}</Text>
      <Chips<ProjectSort> animateFilter testID="ask-sort" value={sort} options={SORTS.map((s) => ({ value: s, label: T[SORT_KEY[s]] }))} onChange={(v) => { log('sort', v); setSort(v); reset(); }} />
      <View testID="ask-filters" style={styles.filters}>
        <Text style={[styles.label, { color: colors.muted }]}>{T.priceRange}</Text>
        <View style={styles.row}>{box('pmin', T.min)}{box('pmax', T.max)}</View>
        <Text style={[styles.label, { color: colors.muted }]}>{T.areaRange}</Text>
        <View style={styles.row}>{box('amin', T.min)}{box('amax', T.max)}</View>
        {box('dmax', T.maxDown)}
        <View style={styles.row}>
          <Text style={[styles.flex, { color: colors.text }]}>{T.unitsOnly}</Text>
          <BusySwitch testID="ask-units" value={unitsOnly} onValueChange={(v) => { log('filter', 'units'); setUnitsOnly(v); reset(); }} />
        </View>
        <Text style={[styles.label, { color: colors.muted }]}>{T.bedrooms}</Text>
        <Chips<string> animateFilter testID="ask-bed" value={bed ? String(bed) : ''} options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))} onChange={(v) => { log('filter', 'bed'); setBed(bed === Number(v) ? undefined : Number(v)); reset(); }} />
      </View>
      {d.projects.length ? d.projects.map((p, i) => (
        <ProjectCardView key={p.id ?? `${p.name}-${i}`} p={p} lang={lang} onOpen={p.id && onOpenProject ? () => { log('open', p.id); onOpenProject(p.id as string, p.name); } : undefined} onSend={() => log('send', p.id)} />
      )) : <Text testID="ask-none" style={{ color: colors.muted }}>{T.noResults}</Text>}
      <View style={styles.filters}>
        {report === 'closed' ? <Button testID="ask-wrong" variant="secondary" label={T.wrongResults} onPress={() => setReport('open')} /> : null}
        {report === 'open' ? (
          <>
            <Field testID="ask-report-note" label={T.reportNote} value={note} onChangeText={setNote} multiline />
            <Button testID="ask-report-send" label={T.reportSend} onPress={sendReport} />
          </>
        ) : null}
        {report === 'done' ? <Text testID="ask-report-done" style={{ color: colors.accent }}>{T.reportDone}</Text> : null}
        {report === 'again' ? <Text style={{ color: colors.muted }}>{T.reportAgain}</Text> : null}
      </View>
      <Pager page={d.page} pages={d.pages} onPage={(n) => { log('page', String(n)); setPage(n); }} lang={lang} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 44, justifyContent: 'center' },
  filters: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
