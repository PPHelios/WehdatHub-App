import React from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ApiViewing } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { useRights } from '../rights';
import { openAssistant } from '../searchLink';
import { VIEWING_STATUS, labelOf } from '../unitOptions';
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
  const { colors, elev } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const rights = useRights();
  const tomorrow = useRoute<RouteProp<RootStackParams, 'Calendar'>>().params?.tomorrow;
  const q = useQuery({ queryKey: ['viewings', Boolean(tomorrow)], queryFn: () => tomorrow ? api.viewings({ tomorrow: true }) : api.viewings() });
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
      ListHeaderComponent={tomorrow ? <Text style={[styles.day, { color: colors.text }]}>{lang === 'ar' ? 'معاينات بكرة' : 'Tomorrow’s viewings'}</Text> : undefined}
      ListEmptyComponent={<EmptyView title={t(lang, 'noViewings')} icon="calendar" actionLabel={t(lang, rights.leads ? 'leadsTab' : 'askAssistant')} onAction={() => (rights.leads ? nav.navigate('LeadsList') : openAssistant(nav))} />}
      renderSectionHeader={({ section }) => <Text style={[styles.day, { color: colors.muted }]}>{section.title}</Text>}
      renderItem={({ item }) => (
        <Pressable testID={`viewing-${item.id}`} accessibilityRole="button" onPress={() => nav.navigate('Lead', { ref: item.leadRef })} style={[styles.card, elev('md'), { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Text style={[styles.time, { color: colors.primaryInk }]}>{time(item.startsAt)}</Text>
            <Text style={[styles.flex, { color: colors.text, fontWeight: '700' }]}>{item.leadName || item.leadRef}</Text>
            <Text style={{ color: colors.muted }}>{labelOf(VIEWING_STATUS, item.status, lang)}</Text>
          </View>
          {item.unitCode || item.place ? <Text style={{ color: colors.muted }}>{[item.unitCode, item.place].filter(Boolean).join(' · ')}</Text> : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  day: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, fontWeight: '700' },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  time: { fontSize: 16, fontWeight: '800' },
  flex: { flex: 1 },
});
