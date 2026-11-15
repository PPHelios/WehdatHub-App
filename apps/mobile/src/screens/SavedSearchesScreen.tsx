import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { UnitCard } from '../components/UnitCard';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

/** The broker's saved searches: how many units fit and how many are new; tap to see them; delete. */
export function SavedSearchesScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [open, setOpen] = useState<string | null>(null);
  const list = useQuery({ queryKey: ['saved-searches'], queryFn: () => api.savedSearches() });
  const one = useQuery({ queryKey: ['saved-search', open], queryFn: () => api.savedSearch(open as string), enabled: Boolean(open) });
  if (list.isPending) return <Loading label={t(lang, 'loading')} />;
  if (list.isError || !list.data) return <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} />;
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={async () => { await list.refetch(); }} />}>
      {list.data.items.length === 0 ? <EmptyView title={t(lang, 'savedSearchesEmpty')} hint="" /> : null}
      {list.data.items.map((s) => (
        <View key={s.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable testID={`saved-${s.id}`} accessibilityRole="button" onPress={() => setOpen(open === s.id ? null : s.id)}>
            <Text style={[styles.name, { color: colors.text }]}>{s.alerts ? '🔔 ' : ''}{s.name}</Text>
            <Text style={{ color: colors.muted }}>{s.total} {t(lang, 'results')}{s.fresh ? ` · 🆕 ${s.fresh}` : ''}</Text>
          </Pressable>
          {open === s.id && one.data ? one.data.items.map((u) => <UnitCard key={u.id} unit={u} lang={lang} onPress={() => nav.navigate('Unit', { code: u.code })} />) : null}
          <Button testID={`saved-delete-${s.id}`} variant="secondary" label={t(lang, 'delete')} onPress={async () => { await api.deleteSavedSearch(s.id); setOpen(null); await list.refetch(); }} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.xl, gap: spacing.md },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  name: { fontSize: 16, fontWeight: '700' },
});
