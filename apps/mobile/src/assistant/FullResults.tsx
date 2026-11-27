import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated from 'react-native-reanimated';
import type { ApiUnitListItem, Lang, SearchResult, UnitStatus } from '@wehdathub/shared';
import { AppText as Text } from '../components/AppText';
import { SaveSearchButton } from '../components/SaveSearchButton';
import { UnitCard } from '../components/UnitCard';
import { ErrorView, Loading } from '../components/StateViews';
import { useSelectionHighlight } from '../components/SelectionHighlight';
import { t } from '../i18n';
import { greenGradient, spacing, useTheme } from '../theme';
import type { FullList } from './useAssistantThread';

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList<ApiUnitListItem>);

/** What the server understood and could not apply, shown above a unit result. */
export function UnitNotes({ data, lang }: { data: SearchResult; lang: Lang }) {
  const { colors } = useTheme();
  return (
    <View>
      {data.reading ? <Text testID="reading-line" variant="bodySm" weight="bold" style={[styles.note, { color: colors.text }]}>{data.reading}</Text> : null}
      <Text variant="bodySm" weight="bold" style={[styles.note, { color: colors.muted }]}>{data.total} {t(lang, 'results')}{data.relaxed ? ` · ${t(lang, 'relaxedNote')}` : ''}</Text>
      {data.guesses?.length ? <Text testID="guess-note" variant="bodySm" weight="bold" style={[styles.note, { color: colors.accentInk }]}>{data.guesses.map((g) => t(lang, 'guessNote').replace('{typed}', g.typed).replace('{as}', g.as)).join(' ')}</Text> : null}
      {data.unapplied?.length ? <Text testID="unapplied-note" variant="bodySm" weight="bold" style={[styles.note, { color: colors.accentInk }]}>{t(lang, 'unappliedNote')} {data.unapplied.join(' · ')}</Text> : null}
      {data.ignoredTerms?.length ? <Text testID="ignored-note" variant="bodySm" weight="bold" style={[styles.note, { color: colors.accentInk }]}>{t(lang, 'ignoredNote')} {data.ignoredTerms.join(' · ')}</Text> : null}
    </View>
  );
}

/** The whole result list for one search: Active / Sold / Archived with counts, paged on scroll. */
export function FullResults({ full, lang, onStatus, onRetry, onMore, onOpen, onScroll }: {
  full: FullList;
  lang: Lang;
  onStatus: (status: UnitStatus) => void;
  onRetry: () => void;
  onMore: () => void;
  onOpen: (code: string) => void;
  onScroll?: React.ComponentProps<typeof AnimatedFlashList>['onScroll'];
}) {
  const { colors } = useTheme();
  const selection = useSelectionHighlight(full.params.status, greenGradient);
  const data = full.data;
  const counts = data?.counts;
  return (
    <View style={styles.flex}>
      {counts ? (
        <View style={styles.chips}>
          {selection.highlight}
          {(['active', 'sold', 'archived'] as const).map((st) => (
            <Pressable key={st} onLayout={selection.measure(st)} accessibilityRole="button" accessibilityState={{ selected: st === full.params.status }} disabled={full.pending || full.loadingMore}
              onPress={() => onStatus(st)}
              style={[styles.chip, { borderColor: st === full.params.status ? colors.primary : colors.border }, st === full.params.status && !selection.highlight && greenGradient]}>
              <Text weight="bold" style={{ color: st === full.params.status ? colors.onPrimary : colors.text }}>{t(lang, st)} ({counts[st] ?? 0})</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {full.pending || !data ? (full.error ? <ErrorView message={full.error} retryLabel={t(lang, 'retry')} onRetry={onRetry} /> : <Loading label={t(lang, 'loading')} />) : (
        <AnimatedFlashList
          testID="search-results-list"
          data={[...data.items, ...full.extra]}
          keyExtractor={(u) => u.id}
          ListHeaderComponent={<View>{data.f && data.total > 0 ? <SaveSearchButton f={data.f} /> : null}<UnitNotes data={data} lang={lang} /></View>}
          renderItem={({ item }) => <UnitCard unit={item} lang={lang} onPress={() => onOpen(item.code)} />}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.list}
          onEndReached={() => { if (data.items.length + full.extra.length < data.total) onMore(); }}
          onEndReachedThreshold={0.6}
          ListFooterComponent={full.loadingMore ? <ActivityIndicator style={styles.note} color={colors.spinner} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: 90 },
  note: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.lg, height: 38, justifyContent: 'center' },
});
