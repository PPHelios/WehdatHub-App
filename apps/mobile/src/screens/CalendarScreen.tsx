import React from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ApiViewing } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

/** Viewings grouped by day, soonest first. */
export function groupByDay(items: ApiViewing[], lang: 'ar' | 'en'): { title: string; data: ApiViewing[] }[] {
  const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const out: { title: string; data: ApiViewing[] }[] = [];
  for (const v of items) {
    const title = fmt.format(new Date(v.startsAt));
    const last = out[out.length - 1];
    if (last && last.title === title) last.data.push(v);
    else out.push({ title, data: [v] });
  }
  return out;
}

export function CalendarScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const q = useQuery({ queryKey: ['viewings'], queryFn: () => api.viewings() });
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const sections = groupByDay(q.data.items, lang);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: 'numeric', minute: '2-digit' });
  return (
    <SectionList
      style={{ backgroundColor: colors.bg }}
      sections={sections}
      keyExtractor={(v) => v.id}
      refreshing={q.isRefetching}
      onRefresh={() => { q.refetch(); }}
      stickySectionHeadersEnabled={false}
      ListEmptyComponent={<EmptyView title={t(lang, 'noViewings')} />}
      renderSectionHeader={({ section }) => <Text style={[styles.day, { color: colors.muted }]}>{section.title}</Text>}
      renderItem={({ item }) => (
        <Pressable testID={`viewing-${item.id}`} accessibilityRole="button" onPress={() => nav.navigate('Lead', { ref: item.leadRef })} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Text style={[styles.time, { color: colors.primary }]}>{time(item.startsAt)}</Text>
            <Text style={[styles.flex, { color: colors.text, fontWeight: '700' }]}>{item.leadName || item.leadRef}</Text>
            <Text style={{ color: colors.muted }}>{item.status}</Text>
          </View>
          {item.unitCode || item.place ? <Text style={{ color: colors.muted }}>{[item.unitCode, item.place].filter(Boolean).join(' · ')}</Text> : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  day: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, fontWeight: '700' },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  time: { fontSize: 16, fontWeight: '800' },
  flex: { flex: 1 },
});
