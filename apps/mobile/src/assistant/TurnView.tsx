import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { AssistantSuggestion, Lang, UnitStatus } from '@wehdathub/shared';
import { AskResults } from '../components/AskResults';
import { AssistantActions, AssistantCards } from '../components/AssistantCards';
import { AppText as Text } from '../components/AppText';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { SaveSearchButton } from '../components/SaveSearchButton';
import { SkeletonCard } from '../components/Skeleton';
import { UnitHeroCard, HERO_CARD_WIDTH } from '../components/UnitHeroCard';
import { matchReasons, type MatchFilters } from '../matchReasons';
import { track } from '../analytics';
import { enter } from '../motion';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';
import { UnitNotes } from './FullResults';
import { leadLine, SHOWN_UNITS } from './phrasing';
import { useUnitShare } from './useUnitShare';
import type { Turn, TurnSource } from './thread';

type CardProps = Omit<React.ComponentProps<typeof AssistantCards>, 'response' | 'query' | 'ar' | 'embedded' | 'leadLine'>;

export interface TurnHandlers {
  cards: CardProps;
  onSend: (q: string, source: TurnSource) => void;
  onRetry: (id: string) => void;
  /** Search the same words again, e.g. without the ones the server did not know. */
  onSearchAnyway: (id: string) => void;
  onSeeAll: (turn: Turn, status?: UnitStatus) => void;
  onOpenUnit: (code: string) => void;
  onOpenProject: (id: string, name: string) => void;
  onUseFilters: () => void;
}

const TOO_MANY = 30;
const NARROWING = ['narrowReady', 'narrowCompound', 'narrowCheapest'] as const;

function Dot({ delay, reduced }: { delay: number; reduced: boolean }) {
  const { colors } = useTheme();
  const o = useSharedValue(reduced ? 0.6 : 0.3);
  useEffect(() => {
    if (reduced) return;
    o.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }), withTiming(0.3, { duration: 400, easing: Easing.inOut(Easing.ease) })), -1));
  }, [delay, o, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: colors.muted }, style]} />;
}

/** Three dots that pulse in turn; still when the phone asks for reduced motion. */
export function ThinkingBubble({ lang }: { lang: Lang }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  return (
    <View testID="thinking-bubble" accessibilityRole="progressbar" accessibilityLabel={t(lang, 'assistantThinking')} style={[styles.thinking, { backgroundColor: colors.cardSubtle }]}>
      {[0, 160, 320].map((d) => <Dot key={d} delay={d} reduced={reduced} />)}
    </View>
  );
}

/** Renders nothing; counts one clarify prompt shown. */
function ClarifyShown({ kind }: { kind: string }) {
  useEffect(() => { void track('clarify_shown', { kind }); }, [kind]);
  return null;
}

function UnitResults({ turn, lang, h }: { turn: Turn; lang: Lang; h: TurnHandlers }) {
  const { colors } = useTheme();
  const share = useUnitShare();
  const r = turn.response!;
  const units = r.units!;
  const hasSuggestions = Boolean(r.suggestions?.length);
  const counts = r.statusCounts ?? units.counts;
  const extra = counts ? (counts.sold ?? 0) + (counts.archived ?? 0) : 0;
  // shortcut: only area and budget come back structured (nextContext); bedrooms, type and finishing need the server to return the parsed filters.
  const filters: MatchFilters = { areaQuery: r.nextContext?.areaQuery, maxPrice: r.nextContext?.maxPrice };
  const top = units.items.slice(0, SHOWN_UNITS);
  if (units.status === 'ask') {
    return (
      <View style={styles.block}>
        <ClarifyShown kind="ask" />
        <Text variant="heading" style={{ color: colors.text }}>{t(lang, 'askTitle')}</Text>
        <Text weight="bold" style={{ color: colors.accentInk }}>{[...(units.ask?.terms ?? []), ...(units.ask?.numbers ?? []).map(String)].join(' · ')}</Text>
        <Button label={t(lang, 'askSearchAnyway')} onPress={() => h.onSearchAnyway(turn.id)} />
        <Button label={t(lang, 'askEdit')} variant="secondary" onPress={() => h.cards.onChangeSearch?.(turn.question)} />
      </View>
    );
  }
  if (units.status === 'small_talk' || units.status === 'other') return <Text style={{ color: colors.muted }}>{t(lang, 'searchHint')}</Text>;
  if (units.status === 'listing') return <Text style={{ color: colors.muted }}>{t(lang, 'listingHint')}</Text>;
  return (
    <View style={styles.block}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.carousel}>
        {top.map((u) => (
          <View key={u.id} style={{ width: HERO_CARD_WIDTH }}>
            <UnitHeroCard unit={u} lang={lang} reasons={matchReasons(u, filters, lang)} onPress={h.onOpenUnit} onShare={share.open} />
          </View>
        ))}
      </ScrollView>
      {share.modal}
      <UnitNotes data={units} lang={lang} />
      {units.f && units.total > 0 ? <SaveSearchButton f={units.f} /> : null}
      <Button testID="see-all" variant="secondary" label={t(lang, 'seeAllN').replace('{n}', String(units.total))} onPress={() => h.onSeeAll(turn)} />
      {extra > 0 ? (
        <Pressable testID="more-statuses" accessibilityRole="button" onPress={() => h.onSeeAll(turn, (counts?.sold ?? 0) > 0 ? 'sold' : 'archived')}>
          <Text variant="bodySm" style={{ color: colors.muted }}>{t(lang, 'moreStatuses').replace('{sold}', String(counts?.sold ?? 0)).replace('{archived}', String(counts?.archived ?? 0))}</Text>
        </Pressable>
      ) : null}
      {units.total > TOO_MANY && !hasSuggestions ? (
        <View testID="narrowing-chips" style={styles.chips}>
          {NARROWING.map((k) => <Chip key={k} label={t(lang, k)} onPress={() => h.onSend(`${turn.question} ${t(lang, k)}`, 'chip')} />)}
        </View>
      ) : null}
      <AssistantActions serverOnly response={r} query={turn.question} ar={lang === 'ar'} onViewAllMarkets={h.cards.onViewAllMarkets} onPivotPrimary={h.cards.onPivotPrimary} onChangeSearch={h.cards.onChangeSearch} />
    </View>
  );
}

function Suggestions({ items, onSend, intent }: { items: AssistantSuggestion[]; onSend: TurnHandlers['onSend']; intent: string }) {
  return (
    <View testID="suggestions" style={styles.chips}>
      {items.map((s, i) => <Chip key={`${s.q}-${i}`} label={s.label} onPress={() => { void track('suggestion_tapped', { intent }); onSend(s.q, 'chip'); }} />)}
    </View>
  );
}

function Answer({ turn, lang, h }: { turn: Turn; lang: Lang; h: TurnHandlers }) {
  const { colors } = useTheme();
  const r = turn.response!;
  const line = leadLine(turn.id, lang, r);
  const unitView = r.intent === 'unit_search' && r.units && r.units.status !== 'none';
  const quickReader = r.units?.source === 'fallback' && /QUOTA|AI_OFF/.test(r.units.aiError ?? '');
  const primary = r.intent === 'primary_answer';
  const projects = r.projects && r.projects.total_projects > 0 ? r.projects : undefined;
  return (
    <View style={styles.answer}>
      {quickReader ? (
        <View testID="quick-reader-note" style={styles.block}>
          <Text variant="bodySm" style={{ color: colors.muted }}>⚡ {t(lang, 'quickReaderNote')}</Text>
          <Pressable testID="quick-reader-units" accessibilityRole="button" onPress={h.onUseFilters}><Text weight="bold" style={{ color: colors.primaryInk }}>{t(lang, 'useUnitFilters')}</Text></Pressable>
        </View>
      ) : null}
      {unitView ? (
        <>
          <Text testID="assistant-headline" accessibilityRole="header" variant="heading" style={{ color: colors.text }}>{line}</Text>
          <UnitResults turn={turn} lang={lang} h={h} />
        </>
      ) : (
        <AssistantCards
          {...h.cards}
          embedded
          leadLine={line}
          response={r.intent === 'unit_search' ? { ...r, units: undefined } : r}
          query={turn.question}
          ar={lang === 'ar'}
          extraFooter={primary || projects ? <AskResults showStatus hideAnswerLine={Boolean(projects)} q={turn.question} initial={projects} onOpenProject={(id, name) => h.onOpenProject(id, name)} /> : undefined}
        />
      )}
      {r.suggestions?.length ? <Suggestions items={r.suggestions} onSend={h.onSend} intent={r.intent} /> : null}
    </View>
  );
}

/** One question and its answer: the broker's bubble, then thinking, an error with Retry, or the answer. */
export function TurnView({ turn, lang, index, handlers }: { turn: Turn; lang: Lang; index: number; handlers: TurnHandlers }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={enter(Math.min(index, 3))} style={styles.turn}>
      <View testID={`turn-question-${turn.source}`} style={[styles.bubble, { backgroundColor: colors.primary }]}>
        {turn.source === 'voice' ? <View accessibilityLabel={t(lang, 'voiceQuestion')}><Icon name="mic" size={16} color={colors.onPrimary} /></View> : null}
        <Text style={[styles.bubbleText, { color: colors.onPrimary }]}>{turn.question}</Text>
      </View>
      {turn.status === 'pending' ? (
        <View style={styles.answer}><ThinkingBubble lang={lang} /><SkeletonCard /></View>
      ) : turn.status === 'error' ? (
        <View testID="turn-error" style={[styles.error, { backgroundColor: colors.cardSubtle }]}>
          <Text style={{ color: colors.text }}>{t(lang, 'turnError')}</Text>
          {turn.error ? <Text variant="bodySm" style={{ color: colors.muted }}>{turn.error}</Text> : null}
          <Button testID="turn-retry" size="sm" label={t(lang, 'retry')} onPress={() => handlers.onRetry(turn.id)} />
        </View>
      ) : turn.response ? <Answer turn={turn} lang={lang} h={handlers} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  turn: { gap: spacing.md },
  bubble: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: '85%', borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  bubbleText: { flexShrink: 1 },
  answer: { gap: spacing.md },
  block: { gap: spacing.md },
  carousel: { gap: spacing.md, paddingEnd: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thinking: { alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.xs, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
  error: { gap: spacing.sm, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'flex-start' },
});
