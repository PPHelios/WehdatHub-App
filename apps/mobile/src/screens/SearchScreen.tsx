import React, { useRef, useState } from 'react';
import { timed } from '../usage';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ApiUnitListItem, SearchResult, UnitStatus, VoiceFile } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { SaveSearchButton } from '../components/SaveSearchButton';
import { UnitCard } from '../components/UnitCard';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';
import { HoldMic } from '../components/HoldMic';

export function SearchScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [text, setText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // The search box and mic float at the bottom like a chat app: they slide away on scrolling down and come back on scrolling up.
  const slide = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  const hidden = useRef(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = Math.max(0, e.nativeEvent.contentOffset.y);
    const dy = y - lastY.current;
    lastY.current = y;
    const hide = dy > 6 && y > 60 ? true : dy < -6 || y <= 60 ? false : hidden.current;
    if (hide !== hidden.current) {
      hidden.current = hide;
      Animated.timing(slide, { toValue: hide ? 1 : 0, duration: 180, useNativeDriver: true }).start();
    }
  };
  const search = useMutation<SearchResult, Error, { q: string; drop?: boolean; status?: UnitStatus }>({ mutationFn: ({ q, drop, status }) => timed('search', () => api.search(q, { drop, status })) });
  // Active units first; Sold and Archived are one tap away, with their counts from the start. More results load on demand.
  const [last, setLast] = useState<{ q: string; drop: boolean; status: UnitStatus } | null>(null);
  const [extra, setExtra] = useState<ApiUnitListItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);

  const run = async (q: string, drop = false, status: UnitStatus = 'active') => {
    const clean = q.trim();
    if (!clean) return;
    setVoiceError(null);
    setExtra([]);
    setDone(false);
    setLast({ q: clean, drop, status });
    await search.mutateAsync({ q: clean, drop, status }).catch(() => undefined);
  };
  const loadMore = async () => {
    if (!last || !search.data || loadingMore || done) return;
    setLoadingMore(true);
    try {
      const r = await api.search(last.q, { drop: last.drop, status: last.status, offset: search.data.items.length + extra.length });
      if (!r.items.length) setDone(true);
      setExtra((e) => [...e, ...r.items]);
    } catch (e) {
      setDone(true);
      setVoiceError(errorText(e, lang));
    } finally {
      setLoadingMore(false);
    }
  };

  const onVoice = async (file: VoiceFile) => {
    setVoiceError(null);
    try {
      const { q } = await api.voiceToText(file);
      setText(q);
      await run(q);
    } catch (e) {
      setVoiceError(errorText(e, lang));
    }
  };

  const data = search.data;
  const body = search.isPending ? (
    <Loading label={t(lang, 'loading')} />
  ) : search.isError ? (
    <ErrorView message={errorText(search.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => run(text)} />
  ) : !data ? (
    <EmptyView title={t(lang, 'searchTab')} hint={t(lang, 'searchHint')} />
  ) : data.status === 'ask' ? (
    <View style={styles.ask}>
      <Text style={[styles.askTitle, { color: colors.text }]}>{t(lang, 'askTitle')}</Text>
      <Text style={{ color: colors.accent, fontWeight: '700' }}>{[...(data.ask?.terms ?? []), ...(data.ask?.numbers ?? []).map(String)].join(' · ')}</Text>
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
    <FlashList
      data={[...data.items, ...extra]}
      keyExtractor={(u) => u.id}
      ListHeaderComponent={
        <View>
          {data.f && data.total > 0 ? <SaveSearchButton f={data.f} /> : null}
          {data.reading ? <Text testID="reading-line" style={[styles.count, { color: colors.text }]}>{data.reading}</Text> : null}
          <Text style={[styles.count, { color: colors.muted }]}>{data.total} {t(lang, 'results')}{data.relaxed ? ` · ${t(lang, 'relaxedNote')}` : ''}</Text>
          {data.ignoredTerms?.length ? <Text testID="ignored-note" style={[styles.count, { color: colors.accent }]}>{t(lang, 'ignoredNote')} {data.ignoredTerms.join(' · ')}</Text> : null}
        </View>
      }
      renderItem={({ item }) => <UnitCard unit={item} lang={lang} onPress={() => nav.navigate('Unit', { code: item.code })} />}
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingBottom: 150 }}
      onEndReached={() => { if (data.items.length + extra.length < data.total) loadMore(); }}
      onEndReachedThreshold={0.6}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.count} color={colors.primary} /> : null}
    />
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      {voiceError ? <Text testID="voice-error" style={[styles.err, { color: colors.danger }]}>{voiceError}</Text> : null}
      {data?.counts && last ? (
        <View style={styles.chips}>
          {(['active', 'sold', 'archived'] as const).map((st) => (
            <Pressable key={st} accessibilityRole="button" accessibilityState={{ selected: st === last.status }} onPress={() => run(last.q, last.drop, st)} style={[styles.chip, { borderColor: st === last.status ? colors.primary : colors.border }, st === last.status && { backgroundColor: colors.primary }]}>
              <Text style={{ color: st === last.status ? colors.onPrimary : colors.text, fontWeight: '600' }}>{t(lang, st)} ({data.counts?.[st] ?? 0})</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.flex}>{body}</View>
      <Animated.View style={[styles.bar, { backgroundColor: colors.bg, borderColor: colors.border, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 220] }) }] }]}>
      <TextInput testID="search-input" style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={text} onChangeText={setText} placeholder={t(lang, 'searchPlaceholder')} placeholderTextColor={colors.muted} returnKeyType="search" onSubmitEditing={() => run(text)} multiline={false} />
      <View style={styles.row}>
        <View style={styles.flex}><Button testID="search-go" label={t(lang, 'searchBtn')} loading={search.isPending} onPress={() => run(text)} /></View>
        <View style={styles.flex}><HoldMic testID="search-mic" label={t(lang, 'mic')} onFile={onVoice} onError={setVoiceError} /></View>
      </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { position: 'absolute', start: 0, end: 0, bottom: 0, padding: spacing.md, gap: spacing.sm, borderTopWidth: 1 },
  input: { margin: 0, minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16 },
  row: { flexDirection: 'row', gap: spacing.sm },
  err: { padding: spacing.lg, textAlign: 'center' },
  ask: { padding: spacing.xl, gap: spacing.md },
  askTitle: { fontSize: 18, fontWeight: '700' },
  count: { padding: spacing.lg },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.lg, height: 40, justifyContent: 'center' },
});
