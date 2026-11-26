import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation';
import { AskResults } from './AskResults';
import { Field } from './Field';
import { normalizeSearchWords } from '../searchCapabilities';
import { useDebounced } from '../useDebounced';
import { useReducedMotion } from 'react-native-reanimated';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import type { LeadMatchAdjustments, LeadMatchField, LeadQueue, LeadStage, LeadTab } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { errorText } from '../errors';
import { t } from '../i18n';
import { teamOptions } from '../queries';
import { useRights } from '../rights';
import { LeadScreen } from '../screens/LeadScreen';
import { useSelectionHighlight } from './SelectionHighlight';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { BottomSafe } from './BottomSafe';
import { Button } from './Button';
import { Chips } from './Chips';
import { ErrorView, Loading } from './StateViews';
import { StatRow } from './StatRow';
import { LeadCard } from './LeadCard';

const MATCH_FIELDS: [LeadMatchField, string, string][] = [
  ['price_min', 'Minimum budget', 'أقل ميزانية'],
  ['price_max', 'Maximum budget', 'أقصى ميزانية'],
  ['area_min', 'Minimum area (m²)', 'أقل مساحة (م²)'],
  ['area_max', 'Maximum area (m²)', 'أقصى مساحة (م²)'],
  ['bedrooms_min', 'Minimum bedrooms', 'أقل عدد غرف'],
];
const STAGES: LeadStage[] = ['new', 'contacted', 'interested', 'viewing', 'negotiation', 'won', 'lost'];

export function SearchLeads({ assignedInitially, initialQueue, lookup, matching = false, initialTab, requestedAssignee }: { assignedInitially: boolean; initialQueue?: LeadQueue; lookup?: string; matching?: boolean; initialTab?: LeadTab; requestedAssignee?: string }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [nameOrPhone, setNameOrPhone] = useState(lookup ?? '');
  const queryText = useDebounced(nameOrPhone.trim());
  const [matchRef, setMatchRef] = useState<string>();
  const [adjustments, setAdjustments] = useState<LeadMatchAdjustments>();
  const [editing, setEditing] = useState<LeadMatchAdjustments>();
  const selectMatch = (ref: string) => {
    setAdjustments(undefined);
    setEditing(undefined);
    setPrimaryRequest(undefined);
    setMatchRef(ref);
  };
  const [primaryRequest, setPrimaryRequest] = useState<string>();
  const matches = useQuery({ queryKey: ['lead', matchRef, 'matches', adjustments], queryFn: () => api.leadMatches(matchRef!, adjustments), enabled: Boolean(matchRef) });
  const ar = lang === 'ar';
  const shareMatch = useMutation({
    mutationFn: async ({ ref, code }: { ref: string; code: string }) => {
      const { url } = await api.leadSend(ref, code, lang);
      await Linking.openURL(url);
    },
  });
  const rights = useRights();
  const reduceMotion = useReducedMotion();
  const number = new Intl.NumberFormat(ar ? 'ar-EG' : 'en-EG');
  const [assigned, setAssigned] = useState<'last' | undefined>(assignedInitially ? 'last' : undefined);
  const [queue, setQueue] = useState<LeadQueue | undefined>(initialQueue);
  const activeQueue = queue;
  const [stage, setStage] = useState<LeadStage>();
  const selection = useSelectionHighlight(stage, { backgroundColor: colors.primarySoft });
  const tab = stage ?? initialTab;
  const [broker, setBroker] = useState('');
  const [ref, setRef] = useState<string>();
  const closeMatches = () => {
    setMatchRef(undefined);
    setPrimaryRequest(undefined);
    shareMatch.reset();
  };
  const team = useQuery(teamOptions(rights.manager || rights.agencyOwner || rights.teamLead));
  const matchesAssignee = requestedAssignee ? team.data?.items.filter((x) => normalizeSearchWords(x.name) === requestedAssignee || normalizeSearchWords(x.name).split(' ')[0] === requestedAssignee) : undefined;
  const singleAssignee = matchesAssignee?.length === 1 ? matchesAssignee[0].id : undefined;
  useEffect(() => { if (singleAssignee) setBroker(singleAssignee); }, [singleAssignee]);
  const [confirmedAssignee, setConfirmedAssignee] = useState<string>();
  const resolvePending = Boolean(requestedAssignee && !singleAssignee && confirmedAssignee !== requestedAssignee);
  const effectiveBroker = requestedAssignee && confirmedAssignee !== requestedAssignee ? singleAssignee ?? '' : broker;
  const counts = useQuery({
    queryKey: ['leads', 'search-counts', effectiveBroker, assigned, activeQueue, queryText],
    queryFn: () => api.leadCounts(queryText, effectiveBroker || undefined, assigned, activeQueue),
    enabled: !resolvePending,
  });
  const list = useInfiniteQuery({
    queryKey: ['leads', 'search-list', tab, effectiveBroker, assigned, activeQueue, queryText],
    queryFn: ({ pageParam }) => api.leads({ tab, broker: effectiveBroker || undefined, assigned, queue: activeQueue, q: queryText, offset: pageParam }),
    enabled: !resolvePending,
    initialPageParam: 0,
    getNextPageParam: (last) => last.more ? last.offset + last.limit : undefined,
  });
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const stages = counts.data?.counts;
  const max = Math.max(1, ...STAGES.map((item) => stages?.[item] ?? 0));
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{ar ? 'مراحل العملاء' : 'Lead pipeline'}</Text>
      <View style={styles.tools}>
        <Field label={t(lang, 'searchLeads')} testID="search-lead-lookup" value={nameOrPhone} onChangeText={setNameOrPhone} />
        <Button variant="secondary" label={t(lang, 'newLead')} onPress={() => nav.navigate('NewLead')} />
      </View>
      {!queryText ? <Chips<LeadQueue | 'all'> animateFilter value={activeQueue ?? 'all'} options={[
        { value: 'all', label: t(lang, 'tabAll') },
        { value: 'unassigned', label: ar ? 'من غير وسيط' : 'Unassigned' },
        { value: 'uncontacted', label: ar ? 'محدش كلمهم' : 'Uncontacted' },
        ...(initialQueue === 'waiting-over-1h' ? [{ value: 'waiting-over-1h' as const, label: ar ? 'مستنين أكتر من ساعة' : 'Waiting > 1h' }] : []),
        ...(initialQueue === 'delayed-first-contact' ? [{ value: 'delayed-first-contact' as const, label: ar ? 'تأخر أول تواصل' : 'Delayed first contact' }] : []),
        { value: 'late-response', label: ar ? 'ميعاد أول رد عدّى' : 'First response due' },
        { value: 'overdue', label: t(lang, 'tabOverdue') },
        { value: 'viewings-tomorrow', label: t(lang, 'fuViewing') + ' · ' + (ar ? 'بكرة' : 'Tomorrow') },
      ]} onChange={(value) => { setQueue(value === 'all' ? undefined : value); setStage(undefined); }} /> : null}
      {activeQueue === 'viewings-tomorrow' ? <Button variant="secondary" label={ar ? 'معاينات التقويم بكرة' : 'Tomorrow’s calendar viewings'} onPress={() => nav.navigate('Calendar', { tomorrow: true })} /> : null}
      <Chips animateFilter value={assigned ?? 'all'} options={[
        { value: 'all', label: t(lang, 'tabAll') },
        { value: 'last', label: ar ? 'آخر تسليم الشهر اللي فات' : 'Last assigned last month' },
      ]} onChange={(value) => setAssigned(value === 'last' ? value : undefined)} />
      {team.data?.items.length ? <Chips animateFilter value={effectiveBroker || (resolvePending ? '' : 'all')} onChange={(value) => { setBroker(value === 'all' ? '' : value); setConfirmedAssignee(requestedAssignee); }} options={[
        { value: 'all', label: ar ? 'كل الوسطاء' : 'All brokers' },
        ...team.data.items.map((member) => ({ value: member.id, label: member.name })),
      ]} /> : null}
      {requestedAssignee && team.isFetched && !singleAssignee ? <Text style={{ color: colors.muted }}>{ar ? 'اختار الوسيط المطلوب من القائمة.' : 'Choose the broker from the list.'}</Text> : null}
      {counts.isError ? <ErrorView message={errorText(counts.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => counts.refetch()} /> : null}
      {stages && !queryText && !initialTab ? <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {selection.highlight}
        {STAGES.map((item) => <Pressable key={item} onLayout={selection.measure(item)} accessibilityRole="button" accessibilityState={{ selected: item === stage }} onPress={() => setStage(item === stage ? undefined : item)} style={[styles.stage, item === stage && !selection.highlight && { backgroundColor: colors.primarySoft }]}>
          <StatRow animate label={t(lang, `st_${item}`)} value={number.format(stages[item] ?? 0)} pct={(stages[item] ?? 0) / max * 100} />
        </Pressable>)}
      </View> : null}
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{stage ? t(lang, `st_${stage}`) : initialTab === 'due_today' ? t(lang, 'tabDue') : initialTab === 'no_next_step' ? t(lang, 'tabNoStep') : t(lang, 'leadsTab')}{list.data ? ' · ' + number.format(list.data.pages[0].total) : ''}</Text>
      {list.isPending && !resolvePending ? <Loading label={t(lang, 'loading')} /> : null}
      {list.isError ? <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => list.refetch()} /> : null}
      {list.isSuccess && !rows.length ? <Text style={{ color: colors.muted }}>{t(lang, 'noLeads')}</Text> : null}
      {rows.map((lead) => <LeadCard key={lead.ref} lead={lead} lang={lang} onPress={() => matching ? selectMatch(lead.ref) : setRef(lead.ref)} />)}
      {list.hasNextPage ? <Button variant="secondary" label={ar ? 'عملاء أكتر' : 'More leads'} loading={list.isFetchingNextPage} onPress={() => { void list.fetchNextPage(); }} /> : null}
      <Modal visible={Boolean(ref || matchRef)} onRequestClose={matchRef ? closeMatches : () => setRef(undefined)} animationType={reduceMotion ? 'none' : 'slide'}>
        <BottomSafe>
          {matchRef ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t(lang, 'matches')} · {matchRef}</Text>
        {matches.isPending ? <Loading label={t(lang, 'loading')} /> : null}
        {matches.isError ? <ErrorView message={errorText(matches.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => matches.refetch()} /> : null}
        {matches.data?.requests.length === 0 ? <Text style={{ color: colors.muted }}>{ar ? 'العميل ده ملوش طلبات محفوظة.' : 'This lead has no saved requirements.'}</Text> : null}
        {matches.data?.requests.map((request) => <View key={request.id} style={styles.tools}>
          <Text style={{ color: colors.text }}>{request.summary}</Text>
          {editing?.requestId !== request.id ? MATCH_FIELDS.map(([key, en, arabic]) => {
            const value = request.criteria?.[key];
            return value == null ? null : <Text key={key} style={{ color: colors.muted }}>{ar ? arabic : en} · {number.format(value)}</Text>;
          }) : null}
          {editing?.requestId === request.id ? <View style={styles.tools}>
            {MATCH_FIELDS.map(([key, en, arabic]) => <Field key={key} label={ar ? arabic : en} value={editing[key] ?? ''} keyboardType="decimal-pad" onChangeText={(value) => setEditing({ ...editing, [key]: value })} />)}
            <Button label={ar ? 'طبّق على البحث ده بس' : 'Apply to this search only'} onPress={() => {
              const next: LeadMatchAdjustments = { requestId: request.id };
              for (const [key] of MATCH_FIELDS) next[key] = normalizeSearchWords(editing[key] ?? '').replace(/٫/g, '.') || 'clear';
              setAdjustments(next);
              setEditing(undefined);
            }} />
            <Button variant="secondary" label={t(lang, 'cancel')} onPress={() => setEditing(undefined)} />
          </View> : <Button variant="secondary" label={ar ? 'عدّل شروط البحث ده' : 'Adjust this search'} onPress={() => {
            const next: LeadMatchAdjustments = { requestId: request.id };
            for (const [key] of MATCH_FIELDS) next[key] = String(request.criteria?.[key] ?? '');
            setEditing(next);
          }} />}
          <Text style={{ color: colors.muted }}>{ar ? 'وحدات الشركة' : 'Inventory'} · {number.format(request.total)}</Text>
          {request.items.map((unit) => <View key={unit.code} style={styles.tools}>
            <Button variant="secondary" label={unit.code + (unit.title ? ' · ' + unit.title : '')} onPress={() => { closeMatches(); setRef(undefined); nav.navigate('Unit', { code: unit.code }); }} />
            <Button variant="secondary" label={ar ? 'افتح مشاركة ' + unit.code : 'Share ' + unit.code} disabled={shareMatch.isPending} onPress={() => shareMatch.mutate({ ref: matchRef, code: unit.code })} />
          </View>)}
          <Button variant="secondary" label={ar ? 'خيارات المطورين' : 'Search developer projects'} onPress={() => setPrimaryRequest(primaryRequest === request.id ? undefined : request.id)} />
          {primaryRequest === request.id ? <AskResults showStatus q={request.summary} onOpenProject={(id, name) => { closeMatches(); setRef(undefined); nav.navigate('Project', { id, name }); }} /> : null}
        </View>)}
        {adjustments ? <Button variant="secondary" label={ar ? 'ارجع للشروط المحفوظة' : 'Reset to saved requirements'} onPress={() => { setAdjustments(undefined); setEditing(undefined); }} /> : null}
        {shareMatch.isError ? <Text style={{ color: colors.danger }}>{errorText(shareMatch.error, lang)}</Text> : null}
        <Button variant="secondary" label={t(lang, 'closePanel')} onPress={closeMatches} />
      </View>

          </ScrollView> : <>
            <View style={styles.detailsActions}>
              <Button variant="secondary" label={t(lang, 'closePanel')} onPress={() => setRef(undefined)} />
              {ref ? <Button testID="lead-detail-matches" variant="secondary" label={t(lang, 'matches')} onPress={() => selectMatch(ref)} /> : null}
            </View>
            {ref ? <LeadScreen leadRef={ref} key={ref} /> : null}
          </>}
        </BottomSafe>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tools: { gap: spacing.sm },
  detailsActions: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.sm, gap: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: 90, gap: spacing.md },
  title: { fontSize: 20, fontWeight: '700' },
  card: { padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card },
  stage: { minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radius.sm, justifyContent: 'center' },
});
