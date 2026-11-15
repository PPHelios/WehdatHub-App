import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

/** Leases being tracked (own, the team's for a team lead, all for managers), soonest end first. Tap opens the unit's lease card. */
export function LeasesScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const q = useQuery({ queryKey: ['leases'], queryFn: () => api.leases() });
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError || !q.data) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const items = q.data.items;
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={async () => { await q.refetch(); }} />}>
      {items.length === 0 ? <EmptyView title={t(lang, 'leasesEmpty')} hint="" /> : null}
      {items.map((z) => (
        <Pressable key={z.code} testID={`lease-${z.code}`} accessibilityRole="button" onPress={() => nav.navigate('Unit', { code: z.code })} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Text style={[styles.code, { color: colors.text }]}>{z.code}</Text>
            <Text style={{ color: z.done ? colors.muted : z.daysLeft <= 60 ? colors.danger : colors.accent, fontWeight: '700' }}>{z.done ? '✅' : `${z.daysLeft} ${t(lang, 'daysN')}`}</Text>
          </View>
          <Text style={{ color: colors.muted }}>{[z.tenant_name, z.broker_name, z.end].filter(Boolean).join(' · ')}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.xl, gap: spacing.md },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 16, fontWeight: '700' },
});
