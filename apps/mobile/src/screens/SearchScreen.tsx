import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { timed } from '../usage';
import { track } from '../analytics';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import Animated, { FadeIn, FadeOut, ReduceMotion, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ApiUnitListItem, SearchResult, UnitStatus, VoiceFile } from '@wehdathub/shared';
import { api } from '../api';
import { SearchCreditRings, useSearchCredits } from '../components/SearchCreditRings';
import { currentLang, useAuth } from '../auth';
import { AskResults } from '../components/AskResults';
import { Icon } from '../components/Icon';
import { Chips } from '../components/Chips';
import { pt } from '../projectText';
import { readLeadCommand, SearchLeadAction } from '../components/SearchLeadAction';
import { LeadPicker } from '../components/LeadPicker';
import { SearchLeads } from '../components/SearchLeads';
import { DashboardScreen } from './InsightsScreens';
import { useRights } from '../rights';
import { parseSearchIntent, SEARCH_DESTINATIONS } from '../searchCapabilities';
import type { SearchIntent } from '../searchCapabilities';
import { SearchPractice } from '../components/SearchPractice';
import { SearchHome } from '../components/SearchHome';
import { SearchDeals } from '../components/SearchDeals';
import { Button } from '../components/Button';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { SaveSearchButton } from '../components/SaveSearchButton';
import { UnitCard } from '../components/UnitCard';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';
import { VoiceBar } from '../components/VoiceBar';

type Source = 'inventory' | 'primary' | 'both';
type SearchView = 'deals' | 'leads' | 'dashboard' | 'ranking' | 'lead-action' | 'clarify' | 'reverse' | 'lead-offers';

const RECENT_KEY = 'wehdathub.recentSearches';

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList<ApiUnitListItem>);

export function SearchScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const ar = lang === 'ar';
  const broker = useAuth((state) => state.broker);
  const recentKey = broker?.id ? `${RECENT_KEY}:${broker.id}` : null;
  const generation = useRef(0);
  const practiceKey = broker?.id ? `search-practice-v1:${broker.id}:${broker.role}` : null;
  const [invitation, setInvitation] = useState<string | null>(null);
  const [practicing, setPracticing] = useState(false);
  useEffect(() => {
    if (!practiceKey) return;
    let active = true;
    AsyncStorage.getItem(practiceKey).then((seen) => {
      if (active && !seen) setInvitation(practiceKey);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [practiceKey]);
  const dismissInvitation = () => {
    setInvitation(null);
    if (practiceKey) AsyncStorage.setItem(practiceKey, '1').catch(() => undefined);
  };
  const startPractice = () => {
    dismissInvitation();
    Keyboard.dismiss();
    setPracticing(true);
  };

  const [source, setSource] = useState<Source>('inventory');
  const [chosenSource, setChosenSource] = useState<Source>('inventory');
  const credits = useSearchCredits();
  const [submitted, setSubmitted] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [report, setReport] = useState<SearchView | null>(null);
  const rights = useRights();
  const queries = useQueryClient();
  const [leadFilters, setLeadFilters] = useState<Extract<SearchIntent, { kind: 'leads' }>['filters']>({});
  const [assignee, setAssignee] = useState<string>();
  const [dealLastMonth, setDealLastMonth] = useState(false);
  const [offerLookup, setOfferLookup] = useState<{ name: string; days?: number }>();
  const [reverseCode, setReverseCode] = useState('');
  const reverse = useQuery({ queryKey: ['reverse-leads', reverseCode], queryFn: () => api.unitMatchingLeads(reverseCode), enabled: report === 'reverse' && Boolean(reverseCode) });
  const [clarification, setClarification] = useState('');
  const [group, setGroup] = useState<'inventory' | 'primary'>('inventory');
  const refreshCredits = () => queries.invalidateQueries({ queryKey: ['search-credits'] });
  const answer = useMutation({ mutationFn: (q: string) => timed('ask', () => api.ask(q)), onSettled: refreshCredits });
  const [text, setText] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // The search box and mic float at the bottom like a chat app: they slide away on scrolling down and come back on scrolling up.
  const slide = useSharedValue(0);
  const lastY = useSharedValue(0);
  const hidden = useSharedValue(false);
  const reduceMotion = useReducedMotion();
  const onScroll = useAnimatedScrollHandler((e) => {
    const y = Math.max(0, e.contentOffset.y);
    const dy = y - lastY.value;
    lastY.value = y;
    const hide = dy > 6 && y > 60 ? true : dy < -6 || y <= 60 ? false : hidden.value;
    if (hide !== hidden.value) {
      hidden.value = hide;
      slide.value = withTiming(hide ? 220 : 0, { duration: reduceMotion ? 0 : 180 });
    }
  });
  const barSlide = useAnimatedStyle(() => ({ transform: [{ translateY: slide.value }] }));
  const search = useMutation<SearchResult, Error, { q: string; drop?: boolean; status?: UnitStatus }>({ mutationFn: ({ q, drop, status }) => timed('search', () => api.search(q, { drop, status })) });
  // Active units first; Sold and Archived are one tap away, with their counts from the start. More results load on demand.
  const [last, setLast] = useState<{ q: string; drop: boolean; status: UnitStatus } | null>(null);
  const [extra, setExtra] = useState<ApiUnitListItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const clearedRecents = useRef(false);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    generation.current += 1;
    clearedRecents.current = false;
    setRecent([]);
    search.reset();
    answer.reset();
    setExtra([]);
    setLast(null);
    setReport(null);
    setSubmitted('');
    setText('');
    AsyncStorage.removeItem(RECENT_KEY).catch(() => undefined);
    if (recentKey) AsyncStorage.getItem(recentKey).then((raw) => {
      const values = raw ? JSON.parse(raw) : [];
      if (active && !clearedRecents.current && Array.isArray(values)) setRecent(values.filter((value) => typeof value === 'string').slice(0, 3));
    }).catch(() => undefined);
    return () => { active = false; generation.current += 1; };
  }, [recentKey]);

  const run = async (q: string, drop = false, status: UnitStatus = 'active') => {
    const clean = q.trim();
    if (!clean) return;
    setVoiceError(null);
    generation.current += 1;
    setLoadingMore(false);
    setExtra([]);
    setDone(false);
    setLast({ q: clean, drop, status });
    const next = [clean, ...recent.filter((x) => x !== clean)].slice(0, 3);
    setRecent(next);
    if (recentKey) AsyncStorage.setItem(recentKey, JSON.stringify(next)).catch(() => undefined);
    const started = Date.now();
    void track('search_started');
    const result = await search.mutateAsync({ q: clean, drop, status }).catch(() => undefined);
    void track('search_run', { outcome: result?.status ?? 'error', duration_ms: Date.now() - started });
  };
  const loadMore = async () => {
    if (!last || !search.data || loadingMore || done) return;
    const requestGeneration = generation.current;
    setLoadingMore(true);
    try {
      const r = await api.search(last.q, { drop: last.drop, status: last.status, offset: search.data.items.length + extra.length });
      if (requestGeneration !== generation.current) return;
      if (!r.items.length) setDone(true);
      setExtra((e) => [...e, ...r.items]);
    } catch (e) {
      if (requestGeneration !== generation.current) return;
      setDone(true);
      setVoiceError(errorText(e, lang));
    } finally {
      if (requestGeneration === generation.current) setLoadingMore(false);
    }
  };

  const onVoice = async (file: VoiceFile) => {
    const requestGeneration = generation.current;
    setTranscribing(true);
    setVoiceError(null);
    try {
      const { q } = await api.voiceToText(file);
      if (requestGeneration !== generation.current) return;
      void refreshCredits();
      setText(q);
      submit(q);
    } catch (e) {
      setVoiceError(errorText(e, lang));
    } finally {
      setTranscribing(false);
    }
  };

  const submit = (q: string, explicit?: Source) => {
    const clean = q.trim();
    if (!clean) return;
    Keyboard.dismiss();
    setVoiceError(null);
    setSubmitted(clean);
    hidden.value = false;
    slide.value = 0;
    if (!explicit && rights.leads && readLeadCommand(clean)) {
      setReport('lead-action');
      return;
    }
    const intent = explicit ? { kind: 'source', source: explicit } as const :
      parseSearchIntent(clean, report === 'leads' || report === 'deals' ? report : undefined);
    const clarify = (message: string) => { setClarification(message); setReport('clarify'); };
    const denied = () => clarify(ar ? 'الطلب ده مش متاح لصلاحياتك.' : 'This request is unavailable for your role.');
    if (intent.kind === 'dashboard' || intent.kind === 'ranking') {
      if (!rights.manager) return denied();
      return setReport(intent.kind);
    }
    if (intent.kind === 'leads') {
      if (!rights.leads) return denied();
      setLeadFilters(intent.filters);
      setAssignee(undefined);
      return setReport('leads');
    }
    if (intent.kind === 'assignee') {
      if (!(rights.manager || rights.agencyOwner || rights.teamLead)) return denied();
      if (report !== 'leads') setLeadFilters({});
      setAssignee(intent.name);
      return setReport('leads');
    }
    if (intent.kind === 'new-lead') {
      if (!rights.leads) return denied();
      return nav.navigate('NewLead', { name: intent.name, phone: intent.phone, paste: intent.paste });
    }
    if (intent.kind === 'deals') {
      setDealLastMonth(intent.lastMonth);
      return setReport('deals');
    }
    if (intent.kind === 'reverse') {
      if (!rights.leads) return denied();
      setReverseCode(intent.code);
      return setReport('reverse');
    }
    if (intent.kind === 'unit') return nav.navigate('Unit', { code: intent.code });
    if (intent.kind === 'unit-work') return nav.navigate('UnitsList', intent.missingPhotos ? { missingPhotos: true } : { old: true });
    if (intent.kind === 'links' && intent.name) {
      if (!rights.leads) return denied();
      setOfferLookup({ name: intent.name, days: intent.days });
      return setReport('lead-offers');
    }
    if (intent.kind === 'links') return nav.navigate('Links', { search: intent.name, opened: intent.opened, days: intent.days });
    if (intent.kind === 'signed-sources') {
      if (!rights.manager) return denied();
      return nav.navigate('Sources', { signedOnly: true });
    }
    if (intent.kind === 'route') {
      if (['sources', 'losses', 'changes'].includes(intent.destination) && !rights.manager) return denied();
      if (intent.destination === 'team' && !(rights.team || rights.teamLead || rights.manager)) return denied();
      if (intent.destination === 'team') return nav.navigate('Team', { order: intent.teamOrder });
      if (intent.destination === 'sources') return nav.navigate('Sources', undefined);
      return nav.navigate(SEARCH_DESTINATIONS[intent.destination].route);
    }
    if (intent.kind === 'unsupported') {
      const messages = {
        reverse: ar ? 'اكتب كود الوحدة عشان نلاقي العملاء المناسبين.' : 'Include the unit code to find matching leads.',
      };
      return clarify(messages[intent.feature]);
    }
    if (intent.kind === 'clarify' && chosenSource === 'inventory') return clarify(ar
      ? 'حدد تقصد أنهي نتيجة. لو بتدور في مشاريع المطورين، قول برايمري أو اختاره.'
      : 'Choose a result or edit your question. For developer projects, say Primary or select it.');
    const next = intent.kind === 'source' ? intent.source : chosenSource;
    setReport(null);
    setSource(next);
    setGroup(next === 'primary' ? 'primary' : 'inventory');
    if (next !== 'primary') void run(clean);
    if (next !== 'inventory') answer.mutate(clean);
  };
  const pickSource = (next: Source) => {
    setChosenSource(next);
    if (submitted && !report) submit(submitted, next);
    else {
      setReport(null);
      setSource(next);
      setGroup(next === 'primary' ? 'primary' : 'inventory');
      setSubmitted('');
      search.reset();
    }
  };
  const primaryView = Boolean(submitted && (source === 'primary' || (source === 'both' && group === 'primary')));
  const busy = search.isPending || answer.isPending;
  const clearDisabled = busy || loadingMore || transcribing || !(submitted || text || report || recent.length);
  const clearChat = () => {
    generation.current += 1;
    Keyboard.dismiss();
    setText('');
    setSubmitted('');
    setReport(null);
    setToolsOpen(false);
    setSource('inventory');
    setChosenSource('inventory');
    setGroup('inventory');
    setLast(null);
    setExtra([]);
    setDone(false);
    setLeadFilters({});
    setAssignee(undefined);
    setOfferLookup(undefined);
    setDealLastMonth(false);
    setReverseCode('');
    setClarification('');
    setVoiceError(null);
    clearedRecents.current = true;
    setRecent([]);
    hidden.value = false;
    lastY.value = 0;
    slide.value = 0;
    search.reset();
    answer.reset();
    if (recentKey) AsyncStorage.removeItem(recentKey).catch(() => undefined);
  };
  const data = search.data;
  const atHome = !report && !submitted && !data && !search.isError && !busy;
  const openHomeReport = (value: SearchView, queue?: 'unassigned' | 'uncontacted' | 'delayed-first-contact' | 'viewings-tomorrow') => {
    setReport(value);
    setSubmitted('');
    setLeadFilters(queue ? { queue } : {});
    setAssignee(undefined);
    setDealLastMonth(false);
  };
  const body = search.isPending ? (
    <Loading label={t(lang, 'loading')} />
  ) : search.isError ? (
    <ErrorView message={errorText(search.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => run(text)} />
  ) : !data ? (
    <SearchHome openQueue={(queue) => openHomeReport('leads', queue)} openDeals={() => openHomeReport('deals')}
      invitation={invitation && invitation === practiceKey ? <View style={styles.invitation}>
        <Button label={ar ? 'جرّب البحث' : 'Try Search'} onPress={startPractice} variant="secondary" size="sm" testID="practice-start" />
        <Button label={ar ? 'تخطّي' : 'Skip'} onPress={dismissInvitation} variant="quiet" size="sm" testID="practice-skip" />
      </View> : null}>
      <Pressable testID="search-tools" accessibilityRole="button" accessibilityState={{ expanded: toolsOpen }}
        onPress={() => setToolsOpen((value) => !value)} style={[styles.toolRow, { borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{ar ? 'أدوات البحث' : 'Search tools'}</Text>
        <Text accessible={false} style={{ color: colors.muted }}>{toolsOpen ? '−' : '+'}</Text>
      </Pressable>
      {toolsOpen ? <Animated.View entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(100).reduceMotion(ReduceMotion.System)} style={styles.tools}>
        <Button label={ar ? 'جرّب البحث' : 'Try Search'} onPress={startPractice} variant="quiet" size="sm" testID="practice-replay" />
        <Text style={{ color: colors.muted, fontSize: 13 }}>{t(lang, recent.length ? 'searchRecent' : 'searchTry')}</Text>
        {(recent.length ? recent : (['searchExample1', 'searchExample2', 'searchExample3'] as const).map((k) => t(lang, k))).map((q, i) => (
          <Pressable key={q} testID={recent.length ? `searchRecent${i + 1}` : `searchExample${i + 1}`} accessibilityRole="button" onPress={() => { setText(q); submit(q); }} style={styles.toolRow}>
            <Text style={{ color: colors.text }}>{q}</Text>
          </Pressable>
        ))}
        {([{ value: 'deals', label: ar ? 'الصفقات' : 'Closed deals' },
          ...(rights.leads ? [{ value: 'leads', label: t(lang, 'leadsTab') }] : []),
          ...(rights.manager ? [{ value: 'dashboard', label: t(lang, 'dashboard') }, { value: 'ranking', label: ar ? 'ترتيب الوسطاء' : 'Broker rankings' }] : []),
        ] as { value: SearchView; label: string }[]).map(({ value, label }) => (
          <Pressable key={value} accessibilityRole="button" onPress={() => openHomeReport(value)} style={styles.toolRow}>
            <Text style={{ color: colors.text }}>{label}</Text>
          </Pressable>
        ))}
      </Animated.View> : null}
    </SearchHome>
  ) : data.status === 'ask' ? (
    <View style={styles.ask}>
      <Text style={[styles.askTitle, { color: colors.text }]}>{t(lang, 'askTitle')}</Text>
      <Text style={{ color: colors.accentInk, fontWeight: '700' }}>{[...(data.ask?.terms ?? []), ...(data.ask?.numbers ?? []).map(String)].join(' · ')}</Text>
      <Button label={t(lang, 'askSearchAnyway')} onPress={() => run(text, true)} />
      <Button label={t(lang, 'askEdit')} variant="secondary" onPress={() => search.reset()} />
    </View>
  ) : data.status === 'small_talk' || data.status === 'other' ? (
    <EmptyView title={t(lang, 'smallTalk')} hint={t(lang, 'searchHint')} />
  ) : data.status === 'listing' ? (
    <EmptyView title={t(lang, 'listingHint')} />
  ) : data.status === 'none' ? (
    <EmptyView title={t(lang, 'noResults')} hint={t(lang, 'noResultsHint')} actionLabel={t(lang, 'clearSearch')} onAction={() => { setText(''); search.reset(); }} />
  ) : (
    <AnimatedFlashList
      data={[...data.items, ...extra]}
      keyExtractor={(u) => u.id}
      ListHeaderComponent={
        <View>
          {data.f && data.total > 0 ? <SaveSearchButton f={data.f} /> : null}
          {data.reading ? <Text testID="reading-line" style={[styles.count, { color: colors.text }]}>{data.reading}</Text> : null}
          <Text style={[styles.count, { color: colors.muted }]}>{data.total} {t(lang, 'results')}{data.relaxed ? ` · ${t(lang, 'relaxedNote')}` : ''}</Text>
          {data.guesses?.length ? <Text testID="guess-note" style={[styles.count, { color: colors.accentInk }]}>{data.guesses.map((g) => t(lang, 'guessNote').replace('{typed}', g.typed).replace('{as}', g.as)).join(' ')}</Text> : null}
          {data.unapplied?.length ? <Text testID="unapplied-note" style={[styles.count, { color: colors.accentInk }]}>{t(lang, 'unappliedNote')} {data.unapplied.join(' · ')}</Text> : null}
          {data.ignoredTerms?.length ? <Text testID="ignored-note" style={[styles.count, { color: colors.accentInk }]}>{t(lang, 'ignoredNote')} {data.ignoredTerms.join(' · ')}</Text> : null}
        </View>
      }
      renderItem={({ item }) => <UnitCard unit={item} lang={lang} onPress={() => { void track('search_unit_opened'); nav.navigate('Unit', { code: item.code }); }} />}
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingBottom: 150 }}
      onEndReached={() => { if (data.items.length + extra.length < data.total) loadMore(); }}
      onEndReachedThreshold={0.6}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.count} color={colors.primaryInk} /> : null}
    />
  );

  if (practicing) return <SearchPractice onClose={() => { Keyboard.dismiss(); setPracticing(false); }} />;

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      {voiceError ? <Text testID="voice-error" style={[styles.err, { color: colors.danger }]}>{voiceError}</Text> : null}
      <View testID="search-source" style={[styles.sources, { borderBottomColor: colors.border }]}>
        {([
          { value: 'inventory', label: ar ? 'الوحدات' : 'Inventory' },
          { value: 'primary', label: ar ? 'برايمري' : 'Primary' },
          { value: 'both', label: ar ? 'الاتنين' : 'Both' },
        ] as const).map(({ value, label }) => {
          const selected = !report && source === value;
          return <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected, disabled: busy }} disabled={busy}
            onPress={() => pickSource(value)} style={[styles.source, { borderBottomColor: selected ? colors.primary : 'transparent' }]}>
            <Text style={[styles.sourceLabel, { color: selected ? colors.primaryInk : colors.muted }]}>{label}</Text>
          </Pressable>;
        })}
      </View>
      {source === 'both' && submitted && !report ? <View style={styles.chips}>
        <Chips value={group} onChange={setGroup} options={[
          { value: 'inventory', label: (ar ? 'الوحدات' : 'Inventory') + (data ? ' (' + data.total + ')' : '') },
          { value: 'primary', label: ar ? 'مشروعات المطورين' : 'Developer projects' },
        ]} />
      </View> : null}
      {!report && !primaryView && data?.counts && last ? (
        <View style={styles.chips}>
          {(['active', 'sold', 'archived'] as const).map((st) => (
            <Pressable key={st} accessibilityRole="button" accessibilityState={{ selected: st === last.status }} onPress={() => run(last.q, last.drop, st)} style={[styles.chip, { borderColor: st === last.status ? colors.primary : colors.border }, st === last.status && { backgroundColor: colors.primary }]}>
              <Text style={{ color: st === last.status ? colors.onPrimary : colors.text, fontWeight: '600' }}>{t(lang, st)} ({data.counts?.[st] ?? 0})</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!report && !primaryView && data && data.source === 'fallback' && /QUOTA|AI_OFF/.test(data.aiError ?? '') ? (
        <View testID="quick-reader-note" style={styles.quick}>
          <Text style={{ color: colors.muted }}>⚡ {t(lang, 'quickReaderNote')}</Text>
          <Pressable testID="quick-reader-units" accessibilityRole="button" onPress={() => nav.navigate('UnitsList')}><Text style={{ color: colors.primaryInk, fontWeight: '600' }}>{t(lang, 'useUnitFilters')}</Text></Pressable>
        </View>
      ) : null}
      <Animated.View key={atHome ? 'brief' : 'results'} entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)} style={styles.flex}>
        {report === 'lead-offers' && offerLookup ? <ScrollView contentContainerStyle={styles.projectContent} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={[styles.askTitle, { color: colors.text }]}>{ar ? 'اختار العميل عشان تشوف العروض اللي بعتهاله' : 'Choose the lead to find the offers you sent'}</Text>
          <LeadPicker key={offerLookup.name} initial={offerLookup.name} onPick={(lead) => nav.navigate('Links', { leadRef: lead.ref, leadLabel: lead.name ?? undefined, days: offerLookup.days })} />
        </ScrollView> : report === 'reverse' ? <ScrollView contentContainerStyle={styles.projectContent}>
          <Text accessibilityRole="header" style={[styles.askTitle, { color: colors.text }]}>{t(lang, 'leadsTab')} · {reverseCode}</Text>
          {reverse.isPending ? <Loading label={t(lang, 'loading')} /> : null}
          {reverse.isError ? <ErrorView message={errorText(reverse.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => reverse.refetch()} /> : null}
          {reverse.data?.partial ? <Text style={{ color: colors.muted }}>{ar ? 'النتيجة من أحدث ٥٠ طلب محفوظ.' : 'Results are from the 50 most recent saved requests.'}</Text> : null}
          {reverse.data && !reverse.data.items.length ? <EmptyView title={t(lang, 'noLeads')} /> : null}
          {reverse.data?.items.map((lead) => <View key={lead.ref} style={[styles.answer, { backgroundColor: colors.card }]}>
            <Button variant="secondary" label={lead.name || lead.ref} onPress={() => nav.navigate('Lead', { ref: lead.ref })} />
            {lead.reason ? <Text style={{ color: colors.muted }}>{lead.reason}</Text> : null}
          </View>)}
        </ScrollView> : report === 'clarify' ? <View style={styles.ask}>
          <Text style={{ color: colors.text }}>{clarification}</Text>
          {rights.leads ? <Button variant="secondary" label={t(lang, 'leadsTab')} onPress={() => { if (!rights.leads) return; setLeadFilters({}); setAssignee(undefined); setReport('leads'); }} /> : null}
          <Button variant="secondary" label={t(lang, 'searchTab')} onPress={() => submit(submitted, chosenSource)} />
        </View> : report === 'lead-action' ? <SearchLeadAction key={submitted} command={readLeadCommand(submitted)} onClose={() => { setReport('leads'); setSubmitted(''); setText(''); }} /> :
          (report === 'dashboard' || report === 'ranking') ? <DashboardScreen embedded ranking={report === 'ranking'} key={report} /> :
          report === 'leads' ? <SearchLeads key={JSON.stringify(leadFilters)} assignedInitially={Boolean(leadFilters.assigned)} initialQueue={leadFilters.queue} initialTab={leadFilters.tab} lookup={leadFilters.lookup} matching={leadFilters.matching} requestedAssignee={assignee} /> :
          report === 'deals' ? <SearchDeals initialPeriod={dealLastMonth ? 'last' : 'recent'} key={String(dealLastMonth)} /> : primaryView ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.projectContent}>
            {answer.isPending ? <Loading label={t(lang, 'loading')} /> : null}
            {answer.isError ? <ErrorView message={errorText(answer.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => answer.mutate(submitted)} /> : null}
            {answer.data ? <View style={[styles.answer, { backgroundColor: colors.card }]}>
              <Text selectable style={{ color: colors.text, fontSize: 16 }}>{answer.data.answer}</Text>
              {answer.data.source === 'local' ? <Text style={{ color: colors.muted }}>{pt(lang).localAnswer}</Text> : null}
              {answer.data.dataDates ? <Text style={{ color: colors.muted }}>{answer.data.dataDates}</Text> : null}
              <Button variant="secondary" label={t(lang, 'copyAnswer')} onPress={() => { if (answer.data) void Share.share({ message: answer.data.answer }).catch(() => undefined); }} />
            </View> : null}
            <AskResults showStatus key={submitted} q={submitted} onOpenProject={(id, name) => nav.navigate('Project', { id, name })} />
          </ScrollView>
        ) : body}
      </Animated.View>
      <Animated.View style={[styles.bar, { backgroundColor: colors.bg, borderColor: colors.border, bottom: 0 }, barSlide]}>
      <VoiceBar actionDecoration={credits.data ? <SearchCreditRings data={credits.data} /> : undefined}
        accessory={<Pressable testID="search-clear-chat" accessibilityRole="button" accessibilityLabel={ar ? 'امسح المحادثة' : 'Clear chat'}
          accessibilityState={{ disabled: clearDisabled }} disabled={clearDisabled} onPress={clearChat} style={styles.clearButton}>
          <Icon name="trash" size={21} color={clearDisabled ? colors.border : colors.muted} />
        </Pressable>}
        id="search" label={t(lang, 'mic')} value={text} onChangeText={setText} placeholder={ar ? 'ابحث أو اسأل' : 'Search or ask'} onSubmit={() => submit(text)} onFile={onVoice} onError={setVoiceError} disabled={busy || transcribing} busy={busy || transcribing} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  projectContent: { padding: spacing.lg, paddingBottom: 150, gap: spacing.md },
  answer: { borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm },
  invitation: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toolRow: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tools: { gap: spacing.xs },
  bar: { position: 'absolute', start: 0, end: 0, bottom: 0, padding: spacing.md, gap: spacing.sm, borderTopWidth: 1 },
  err: { padding: spacing.lg, textAlign: 'center' },
  ask: { padding: spacing.xl, gap: spacing.md },
  askTitle: { fontSize: 18, fontWeight: '700' },
  count: { padding: spacing.lg },
  quick: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
  clearButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  sources: { flexDirection: 'row', paddingHorizontal: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  source: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 2, paddingHorizontal: spacing.xs },
  sourceLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.lg, height: 40, justifyContent: 'center' },
});
