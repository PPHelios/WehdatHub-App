import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { timed, usage } from '../usage';
import { track } from '../analytics';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import Animated, { FadeIn, FadeOut, ReduceMotion, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError, type ApiUnitListItem, type AssistantContext, type AssistantMode, type LeadQueue, type SearchResult, type UnitStatus, type VoiceFile } from '@wehdathub/shared';
import { api } from '../api';
import { SearchCreditRings, useSearchCredits } from '../components/SearchCreditRings';
import { currentLang, useAuth } from '../auth';
import { AskResults } from '../components/AskResults';
import { AssistantCards } from '../components/AssistantCards';
import { Chip } from '../components/Chip';
import { ComposerPopover } from '../components/ComposerPopover';
import { Icon } from '../components/Icon';
import { useKeyboardVisible } from '../components/KeyboardLift';
import { useSelectionHighlight } from '../components/SelectionHighlight';
import { pt } from '../projectText';
import { readLeadCommand, SearchLeadAction } from '../components/SearchLeadAction';
import { SearchLeads } from '../components/SearchLeads';
import { DashboardScreen } from './InsightsScreens';
import { useRightsState } from '../rights';
import { parseSearchIntent } from '../searchCapabilities';
import type { SearchIntent } from '../searchCapabilities';
import { SearchPractice } from '../components/SearchPractice';
import { SearchHome } from '../components/SearchHome';
import { HomeRow } from '../components/HomeRow';
import { SearchDeals } from '../components/SearchDeals';
import { Button } from '../components/Button';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { SaveSearchButton } from '../components/SaveSearchButton';
import { UnitCard } from '../components/UnitCard';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { greenGradient, radius, spacing, useTheme } from '../theme';
import { VoiceBar } from '../components/VoiceBar';
import { needsVoiceConfirm } from '../voiceConfirm';

type SearchView = 'deals' | 'leads' | 'dashboard' | 'ranking' | 'lead-action' | 'clarify' | 'assistant';

const RECENT_KEY = 'wehdathub.recentSearches';
const ASSISTANT_NAV_SCREENS = new Set(['LeadsList', 'Team', 'Dashboard', 'Deals', 'Sources', 'Commissions', 'Requests', 'Owners', 'Leases', 'UnitsList', 'WinLoss', 'Prices', 'Plan', 'Projects', 'Calendar']);

function normalizeForRoute(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[\u0640\u064b-\u065f]/g, '')
    .replace(/\s+/g, ' ');
}

function shouldUseAssistantEndpoint(clean: string, mode: AssistantMode): boolean {
  if (mode !== 'auto') return true;
  const q = normalizeForRoute(clean);
  return /(waiting\s*(?:over|>)\s*1|not\s+updating|silent\s+broker|who.*updat|scorecard|(?:how\s+is|performance\s+of|scorecard\s+for|status\s+of)\s+\S+|what\s+did\s+.+\s+do|how\s+did\s+.+\s+do|\S+(?:'s|’s)\s+team\b|(?:the|my|our)\s+team\b|\bteam\s+(?:workload|activity|performance|calls|viewings|updates|deals|stats|summary)\b|(?:viewings?|calls?|updates?)\s+(?:by|for|of)\s+\S+|how\s+many\s+(?:viewings?|calls?|updates?|leads?|deals?)|\bviewings?\s+(?:today|tomorrow|this\s+week)\b|(?:average|avg|median|first|reply)\s*response|response\s+time|fastest|slowest|stats\s+for\s+\S+|commission|payout|claimable|overdue|unassigned|uncontacted|ad\s*spend|marketing\s*spend|\broi\b|\bcpl\b|\bcpd\b|facebook|\bfb\b|\bmeta\b|instagram|tiktok|google|olx|dubizzle|bayut|property\s*finder|nawy|lead\s+sources?|leases?\s+ending|win\s*\/?\s*loss|win\s*rate|lost\s+reasons?|agency\s+brief|executive\s+brief|dashboard|overview|مستنين.*ساع|انتظار.*ساع|مبيحدث|مش بيحدث|مفيش\s+تحديث|بدون\s*تحديث|التزام.*تحديث|صامت|تقييم\s+\S+|عملت?\s+ايه|فريق\s+\S+|\S+\s+فريق|كام\s+(?:معاين|مكالم|تحديث|عميل|صفق)|معاينات\s+(?:النهارده|بكره|اليوم)|وقت\s+الرد|متوسط\s+الرد|اول\s+رد|فيسبوك|فيس بوك|انستجرام|تيك توك|جوجل|دوبيزل|بروبرتي|بيوت|نوي|عمولات|عموله|صرف\s*تسويق|مصادر\s*العملاء|ايجارات|خسار|معدل القفل|ملخص الشركه|اداء الشركه)/i.test(q);
}

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList<ApiUnitListItem>);

export function SearchScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const ar = lang === 'ar';
  const broker = useAuth((state) => state.broker);
  const recentKey = broker?.id ? `${RECENT_KEY}:${broker.id}` : null;
  const generation = useRef(0);
  const previousIdentity = useRef(recentKey);
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

  const [source, setSource] = useState<'inventory' | 'primary'>('inventory');
  const [mode, setMode] = useState<AssistantMode>('auto');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const credits = useSearchCredits();
  const [submitted, setSubmitted] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [report, setReport] = useState<SearchView | null>(null);
  const { rights, nav: appNav } = useRightsState();
  const queries = useQueryClient();
  const [leadFilters, setLeadFilters] = useState<Extract<SearchIntent, { kind: 'leads' }>['filters']>({});
  const [assignee, setAssignee] = useState<string>();
  const [dealLastMonth, setDealLastMonth] = useState(false);
  const [clarification, setClarification] = useState('');
  const refreshCredits = () => queries.invalidateQueries({ queryKey: ['search-credits'] });
  const answer = useMutation({ mutationFn: (q: string) => timed('ask', () => api.ask(q)), onSettled: () => { void refreshCredits(); } });
  const [assistantContext, setAssistantContext] = useState<AssistantContext | null>(null);
  const assistant = useMutation({
    mutationFn: ({ q, m, previousContext }: { q: string; m: AssistantMode; previousContext?: AssistantContext | null }) =>
      api.assistantQuery({ q, mode: m, lang, ...(previousContext ? { previousContext } : {}) }),
    onSettled: () => { void refreshCredits(); },
  });
  const [text, setText] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceConfirmOrigin, setVoiceConfirmOrigin] = useState<string | null>(null);
  // The search box and mic float at the bottom like a chat app: they slide away on scrolling down and come back on scrolling up.
  const slide = useSharedValue(0);
  const lastY = useSharedValue(0);
  const hidden = useSharedValue(false);
  const reduceMotion = useReducedMotion();
  const keyboardVisible = useKeyboardVisible();
  const keyboardOpen = useSharedValue(false);
  useEffect(() => {
    keyboardOpen.value = keyboardVisible;
    if (keyboardVisible) {
      hidden.value = false;
      slide.value = 0;
    }
  }, [hidden, keyboardOpen, keyboardVisible, slide]);
  const onScroll = useAnimatedScrollHandler((e) => {
    const y = Math.max(0, e.contentOffset.y);
    const dy = y - lastY.value;
    lastY.value = y;
    if (keyboardOpen.value) return;
    const hide = dy > 6 && y > 60 ? true : dy < -6 || y <= 60 ? false : hidden.value;
    if (hide !== hidden.value) {
      hidden.value = hide;
      slide.value = withTiming(hide ? 220 : 0, { duration: reduceMotion ? 0 : 180 });
    }
  });
  const barSlide = useAnimatedStyle(() => ({ transform: [{ translateY: slide.value }] }));
  const search = useMutation<SearchResult, Error, { q: string; opts: Parameters<typeof api.search>[1] }>({
    mutationFn: ({ q, opts }) => timed('search', () => api.search(q, opts)),
    onSettled: () => { void refreshCredits(); },
  });
  const [assistantUnits, setAssistantUnits] = useState<SearchResult | null>(null);
  const [assistantSuggestPrimary, setAssistantSuggestPrimary] = useState(false);
  // Active units first; Sold and Archived are one tap away, with their counts from the start. More results load on demand.
  const [statusCounts, setStatusCounts] = useState<SearchResult['counts']>();
  const [last, setLast] = useState<{ q: string; drop: boolean; status: UnitStatus; f?: string | null; market?: 'resale' | 'primary' | null; sort?: string | null } | null>(null);
  const [extra, setExtra] = useState<ApiUnitListItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const resetSearch = search.reset;
  const resetAnswer = answer.reset;
  const resetAssistant = assistant.reset;
  const clearedRecents = useRef(false);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    generation.current += 1;
    clearedRecents.current = false;
    setRecent([]);
    if (previousIdentity.current !== recentKey) {
      previousIdentity.current = recentKey;
      resetSearch();
      resetAnswer();
      resetAssistant();
      setAssistantUnits(null);
      setAssistantSuggestPrimary(false);
      setAssistantContext(null);
      setExtra([]);
      setLast(null);
      setReport(null);
      setSubmitted('');
      setText('');
      setTranscribing(false);
      setVoiceConfirmOrigin(null);
      setLoadingMore(false);
    }
    AsyncStorage.removeItem(RECENT_KEY).catch(() => undefined);
    if (recentKey) AsyncStorage.getItem(recentKey).then((raw) => {
      const values = raw ? JSON.parse(raw) : [];
      if (active && !clearedRecents.current && Array.isArray(values)) setRecent(values.filter((value) => typeof value === 'string').slice(0, 3));
    }).catch(() => undefined);
    return () => { active = false; generation.current += 1; };
  }, [recentKey, resetSearch, resetAnswer, resetAssistant]);

  const supersedePendingSearch = () => {
    generation.current += 1;
    setTranscribing(false);
    setLoadingMore(false);
    setVoiceError(null);
    setAssistantUnits(null);
    setAssistantSuggestPrimary(false);
    resetAssistant();
    resetAnswer();
  };

  const rememberRecent = (clean: string) => {
    setRecent((prev) => {
      const next = [clean, ...prev.filter((x) => x !== clean)].slice(0, 3);
      if (recentKey) AsyncStorage.setItem(recentKey, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  };

  const run = async (
    q: string,
    drop = false,
    status: UnitStatus = 'active',
    carry?: { f?: string | null; market?: 'resale' | 'primary' | null; sort?: string | null } | null,
  ) => {
    const clean = q.trim();
    if (!clean) return;
    supersedePendingSearch();
    setExtra([]);
    setDone(false);
    if (last?.q !== clean || last.drop !== drop) setStatusCounts(undefined);
    const f = carry?.f ?? undefined;
    const market = carry?.market ?? undefined;
    const sort = carry?.sort ?? undefined;
    setLast({ q: clean, drop, status, ...(f ? { f } : {}), ...(market ? { market } : {}), ...(sort ? { sort } : {}) });
    rememberRecent(clean);
    const opts: Parameters<typeof api.search>[1] = {
      drop,
      status,
      ...(f ? { f } : {}),
      ...(market ? { market } : {}),
      ...(sort ? { sort } : {}),
    };
    const started = Date.now();
    void track('search_started');
    const result = await search.mutateAsync({ q: clean, opts }).catch(() => undefined);
    void track('search_run', { outcome: result?.status ?? 'error', duration_ms: Date.now() - started });
  };

  const routeParsedIntent = (clean: string, forceSearch = false) => {
    const intent = forceSearch ? { kind: 'search' } as const :
      parseSearchIntent(clean, report === 'leads' || report === 'deals' ? report : undefined);
    const clarify = (message: string) => { setClarification(message); setReport('clarify'); };
    const denied = () => clarify(ar ? 'الطلب ده مش متاح لصلاحياتك.' : 'This request is unavailable for your role.');
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
    if (intent.kind === 'deals') {
      setDealLastMonth(intent.lastMonth);
      return setReport('deals');
    }
    if (intent.kind === 'clarify') {
      return clarify(ar
        ? 'حدد تقصد أنهي نتيجة. لو بتدور في مشاريع المطورين، اكتب برايمري.'
        : 'Choose a result or edit your question. For developer projects, include Primary.');
    }
    const next = intent.kind === 'source' ? intent.source : 'inventory';
    setReport(null);
    setSource(next);
    if (next === 'primary') answer.mutate(clean);
    else void run(clean);
  };

  const runAssistant = async (clean: string, activeMode: AssistantMode) => {
    const reqGen = generation.current;
    setReport('assistant');
    setSource(activeMode === 'primary' ? 'primary' : 'inventory');
    try {
      const res = await assistant.mutateAsync({ q: clean, m: activeMode, ...(assistantContext ? { previousContext: assistantContext } : {}) });
      if (reqGen !== generation.current) return;
      usage('assistant_query_run', true, undefined, { mode: activeMode });
      if (res.intent !== 'disambiguate') setAssistantContext(res.nextContext ?? null);
      if (res.intent === 'unit_search') {
        rememberRecent(clean);
        if (res.units && (res.units.items.length > 0 || res.units.status === 'ask')) {
          resetSearch();
          resetAssistant();
          setAssistantUnits(res.units);
          setAssistantSuggestPrimary(Boolean(res.suggestPrimary));
          setStatusCounts(res.units.counts);
          const effectiveMarket = res.units.marketLock ?? (activeMode === 'resale' ? 'resale' : undefined);
          setLast({
            q: clean,
            drop: false,
            status: res.units.unitStatus ?? 'active',
            ...(res.units.f ? { f: res.units.f } : {}),
            ...(effectiveMarket ? { market: effectiveMarket } : {}),
            ...(res.units.sort ? { sort: res.units.sort } : {}),
          });
          setExtra([]);
          setDone(res.units.items.length >= res.units.total);
          setReport(null);
        }
      }
    } catch (err) {
      if (reqGen !== generation.current) return;
      const legacyMissing = typeof api.assistantQuery !== 'function' || (err instanceof ApiClientError && (err.status === 404 || err.status === 501));
      if (legacyMissing) {
        setReport(null);
        if (activeMode === 'primary') { setSource('primary'); answer.mutate(clean); }
        else if (activeMode === 'resale') { setSource('inventory'); void run(clean); }
        else { routeParsedIntent(clean, false); }
      }
    }
  };
  const loadMore = async () => {
    const activeData = search.data ?? assistantUnits;
    if (!last || !activeData || loadingMore || done) return;
    const requestGeneration = generation.current;
    setLoadingMore(true);
    try {
      const r = await api.search(last.q, {
        drop: last.drop,
        status: last.status,
        offset: activeData.items.length + extra.length,
        ...(last.f ? { f: last.f } : {}),
        ...(last.market ? { market: last.market } : {}),
        ...(last.sort ? { sort: last.sort } : {}),
      });
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
      const cleaned = (q ?? '').trim();
      usage('voice_transcript_outcome', Boolean(cleaned), undefined, { outcome: cleaned ? 'sent_as_is' : 'empty', mode });
      void refreshCredits();
      setTranscribing(false);
      if (cleaned && needsVoiceConfirm(cleaned).confirm) {
        setText(cleaned);
        setVoiceConfirmOrigin(cleaned);
        return;
      }
      setVoiceConfirmOrigin(null);
      setText(q);
      submit(q);
    } catch (e) {
      usage('voice_transcript_outcome', false, undefined, { outcome: 'error', mode });
      if (requestGeneration === generation.current) setVoiceError(errorText(e, lang));
    } finally {
      if (requestGeneration === generation.current) setTranscribing(false);
    }
  };

  const submit = (q: string, fromClarification = false) => {
    const clean = q.trim();
    if (!clean) return;
    setPopoverOpen(false);
    Keyboard.dismiss();
    supersedePendingSearch();
    setSubmitted(clean);
    hidden.value = false;
    slide.value = 0;
    if (!fromClarification && rights.leads && readLeadCommand(clean)) {
      setReport('lead-action');
      return;
    }
    if (!fromClarification && shouldUseAssistantEndpoint(clean, mode)) {
      void runAssistant(clean, mode);
      return;
    }
    routeParsedIntent(clean, fromClarification);
  };
  const primaryView = Boolean(submitted && source === 'primary');
  const busy = search.isPending || answer.isPending || assistant.isPending;
  const clearDisabled = busy || loadingMore || transcribing || !(submitted || text || report || recent.length || assistant.data);
  const clearChat = () => {
    generation.current += 1;
    Keyboard.dismiss();
    setText('');
    setSubmitted('');
    setReport(null);
    setToolsOpen(false);
    setPopoverOpen(false);
    setMode('auto');
    setSource('inventory');
    setLast(null);
    setExtra([]);
    setDone(false);
    setLeadFilters({});
    setAssignee(undefined);
    setDealLastMonth(false);
    setClarification('');
    setVoiceError(null);
    clearedRecents.current = true;
    setRecent([]);
    hidden.value = false;
    lastY.value = 0;
    slide.value = 0;
    setAssistantUnits(null);
    setAssistantSuggestPrimary(false);
    setAssistantContext(null);
    setVoiceConfirmOrigin(null);
    search.reset();
    answer.reset();
    assistant.reset();
    if (recentKey) AsyncStorage.removeItem(recentKey).catch(() => undefined);
  };
  const data = search.data ?? assistantUnits;
  const counts = data?.counts ?? (search.isPending ? statusCounts : undefined);
  const statusSelection = useSelectionHighlight(last?.status, greenGradient);
  const atHome = !report && !submitted && !data && !search.isError && !busy && !assistant.data && !assistant.isError;
  const showInvitation = Boolean(invitation && invitation === practiceKey);
  const openHomeReport = (value: SearchView, queue?: LeadQueue) => {
    setReport(value);
    setSubmitted('');
    setLeadFilters(queue ? { queue } : {});
    setAssignee(undefined);
    setDealLastMonth(false);
  };
  const body = search.isPending ? (
    <Loading label={t(lang, 'loading')} />
  ) : search.isError ? (
    <ErrorView message={errorText(search.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => last ? run(last.q, last.drop, last.status, last) : run(submitted || text)} />
  ) : !data ? (
    <SearchHome openQueue={(queue) => openHomeReport('leads', queue)} onTryPrompt={(prompt) => { setText(prompt); submit(prompt); }}
      invitation={showInvitation ? <View style={styles.invitation}>
        <Button label={ar ? 'جرّب البحث' : 'Try Search'} onPress={startPractice} variant="secondary" size="sm" testID="practice-start" />
        <Button label={ar ? 'تخطّي' : 'Skip'} onPress={dismissInvitation} variant="quiet" size="sm" testID="practice-skip" />
      </View> : null}>
      <HomeRow testID="search-tools" title={ar ? 'أدوات البحث' : 'Search tools'} icon="search" expanded={toolsOpen}
        onPress={() => setToolsOpen((value) => !value)} />
      {toolsOpen ? <Animated.View entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(100).reduceMotion(ReduceMotion.System)} style={styles.tools}>
        {!showInvitation ? <HomeRow title={ar ? 'جرّب البحث' : 'Try Search'} onPress={startPractice} icon="help" testID="practice-replay" /> : null}
        <Text style={{ color: colors.muted, fontSize: 13 }}>{t(lang, recent.length ? 'searchRecent' : 'searchTry')}</Text>
        {(recent.length ? recent : (['searchExample1', 'searchExample2', 'searchExample3'] as const).map((k) => t(lang, k))).map((q, i) => (
          <HomeRow key={q} title={q} testID={recent.length ? `searchRecent${i + 1}` : `searchExample${i + 1}`} onPress={() => { setText(q); submit(q); }} />
        ))}
        {([{ value: 'deals', label: ar ? 'الصفقات' : 'Closed deals' },
          ...(rights.leads ? [{ value: 'leads', label: t(lang, 'leadsTab') }] : []),
          ...(rights.manager ? [{ value: 'dashboard', label: t(lang, 'dashboard') }, { value: 'ranking', label: ar ? 'ترتيب الوسطاء' : 'Broker rankings' }] : []),
        ] as { value: SearchView; label: string }[]).map(({ value, label }) => (
          <HomeRow key={value} title={label} onPress={() => openHomeReport(value)} />
        ))}
      </Animated.View> : null}
    </SearchHome>
  ) : data.status === 'ask' ? (
    <View style={styles.ask}>
      <Text style={[styles.askTitle, { color: colors.text }]}>{t(lang, 'askTitle')}</Text>
      <Text style={{ color: colors.accentInk, fontWeight: '700' }}>{[...(data.ask?.terms ?? []), ...(data.ask?.numbers ?? []).map(String)].join(' · ')}</Text>
      <Button label={t(lang, 'askSearchAnyway')} onPress={() => run(last?.q ?? text, true, last?.status ?? 'active', last ?? undefined)} />
      <Button label={t(lang, 'askEdit')} variant="secondary" onPress={() => { search.reset(); setAssistantUnits(null); }} />
    </View>
  ) : data.status === 'small_talk' || data.status === 'other' ? (
    <EmptyView title={t(lang, 'smallTalk')} hint={t(lang, 'searchHint')} />
  ) : data.status === 'listing' ? (
    <EmptyView title={t(lang, 'listingHint')} />
  ) : data.status === 'none' ? (
    <EmptyView title={t(lang, 'noResults')} hint={t(lang, 'noResultsHint')} actionLabel={t(lang, 'clearSearch')} onAction={() => { setText(''); search.reset(); setAssistantUnits(null); }} />
  ) : (
    <AnimatedFlashList
      testID="search-results-list"
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
      contentContainerStyle={{ paddingBottom: 90 }}
      onEndReached={() => { if (data.items.length + extra.length < data.total) loadMore(); }}
      onEndReachedThreshold={0.6}
      ListFooterComponent={
        loadingMore ? <ActivityIndicator style={styles.count} color={colors.primaryInk} />
        : assistantSuggestPrimary && last?.q ? (
          <View style={styles.pivotFooter}>
            <Button
              testID="assistant-pivot-primary"
              variant="secondary"
              label={ar ? 'تشوف مشاريع برايمري كمان؟' : 'Check Primary projects too?'}
              onPress={() => {
                setAssistantUnits(null);
                setAssistantSuggestPrimary(false);
                setMode('primary');
                void runAssistant(last.q, 'primary');
              }}
            />
          </View>
        ) : null
      }
    />
  );

  if (practicing) return <SearchPractice onClose={() => { Keyboard.dismiss(); setPracticing(false); }} />;

  return (
    <View style={[styles.flex, styles.composerFrame, { backgroundColor: colors.bg }]}>
      {voiceError ? <Text testID="voice-error" style={[styles.err, { color: colors.danger }]}>{voiceError}</Text> : null}
      {!report && !primaryView && counts && last ? (
        <View style={styles.chips}>
          {statusSelection.highlight}
          {(['active', 'sold', 'archived'] as const).map((st) => (
            <Pressable key={st} onLayout={statusSelection.measure(st)} accessibilityRole="button" accessibilityState={{ selected: st === last.status }} disabled={search.isPending} onPress={() => { setStatusCounts(counts); void run(last.q, last.drop, st, last); }} style={[styles.chip, { borderColor: st === last.status ? colors.primary : colors.border }, st === last.status && !statusSelection.highlight && greenGradient]}>
              <Text style={{ color: st === last.status ? '#FFFFFF' : colors.text, fontWeight: '700' }}>{t(lang, st)} ({counts[st] ?? 0})</Text>
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
        {report === 'clarify' ? <View style={styles.ask}>
          <Text style={{ color: colors.text }}>{clarification}</Text>
          {rights.leads ? <Button variant="secondary" label={t(lang, 'leadsTab')} onPress={() => { if (!rights.leads) return; setLeadFilters({}); setAssignee(undefined); setReport('leads'); }} /> : null}
          <Button variant="secondary" label={t(lang, 'searchTab')} onPress={() => submit(submitted, true)} />
        </View> : report === 'lead-action' ? <SearchLeadAction key={submitted} command={readLeadCommand(submitted)} onClose={() => { setReport('leads'); setSubmitted(''); setText(''); }} /> :
          (report === 'dashboard' || report === 'ranking') ? <DashboardScreen embedded ranking={report === 'ranking'} key={report} /> :
          report === 'assistant' ? (
            assistant.isPending ? <Loading label={t(lang, 'loading')} />
            : assistant.isError ? <ErrorView message={errorText(assistant.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => void runAssistant(submitted || text, mode)} />
            : assistant.data ? (
              <AssistantCards
                response={assistant.data}
                query={submitted || text}
                ar={ar}
                onAssignLead={async (ref, brokerId, version) => {
                  const ver = version ?? (await api.lead(ref)).lead.version;
                  await api.assignLead(ref, ver, brokerId);
                  usage('lead_assign', true);
                  usage('assistant_action_tapped', true, undefined, { action: 'reassign' });
                  void queries.invalidateQueries({ queryKey: ['leads'] });
                  void queries.invalidateQueries({ queryKey: ['lead', ref] });
                  void queries.invalidateQueries({ queryKey: ['today'] });
                  void queries.invalidateQueries({ queryKey: ['dashboard'] });
                }}
                onNudgeLead={async (ref) => {
                  await api.nudgeLead(ref);
                  usage('lead_nudge_sent', true);
                  usage('assistant_action_tapped', true, undefined, { action: 'nudge' });
                }}
                onOpenLead={(ref) => nav.navigate('Lead', { ref })}
                onOpenUnit={(code) => { void track('search_unit_opened'); nav.navigate('Unit', { code }); }}
                onPivotPrimary={(qText) => {
                  usage('assistant_action_tapped', true, undefined, { action: 'pivot_primary' });
                  usage('route_override', true, undefined, { action: 'pivot_primary', mode, to_mode: 'primary' });
                  setMode('primary');
                  void runAssistant(qText, 'primary');
                }}
                onViewAllMarkets={(qText) => {
                  usage('assistant_action_tapped', true, undefined, { action: 'view_all_markets' });
                  usage('route_override', true, undefined, { action: 'view_all_markets', mode, to_mode: 'auto' });
                  setReport(null);
                  setSource('inventory');
                  setAssistantUnits(null);
                  assistant.reset();
                  void run(qText, false, 'active');
                }}
                onChangeSearch={(qText) => {
                  usage('assistant_action_tapped', true, undefined, { action: 'change_search' });
                  usage('search_corrected', true, undefined, { action: 'change_search', mode });
                  setText(qText);
                  setSubmitted('');
                  setReport(null);
                  setAssistantUnits(null);
                  assistant.reset();
                }}
                onShareSummary={() => usage('assistant_action_tapped', true, undefined, { action: 'share_summary' })}
                onNavigateLink={(target, params) => {
                  if (ASSISTANT_NAV_SCREENS.has(target)) {
                    nav.navigate(...(params ? [target, params] : [target]) as never);
                  }
                }}
                onSelectOption={(optQuery) => {
                  setText(optQuery);
                  submit(optQuery);
                }}
                onOpenQueue={(queue) => openHomeReport('leads', queue)}
                extraFooter={assistant.data.projects && assistant.data.projects.total_projects > 0
                  ? <AskResults showStatus key={submitted} q={submitted} initial={assistant.data.projects} onOpenProject={(id, name) => nav.navigate('Project', { id, name })} />
                  : undefined}
              />
            ) : <Loading label={t(lang, 'loading')} />
          ) :
          report === 'leads' ? <SearchLeads key={JSON.stringify([leadFilters, assignee])} assignedInitially={Boolean(leadFilters.assigned)} initialQueue={leadFilters.queue} initialTab={leadFilters.tab} lookup={leadFilters.lookup} requestedAssignee={assignee} /> :
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
      <Animated.View style={[styles.composerStack, barSlide]}>
        <ComposerPopover
          visible={popoverOpen}
          mode={mode}
          onSelectMode={setMode}
          onRunQuery={(query) => {
            setText(query);
            submit(query);
          }}
          onNavigateSources={() => nav.navigate('Sources', undefined)}
          recent={recent}
          rights={rights}
          nav={appNav}
          role={broker?.role}
          ar={ar}
          onClose={() => setPopoverOpen(false)}
        />
        {voiceConfirmOrigin !== null ? (
          <View testID="voice-confirm-bar" style={[styles.modeChipRow, { alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }]}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {ar ? 'راجع الصوت قبل التنفيذ:' : 'Confirm voice query:'}
            </Text>
            <Button
              testID="voice-confirm-send"
              size="sm"
              label={ar ? 'بحث' : 'Run'}
              onPress={() => {
                usage('voice_edited', true, undefined, { edited: text.trim() !== voiceConfirmOrigin, mode });
                setVoiceConfirmOrigin(null);
                submit(text);
              }}
            />
            <Button
              testID="voice-confirm-dismiss"
              size="sm"
              variant="quiet"
              label={ar ? 'إلغاء' : 'Cancel'}
              onPress={() => {
                setVoiceConfirmOrigin(null);
              }}
            />
          </View>
        ) : null}
        {mode !== 'auto' ? (
          <View testID="mode-lock-chip" style={styles.modeChipRow}>
            <Chip
              selected
              label={`${mode === 'resale' ? (ar ? 'ريسيل' : 'Resale') : mode === 'primary' ? (ar ? 'برايمري' : 'Primary') : (ar ? 'تقارير' : 'Reports')} ×`}
              testID="mode-lock-clear"
              onPress={() => setMode('auto')}
            />
          </View>
        ) : null}
        <View testID="search-composer" style={[styles.barBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <VoiceBar
            compact
            multiline
            hideLeadingWhenTyping
            actionDecoration={<SearchCreditRings data={credits.data} loading={credits.isPending} error={credits.isError} ar={ar} />}
            leadingAccessory={
              <Pressable
                testID="search-mode-trigger"
                accessibilityRole="button"
                accessibilityLabel={ar ? 'أدوات المساعد والوضع' : 'Assistant modes and shortcuts'}
                accessibilityState={{ expanded: popoverOpen }}
                onPress={() => setPopoverOpen((v) => !v)}
                style={styles.modeButton}
              >
                <Text style={{ fontSize: 16 }}>✨</Text>
              </Pressable>
            }
            accessory={<Pressable testID="search-clear-chat" accessibilityRole="button" accessibilityLabel={ar ? 'امسح المحادثة' : 'Clear chat'}
              accessibilityState={{ disabled: clearDisabled }} disabled={clearDisabled} onPress={clearChat} style={styles.clearButton}>
              <Icon name="trash" size={20} color={clearDisabled ? colors.border : colors.muted} />
            </Pressable>}
            id="search" label={t(lang, 'mic')} value={text} onChangeText={(v) => { setText(v); if (popoverOpen && v.trim()) setPopoverOpen(false); }}
            placeholder={
              mode === 'resale' ? (ar ? 'دور في وحدات الريسيل...' : 'Search Resale inventory...')
              : mode === 'primary' ? (ar ? 'اسأل عن مشاريع المطورين...' : 'Ask about Primary projects...')
              : mode === 'reports' ? (ar ? 'اسأل عن العملاء أو الفريق أو العمولات...' : 'Ask about leads, team, commissions...')
              : (ar ? 'ابحث أو اسأل' : 'Search or ask')
            }
            onSubmit={() => submit(text)} onFile={onVoice} onError={setVoiceError} disabled={transcribing} busy={busy || transcribing} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  projectContent: { padding: spacing.lg, paddingBottom: 90, gap: spacing.md },
  answer: { borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm },
  invitation: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tools: { gap: spacing.sm },
  composerFrame: { overflow: 'hidden' },
  composerStack: { position: 'absolute', start: 22, end: 22, bottom: 12 },
  modeChipRow: { flexDirection: 'row', marginBottom: spacing.xs },
  barBox: { padding: 4, borderRadius: 26, borderWidth: 1, shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  err: { padding: spacing.lg, textAlign: 'center' },
  ask: { padding: spacing.xl, gap: spacing.md },
  askTitle: { fontSize: 18, fontWeight: '700' },
  count: { paddingHorizontal: spacing.lg, paddingVertical: 4, fontSize: 13, fontWeight: '700' },
  quick: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
  modeButton: { minWidth: 36, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  clearButton: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.lg, height: 38, justifyContent: 'center' },
  pivotFooter: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});
