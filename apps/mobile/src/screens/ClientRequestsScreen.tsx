import React, { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { FlashList } from '@shopify/flash-list';
import { BusySwitch } from '../components/BusySwitch';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError } from '@wehdathub/shared';
import type { ClientRequest, Lang } from '@wehdathub/shared';
import { api } from '../api';
import { Field } from '../components/Field';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';
import { toast, toastError } from '../components/Toast';
import { sx } from '../sharedStyles';

function AddRequest({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [lead, setLead] = useState('');
  const [alerts, setAlerts] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    try {
      await api.addClientRequest(q.trim(), lead.trim() || undefined, alerts);
      setOpen(false); setQ(''); setLead(''); setMsg(null);
      onDone();
    } catch (e) {
      const c = e instanceof ApiClientError ? e.code : '';
      setMsg(toastError(c === 'no_filters' ? t(lang, 'requestNoFilters') : c === 'lead_not_found' ? t(lang, 'leadNotFound') : c === 'too_many_requests' ? t(lang, 'tooManyRequests') : c === 'too_many_requests_broker' ? t(lang, 'limitAlerts') : errorText(e, lang)));
    }
  };
  if (!open) return <Button testID="request-add" label={`➕ ${t(lang, 'addRequest')}`} onPress={() => { setMsg(null); setOpen(true); }} />;
  return (
    <View style={{ gap: spacing.sm }}>
      <Field testID="request-q" label={t(lang, 'requestSearch')} value={q} onChangeText={setQ} />
      <Field testID="request-lead" label={t(lang, 'requestLead')} value={lead} onChangeText={setLead} />
      <View style={sx.flexDirectionRow_alignItemsCenter_justifyContentSpaceBetween}><Text style={[{ color: colors.text }, sx.flex1]}>{t(lang, 'alertsOn')}</Text><BusySwitch testID="request-alerts" value={alerts} onValueChange={setAlerts} /></View>
      <Button testID="request-save" label={t(lang, 'save')} onPress={save} disabled={!q.trim()} />
      {msg ? <Text style={{ color: colors.danger }}>{msg}</Text> : null}
    </View>
  );
}

const RequestCard = memo(function RequestCardView({ r, tab, lang, onOpenLead, onFulfil, onDelete }: { r: ClientRequest; tab: 'pending' | 'fulfilled'; lang: Lang; onOpenLead: (ref: string) => void; onFulfil: (id: string) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const { colors, elev } = useTheme();
  return (
    <View testID={`request-${r.id}`} style={[styles.card, elev('md'), { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[{ color: colors.text }, sx.fontWeight700]}>{r.alerts ? '🔔 ' : ''}{lang === 'en' && r.summary_en ? r.summary_en : r.summary}</Text>
      {r.lead ? (
        <Pressable testID={`request-lead-${r.id}`} accessibilityRole="button" onPress={() => onOpenLead(r.lead!.ref)}>
          <Text style={{ color: colors.primaryInk }}>👤 {r.lead.name || r.lead.ref}</Text>
        </Pressable>
      ) : <Text testID={`request-nolead-${r.id}`} style={{ color: colors.muted }}>{t(lang, 'noLead')}</Text>}
      <Text style={{ color: colors.muted }}>{r.matches} {t(lang, 'matchesN')}</Text>
      <View style={styles.row}>
        {tab === 'pending' ? <View style={styles.flex}><Button testID={`request-fulfil-${r.id}`} variant="secondary" label={t(lang, 'markFulfilled')} onPress={async () => onFulfil(r.id)} /></View> : null}
        <View style={styles.flex}><Button testID={`request-delete-${r.id}`} variant="secondary" label={t(lang, 'delete')} onPress={async () => onDelete(r.id)} /></View>
      </View>
    </View>
  );
});

/** Client requests (a saved search for a client, with alerts): Pending and Fulfilled. Brokers see their own, managers the whole agency. */
export function ClientRequestsScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'fulfilled'>('pending');
  const list = useInfiniteQuery({
    queryKey: ['clientRequests', tab],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.clientRequests(tab, pageParam),
    getNextPageParam: (last) => (last.more || (last.pages !== undefined && last.page < last.pages) ? last.page + 1 : undefined),
  });
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['clientRequests'] }), [qc]);
  const openLead = useCallback((ref: string) => nav.navigate('Lead', { ref }), [nav]);
  const fail = useCallback((e: unknown) => toast(errorText(e, lang), true), [lang]);
  const fulfil = useCallback(async (id: string) => { try { await api.clientRequestFulfil(id); await refresh(); } catch (e) { fail(e); } }, [refresh, fail]);
  const remove = useCallback(async (id: string) => { try { await api.clientRequestDelete(id); await refresh(); } catch (e) { fail(e); } }, [refresh, fail]);
  const renderItem = useCallback(({ item }: { item: ClientRequest }) => <RequestCard r={item} tab={tab} lang={lang} onOpenLead={openLead} onFulfil={fulfil} onDelete={remove} />, [tab, lang, openLead, fulfil, remove]);
  return (
    <FlashList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.pad}
      keyboardShouldPersistTaps="handled"
      data={items}
      keyExtractor={(r) => r.id}
      renderItem={renderItem}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
      onEndReachedThreshold={0.6}
      ListHeaderComponent={(
        <View style={styles.head}>
          <AddRequest onDone={refresh} />
          <Chips<'pending' | 'fulfilled'> animateFilter testID="requests-tab" value={tab} options={[{ value: 'pending', label: t(lang, 'tabPending') }, { value: 'fulfilled', label: t(lang, 'tabFulfilled') }]} onChange={setTab} />
        </View>
      )}
      ListEmptyComponent={list.isPending ? <Loading label={t(lang, 'loading')} /> : list.isError ? <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} /> : <Text testID="requests-empty" style={{ color: colors.muted }}>{t(lang, 'noRequests')}</Text>}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primaryInk} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg },
  head: { gap: spacing.md, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  footer: { padding: spacing.lg },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
});
