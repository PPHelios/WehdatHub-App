import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SearchResult } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { UnitCard } from '../components/UnitCard';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';
import { ensureMic, startRecording, stopRecording } from '../voice';

export function SearchScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const search = useMutation<SearchResult, Error, { q: string; drop?: boolean }>({ mutationFn: ({ q, drop }) => api.search(q, { drop }) });

  const run = async (q: string, drop = false) => {
    const clean = q.trim();
    if (!clean) return;
    setVoiceError(null);
    await search.mutateAsync({ q: clean, drop }).catch(() => undefined);
  };

  const toggleMic = async () => {
    setVoiceError(null);
    try {
      if (!recording) {
        if (!(await ensureMic())) return setVoiceError(t(lang, 'micDenied'));
        await startRecording();
        return setRecording(true);
      }
      setRecording(false);
      const file = await stopRecording();
      const { q } = await api.voiceToText(file);
      setText(q);
      await run(q);
    } catch (e) {
      setRecording(false);
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
      data={data.items}
      keyExtractor={(u) => u.id}
      ListHeaderComponent={<Text style={[styles.count, { color: colors.muted }]}>{data.total} {t(lang, 'results')}{data.relaxed ? ` · ${t(lang, 'relaxedNote')}` : ''}</Text>}
      renderItem={({ item }) => <UnitCard unit={item} lang={lang} onPress={() => nav.navigate('Unit', { code: item.code })} />}
    />
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <TextInput testID="search-input" style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={text} onChangeText={setText} placeholder={t(lang, 'searchPlaceholder')} placeholderTextColor={colors.muted} returnKeyType="search" onSubmitEditing={() => run(text)} multiline={false} />
      <View style={styles.row}>
        <View style={styles.flex}><Button testID="search-go" label={t(lang, 'searchBtn')} loading={search.isPending} onPress={() => run(text)} /></View>
        <View style={styles.flex}><Button testID="search-mic" label={recording ? t(lang, 'micStop') : t(lang, 'mic')} variant="secondary" onPress={toggleMic} /></View>
      </View>
      {voiceError ? <Text testID="voice-error" style={[styles.err, { color: colors.danger }]}>{voiceError}</Text> : null}
      <View style={styles.flex}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  input: { margin: spacing.lg, minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16 },
  row: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  err: { padding: spacing.lg, textAlign: 'center' },
  ask: { padding: spacing.xl, gap: spacing.md },
  askTitle: { fontSize: 18, fontWeight: '700' },
  count: { padding: spacing.lg },
});
