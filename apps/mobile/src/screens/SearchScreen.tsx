import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usage } from '../usage';
import { track } from '../analytics';
import { BackHandler, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import Animated, { FadeIn, FadeOut, ReduceMotion, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AssistantMode, LeadQueue } from '@wehdathub/shared';
import { SearchCreditRings, useSearchCredits } from '../components/SearchCreditRings';
import { currentLang, useAuth } from '../auth';
import { Chip } from '../components/Chip';
import { ComposerPopover } from '../components/ComposerPopover';
import { Icon } from '../components/Icon';
import { useKeyboardVisible } from '../components/KeyboardLift';
import { readLeadCommand } from '../components/SearchLeadAction';
import { useRightsState } from '../rights';
import type { SearchIntent } from '../searchCapabilities';
import { SearchPractice } from '../components/SearchPractice';
import { SearchHome } from '../components/SearchHome';
import { HomeRow } from '../components/HomeRow';
import { Button } from '../components/Button';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { Split, useWide } from '../layout';
import { spacing, useTheme } from '../theme';
import { VoiceBar } from '../components/VoiceBar';
import { CoachMark } from '../components/CoachMark';
import { FullResults } from '../assistant/FullResults';
import { ReportView, type LeadFilters, type ReportKind } from '../assistant/ReportView';
import { ThreadView } from '../assistant/ThreadView';
import type { TurnSource } from '../assistant/thread';
import { useAssistantThread } from '../assistant/useAssistantThread';

export { shouldUseAssistantEndpoint } from '../assistant/routing';

const RECENT_KEY = 'wehdathub.recentSearches';

export function SearchScreen({ initialMode, modeStamp }: { initialMode?: AssistantMode; modeStamp?: number } = {}) {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const ar = lang === 'ar';
  const broker = useAuth((state) => state.broker);
  const recentKey = broker?.id ? `${RECENT_KEY}:${broker.id}` : null;
  const previousIdentity = useRef(recentKey);
  const practiceKey = broker?.id ? `search-practice-v1:${broker.id}:${broker.role}` : null;
  const [invitation, setInvitation] = useState<string | null>(null);
  const [practicing, setPracticing] = useState(false);
  const micRef = useRef<React.ComponentRef<typeof View>>(null);
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

  const [mode, setMode] = useState<AssistantMode>(initialMode ?? 'auto');
  // A link such as the old Ask screen's opens this tab already in that mode.
  useEffect(() => { if (initialMode) setMode(initialMode); }, [initialMode, modeStamp]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const credits = useSearchCredits();
  const [submitted, setSubmitted] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [report, setReport] = useState<ReportKind | null>(null);
  const { rights, nav: appNav } = useRightsState();
  const [leadFilters, setLeadFilters] = useState<LeadFilters>({});
  const [assignee, setAssignee] = useState<string>();
  const [dealLastMonth, setDealLastMonth] = useState(false);
  const [clarification, setClarification] = useState('');
  const [text, setText] = useState('');
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

  const clearedRecents = useRef(false);
  const [recent, setRecent] = useState<string[]>([]);
  const rememberRecent = (clean: string) => {
    setRecent((prev) => {
      const next = [clean, ...prev.filter((x) => x !== clean)].slice(0, 3);
      if (recentKey) AsyncStorage.setItem(recentKey, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  };

  /** Requests that are a report screen, not a chat answer. */
  const showIntent = (intent: SearchIntent) => {
    const clarify = (message: string) => { setClarification(message); setReport('clarify'); };
    const denied = () => clarify(t(lang, 'roleDenied'));
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
    return clarify(t(lang, 'clarifySearch'));
  };
  const thread = useAssistantThread({ brokerId: broker?.id, lang, onIntent: showIntent, onRemember: rememberRecent });
  const { turns, full, busy, transcribing } = thread;
  const wide = useWide();
  const [selectedUnit, setSelectedUnit] = useState<string>();

  const submit = (q: string, source: TurnSource = 'text', fromClarification = false) => {
    const clean = q.trim();
    if (!clean) return;
    setPopoverOpen(false);
    Keyboard.dismiss();
    setSubmitted(clean);
    hidden.value = false;
    slide.value = 0;
    if (!fromClarification && rights.leads && readLeadCommand(clean)) {
      setReport('lead-action');
      return;
    }
    setReport(null);
    thread.send(clean, { source, mode, forceSearch: fromClarification, ...(report === 'leads' || report === 'deals' ? { report } : {}) });
  };
  const sendFrom = (q: string, source: TurnSource, m?: AssistantMode) => {
    setText('');
    setSubmitted(q);
    setReport(null);
    thread.send(q, { source, mode: m ?? mode });
  };
  const onVoice = async (file: Parameters<typeof thread.transcribe>[0]) => {
    const heard = await thread.transcribe(file, mode);
    if (!heard) return;
    setText(heard.text);
    if (heard.confirm) { setVoiceConfirmOrigin(heard.text); return; }
    setVoiceConfirmOrigin(null);
    submit(heard.text, 'voice');
  };

  const resetToHome = useCallback(() => {
    Keyboard.dismiss();
    setPracticing(false);
    setText('');
    setSubmitted('');
    setReport(null);
    setToolsOpen(false);
    setPopoverOpen(false);
    setMode('auto');
    setLeadFilters({});
    setAssignee(undefined);
    setDealLastMonth(false);
    setClarification('');
    hidden.value = false;
    lastY.value = 0;
    slide.value = 0;
    setVoiceConfirmOrigin(null);
    thread.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset is stable
  }, [hidden, lastY, slide, thread.reset]);
  const clearChat = () => {
    resetToHome();
    clearedRecents.current = true;
    setRecent([]);
    if (recentKey) AsyncStorage.removeItem(recentKey).catch(() => undefined);
  };
  useEffect(() => {
    let active = true;
    clearedRecents.current = false;
    setRecent([]);
    if (previousIdentity.current !== recentKey) {
      previousIdentity.current = recentKey;
      resetToHome();
    }
    AsyncStorage.removeItem(RECENT_KEY).catch(() => undefined);
    if (recentKey) AsyncStorage.getItem(recentKey).then((raw) => {
      const values = raw ? JSON.parse(raw) : [];
      if (active && !clearedRecents.current && Array.isArray(values)) setRecent(values.filter((value) => typeof value === 'string').slice(0, 3));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [recentKey, resetToHome]);

  const clearDisabled = busy || transcribing || !(submitted || text || report || recent.length || turns.length);
  const atHome = !report && !turns.length && !full;
  const focused = useIsFocused();
  useEffect(() => {
    const addListener = (nav as unknown as { addListener?: (event: string, cb: () => void) => () => void }).addListener;
    if (typeof addListener !== 'function') return undefined;
    return addListener('tabPress', resetToHome);
  }, [nav, resetToHome]);
  useEffect(() => {
    if (!focused || (!practicing && atHome)) return undefined;
    const sub = BackHandler?.addEventListener?.('hardwareBackPress', () => {
      if (practicing) { Keyboard.dismiss(); setPracticing(false); return true; }
      if (full) { thread.closeFull(); return true; }
      if (!atHome) { resetToHome(); return true; }
      return false;
    });
    return () => sub?.remove();
  }, [atHome, focused, full, practicing, resetToHome, thread]);
  const showInvitation = Boolean(invitation && invitation === practiceKey);
  const openHomeReport = (value: ReportKind, queue?: LeadQueue) => {
    setReport(value);
    setSubmitted('');
    setLeadFilters(queue ? { queue } : {});
    setAssignee(undefined);
    setDealLastMonth(false);
  };

  if (practicing) return <SearchPractice onClose={() => { Keyboard.dismiss(); setPracticing(false); }} />;

  const home = (
    <SearchHome openQueue={(queue) => openHomeReport('leads', queue)} onTryPrompt={(prompt) => { setText(prompt); submit(prompt); }}
      invitation={showInvitation ? <View style={styles.invitation}>
        <Button label={t(lang, 'tryPractice')} onPress={startPractice} variant="secondary" size="sm" testID="practice-start" />
        <Button label={t(lang, 'skipPractice')} onPress={dismissInvitation} variant="quiet" size="sm" testID="practice-skip" />
      </View> : null}>
      <HomeRow testID="search-tools" title={t(lang, 'searchShortcuts')} icon="search" expanded={toolsOpen} onPress={() => setToolsOpen((value) => !value)} />
      {toolsOpen ? <Animated.View entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(100).reduceMotion(ReduceMotion.System)} style={styles.tools}>
        {!showInvitation ? <HomeRow title={t(lang, 'tryPractice')} onPress={startPractice} icon="help" testID="practice-replay" /> : null}
        <Text variant="bodySm" style={{ color: colors.muted }}>{t(lang, recent.length ? 'searchRecent' : 'searchTry')}</Text>
        {(recent.length ? recent : (['searchExample1', 'searchExample2', 'searchExample3'] as const).map((k) => t(lang, k))).map((q, i) => (
          <HomeRow key={q} title={q} testID={recent.length ? `searchRecent${i + 1}` : `searchExample${i + 1}`} onPress={() => { setText(q); submit(q); }} />
        ))}
        {([{ value: 'deals', label: t(lang, 'closedDeals') },
          ...(rights.leads ? [{ value: 'leads', label: t(lang, 'leadsTab') }] : []),
          ...(rights.manager ? [{ value: 'dashboard', label: t(lang, 'dashboard') }, { value: 'ranking', label: t(lang, 'brokerRanking') }] : []),
        ] as { value: ReportKind; label: string }[]).map(({ value, label }) => (
          <HomeRow key={value} title={label} onPress={() => openHomeReport(value)} />
        ))}
      </Animated.View> : null}
    </SearchHome>
  );

  const voiceErr = thread.voiceError ? <Text testID="voice-error" style={[styles.err, { color: colors.danger }]}>{thread.voiceError}</Text> : null;
  const threadEl = (
    <ThreadView turns={turns} lang={lang} mode={mode} onScroll={onScroll} onSend={sendFrom} onRetry={(id) => thread.retry(id)} onSearchAnyway={(id) => thread.retry(id, { drop: true })}
      onSeeAll={thread.openFull} onNewConversation={resetToHome} onChangeMode={setMode} onOpenQueue={(queue) => openHomeReport('leads', queue)}
      onChangeSearch={(q) => setText(q)} />
  );
  const mainEl = (
      <Animated.View key={atHome ? 'brief' : 'results'} entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)} style={styles.flex}>
        {report ? (
          <ReportView report={report} lang={lang} submitted={submitted} clarification={clarification} canSeeLeads={rights.leads} leadFilters={leadFilters} assignee={assignee} dealLastMonth={dealLastMonth}
            onShowLeads={() => { setLeadFilters({}); setAssignee(undefined); setReport('leads'); }}
            onSearchInstead={() => submit(submitted, 'text', true)}
            onCloseAction={() => { setReport('leads'); setSubmitted(''); setText(''); }} />
        ) : full ? (
          <FullResults full={full} lang={lang} onStatus={thread.setFullStatus} onRetry={thread.rerunFull} onMore={() => thread.loadMore()} onScroll={onScroll}
            selectedCode={wide ? selectedUnit : undefined}
            onOpen={(code) => { track('search_unit_opened'); setSelectedUnit(code); nav.navigate('Unit', { code }); }} />
        ) : turns.length && !wide ? threadEl : home}
      </Animated.View>
  );
  const composer = (
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
            <Text variant="caption" style={{ color: colors.muted }}>
              {ar ? 'راجع الصوت قبل التنفيذ:' : 'Confirm voice query:'}
            </Text>
            <Button
              testID="voice-confirm-send"
              size="sm"
              label={ar ? 'بحث' : 'Run'}
              onPress={() => {
                usage('voice_edited', true, undefined, { edited: text.trim() !== voiceConfirmOrigin, mode });
                setVoiceConfirmOrigin(null);
                submit(text, 'voice');
              }}
            />
            <Button testID="voice-confirm-dismiss" size="sm" variant="quiet" label={ar ? 'إلغاء' : 'Cancel'} onPress={() => setVoiceConfirmOrigin(null)} />
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
            micRef={micRef}
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
                <Text variant="body">✨</Text>
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
            onSubmit={() => { submit(text, voiceConfirmOrigin !== null ? 'voice' : 'text'); }} onFile={onVoice} onError={thread.setVoiceError} disabled={transcribing} busy={busy || transcribing} />
        </View>
        <CoachMark id="mic" targetRef={micRef} text={t(lang, 'coachMic')} />
      </Animated.View>
  );
  if (wide) {
    // Tablets: the chat (thread or suggestions, and the composer) is a panel on the end side; Home or the full results fill the rest.
    const results = Boolean(report || full);
    const chips = (['searchExample1', 'searchExample2', 'searchExample3'] as const).map((k) => t(lang, k));
    const panel = (
      <View testID="chat-panel" style={[styles.panel, !results && styles.panelFixed, { backgroundColor: colors.bg, borderStartColor: colors.border }]}>
        {voiceErr}
        {turns.length ? threadEl : (
          <View testID="chat-empty" style={styles.chatEmpty}>
            {chips.map((q, i) => <Chip key={q} testID={`chat-chip-${i + 1}`} label={q} onPress={() => { setText(q); submit(q); }} />)}
          </View>
        )}
        {composer}
      </View>
    );
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        {results ? <Split list={panel} detail={mainEl} /> : <View style={styles.wideRow}><View style={styles.flex}>{mainEl}</View>{panel}</View>}
      </View>
    );
  }
  return (
    <View style={[styles.flex, styles.composerFrame, { backgroundColor: colors.bg }]}>
      {voiceErr}
      {mainEl}
      {composer}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wideRow: { flex: 1, flexDirection: 'row' },
  panel: { flex: 1, overflow: 'hidden', borderStartWidth: StyleSheet.hairlineWidth },
  panelFixed: { flex: 0, width: 380 },
  chatEmpty: { flex: 1, justifyContent: 'center', alignItems: 'flex-start', padding: spacing.lg, gap: spacing.sm },
  invitation: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tools: { gap: spacing.sm },
  composerFrame: { overflow: 'hidden' },
  composerStack: { position: 'absolute', start: 22, end: 22, bottom: 12 },
  modeChipRow: { flexDirection: 'row', marginBottom: spacing.xs },
  barBox: { padding: 4, borderRadius: 26, borderWidth: 1, shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  err: { padding: spacing.lg, textAlign: 'center' },
  modeButton: { minWidth: 36, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  clearButton: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
});
