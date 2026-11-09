import React, { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tick } from '../haptics';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ApiClientError, LEAD_STAGES } from '@wehdathub/shared';
import type { ApiLead, LeadDetail, LeadStage } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t, type StringKey } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

type FollowUp = { at: Date; kind: 'call' | 'viewing' };
const at10 = (days: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d;
};

export function LeadScreen({ leadRef }: { leadRef?: string } = {}) {
  const { colors } = useTheme();
  const lang = currentLang();
  const routeRef = useRoute<RouteProp<RootStackParams, 'Lead'>>().params?.ref;
  const ref = leadRef ?? routeRef ?? '';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['lead', ref], queryFn: () => api.lead(ref) });
  const [note, setNote] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [askLost, setAskLost] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /** Every quick action: send it with the version the screen shows; a 409 means it changed elsewhere, so show the latest. */
  const act = useMutation<unknown, Error, (lead: ApiLead) => Promise<{ lead: ApiLead }>>({
    mutationFn: async (run) => {
      const cur = (qc.getQueryData(['lead', ref]) as LeadDetail | undefined)?.lead;
      if (!cur) throw new Error('no lead');
      return run(cur);
    },
    onSuccess: async () => {
      tick();
      setMessage(null);
      await qc.invalidateQueries({ queryKey: ['lead', ref] });
      await qc.invalidateQueries({ queryKey: ['leads'] });
      await qc.invalidateQueries({ queryKey: ['today'] });
    },
    onError: async (e) => {
      setMessage(e instanceof ApiClientError && e.status === 409 ? t(lang, 'leadChanged') : e instanceof ApiClientError && e.code === 'past' ? t(lang, 'pastTime') : e instanceof ApiClientError && e.code === 'note_empty' ? t(lang, 'noteEmpty') : errorText(e, lang));
      await qc.invalidateQueries({ queryKey: ['lead', ref] });
    },
  });
  const run = (fn: (l: ApiLead) => Promise<{ lead: ApiLead }>) => act.mutateAsync(fn).catch(() => undefined);

  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError || !q.data) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const { lead, timeline } = q.data;
  const followUp = (f: FollowUp) => run((l) => api.leadFollowUp(l.ref, l.version, f.at.toISOString(), f.kind));
  const stageOptions = LEAD_STAGES.map((s) => ({ value: s, label: t(lang, `st_${s}` as StringKey) }));

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={async () => { await q.refetch(); }} />}>
      <Text style={[styles.title, { color: colors.text }]}>{lead.name || lead.ref}</Text>
      <Text style={{ color: colors.muted }}>{lead.ref}{lead.source ? ` · ${lead.source}` : ''}{lead.assignee ? ` · ${lead.assignee}` : ''}</Text>
      {message ? <Text testID="lead-message" style={{ color: colors.danger }}>{message}</Text> : null}

      {lead.phones.map((p) => (
        <Button key={p} label={`📞 ${t(lang, 'call')} ${p}`} variant="secondary" onPress={() => Linking.openURL(`tel:${p.startsWith('+') ? p : `+${p}`}`)} />
      ))}
      <Button testID="lead-called" label={`✓ ${t(lang, 'iCalled')}`} loading={act.isPending} onPress={() => run((l) => api.leadCalled(l.ref, l.version))} />

      <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'stage')}</Text>
      <Chips<LeadStage> options={stageOptions} value={lead.stage} onChange={(s) => (s === 'lost' ? setAskLost(true) : run((l) => api.leadStage(l.ref, l.version, s)))} />
      {askLost ? (
        <View style={styles.box}>
          <Field label={t(lang, 'lostReason')} value={lostReason} onChangeText={setLostReason} />
          <Button label={t(lang, 'confirmLost')} onPress={async () => { await run((l) => api.leadStage(l.ref, l.version, 'lost', lostReason.trim())); setAskLost(false); setLostReason(''); }} />
        </View>
      ) : null}

      <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'followUp')}</Text>
      {lead.nextFollowUpAt ? <Text style={{ color: colors.accent, fontWeight: '600' }}>{lead.followUpKind === 'viewing' ? t(lang, 'fuViewing') : t(lang, 'fuCall')} · {new Date(lead.nextFollowUpAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</Text> : null}
      <View style={styles.row}>
        <View style={styles.flex}><Button label={t(lang, 'fuTomorrow')} variant="secondary" onPress={() => followUp({ at: at10(1), kind: 'call' })} /></View>
        <View style={styles.flex}><Button label={t(lang, 'fuTwoDays')} variant="secondary" onPress={() => followUp({ at: at10(2), kind: 'call' })} /></View>
      </View>
      <View style={styles.row}>
        <View style={styles.flex}><Button label={t(lang, 'fuWeek')} variant="secondary" onPress={() => followUp({ at: at10(7), kind: 'call' })} /></View>
        <View style={styles.flex}><Button label={`${t(lang, 'fuViewing')} · ${t(lang, 'fuTomorrow')}`} variant="secondary" onPress={() => followUp({ at: at10(1), kind: 'viewing' })} /></View>
      </View>

      <Field label={t(lang, 'addNote')} value={note} onChangeText={setNote} multiline />
      <Button testID="lead-note" label={t(lang, 'save')} onPress={async () => { await run((l) => api.leadNote(l.ref, l.version, note)); setNote(''); }} />

      <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'history')}</Text>
      {timeline.map((e) => (
        <View key={e.id} style={[styles.event, { borderColor: colors.border }]}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{new Date(e.at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}{e.by ? ` · ${e.by}` : ''}</Text>
          <Text style={{ color: colors.text }}>{e.text || (e.stage ? t(lang, `st_${e.stage}` as StringKey) : e.kind)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 22, fontWeight: '800' },
  h: { fontSize: 16, fontWeight: '700', marginTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  box: { gap: spacing.sm },
  event: { borderStartWidth: 3, paddingStart: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm },
});
