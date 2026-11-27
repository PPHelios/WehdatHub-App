import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tick } from '../haptics';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ApiClientError, LEAD_STAGES } from '@wehdathub/shared';
import type { ApiLead, LeadDetail, LeadStage } from '@wehdathub/shared';
import { api } from '../api';
import { teamOptions } from '../queries';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { ContactRow } from '../components/ContactRow';
import { looksLikePhone, PhoneText } from '../components/PhoneText';
import { InitialAvatar } from '../components/InitialAvatar';
import { TimelineEntry } from '../components/TimelineEntry';
import { Pill } from '../components/Pill';
import { Field } from '../components/Field';
import { Section } from '../components/Section';
import { LeadActions } from '../components/LeadActions';
import { ViewingForm, viewingInstant } from '../components/ViewingForm';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { stageLabel, t } from '../i18n';
import { eventText } from '../leadEvents';
import type { RootStackParams } from '../navigation';
import { useRights } from '../rights';
import { radius, spacing, useTheme } from '../theme';

type FollowUp = { at: Date; kind: 'call' | 'viewing' };
const FU_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

/** Any day (the next two weeks) and hour for the follow-up, as a call or a viewing: the same day and hour chips as a viewing. */
export function FollowUpPicker({ onSave, children }: { onSave: (f: FollowUp) => Promise<boolean | void> | void; children?: React.ReactNode }) {
  const lang = currentLang();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FollowUp['kind']>('call');
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(10);
  if (!open) return <Button testID="fu-pick" variant="secondary" label={t(lang, 'addFollowUp')} onPress={() => setOpen(true)} />;
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { value: String(i), label: i === 0 ? t(lang, 'today') : d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) };
  });
  const save = async () => {
    const saved = await onSave({ at: new Date(viewingInstant(day, hour)), kind });
    if (saved !== false) setOpen(false);
  };
  return (
    <View testID="fu-picker" style={styles.box}>
      {children}
      <Chips<FollowUp['kind']> testID="fu-kind" options={[{ value: 'call', label: t(lang, 'fuCall') }, { value: 'viewing', label: t(lang, 'fuViewing') }]} value={kind} onChange={setKind} />
      <Chips testID="fu-day" options={days} value={String(day)} onChange={(v) => setDay(Number(v))} />
      <Chips testID="fu-hour" options={FU_HOURS.map((h) => ({ value: String(h), label: `${h}:00` }))} value={String(hour)} onChange={(v) => setHour(Number(v))} />
      <Button testID="fu-save" label={t(lang, 'save')} onPress={save} />
      <Button variant="secondary" label={t(lang, 'cancel')} onPress={() => setOpen(false)} />
    </View>
  );
}

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
  const rights = useRights();
  const team = useQuery(teamOptions(rights.team));

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
      await Promise.all([qc.invalidateQueries({ queryKey: ['lead', ref] }), qc.invalidateQueries({ queryKey: ['leads'] }), qc.invalidateQueries({ queryKey: ['today'] })]);
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
  const canWork = q.data.canWork ?? true;
  const canCollaborate = canWork || q.data.canCollaborate;
  const followUp = (f: FollowUp) => act.mutateAsync((l) => api.leadFollowUp(l.ref, l.version, f.at.toISOString(), f.kind)).then(() => true, () => false);
  const stageOptions = LEAD_STAGES.map((s) => ({ value: s, label: stageLabel(lang, s) }));

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={async () => { await q.refetch(); }} />}>
      {canCollaborate ? (
        <View testID="lead-stage-panel" style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text accessibilityRole="header" variant="bodySm" weight="bold" style={{ color: colors.text }}>{t(lang, 'stage')}</Text>
          <Chips<LeadStage> options={stageOptions} value={lead.stage} onChange={(s) => (s === 'lost' ? setAskLost(true) : run((l) => api.leadStage(l.ref, l.version, s)))} />
          {askLost ? (
            <View style={styles.box}>
              <Field label={t(lang, 'lostReason')} value={lostReason} onChangeText={setLostReason} />
              <Button label={t(lang, 'confirmLost')} onPress={async () => { await run((l) => api.leadStage(l.ref, l.version, 'lost', lostReason.trim())); setAskLost(false); setLostReason(''); }} />
            </View>
          ) : null}
        </View>
      ) : null}
      <View testID="lead-profile" style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.identity}>
          <InitialAvatar name={lead.name} />
          <View style={styles.flex}>
            {looksLikePhone(lead.name)
              ? <PhoneText accessibilityRole="header" value={lead.name!} variant="title" style={{ color: colors.text }} />
              : <Text accessibilityRole="header" variant="title" style={{ color: colors.text }}>{lead.name || lead.ref}</Text>}
            <View style={styles.chips}>
              <Pill tone="primary" label={stageLabel(lang, lead.stage)} testID="lead-profile-stage" />
              {lead.name && lead.name !== lead.ref ? <Pill label={lead.ref} /> : null}
            </View>
            {lead.source || lead.assignee ? <Text variant="caption" style={[styles.caption, { color: colors.muted }]}>{[lead.source, lead.assignee].filter(Boolean).join(' · ')}</Text> : null}
          </View>
        </View>
        {lead.phones.map((phone) => <ContactRow key={phone} phone={phone} kind="lead" lang={lang} />)}
      </View>
      {message ? <Text testID="lead-message" style={{ color: colors.danger }}>{message}</Text> : null}

      {q.data.canClaim ? <Button testID="lead-claim" label={lang === 'ar' ? 'استلم العميل' : 'Take lead'} loading={act.isPending} onPress={() => run((l) => api.claimLead(l.ref, l.version))} /> : null}
      {canCollaborate ? <>
        <Button testID="lead-called" label={t(lang, 'iCalled')} loading={act.isPending} onPress={() => run((l) => api.leadCalled(l.ref, l.version))} />

        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Field label={t(lang, 'addNote')} value={note} onChangeText={setNote} multiline />
          <Button testID="lead-note" size="sm" variant="secondary" label={t(lang, 'save')} onPress={async () => { await run((l) => api.leadNote(l.ref, l.version, note)); setNote(''); }} />
        </View>

        <FollowUpPicker onSave={followUp}>
          {lead.nextFollowUpAt ? <Text style={{ color: colors.accentInk, fontWeight: '600' }}>{lead.followUpKind === 'viewing' ? t(lang, 'fuViewing') : t(lang, 'fuCall')} · {new Date(lead.nextFollowUpAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</Text> : null}
          {lead.followUpKind ? <Button variant="secondary" testID="lead-follow-up-done" label={lang === 'ar' ? 'تمت المتابعة' : 'Complete follow-up'} loading={act.isPending} onPress={() => run((l) => api.completeLeadFollowUp(l.ref, l.version))} /> : null}
        </FollowUpPicker>

        {canWork ? (
          <Section testID="sec-viewing" title={t(lang, 'addViewing')}>
            <ViewingForm lead={lead} />
          </Section>
        ) : null}

      </> : null}
      {(q.data.canAssign ?? rights.team) ? (
        <Section testID="sec-assign" title={t(lang, 'reassign')}>
          <Chips<string>
            options={[...(team.data?.items ?? []).map((m) => ({ value: m.id, label: m.name })), { value: '', label: t(lang, 'noOne') }]}
            value={lead.assigneeId ?? ''}
            onChange={(id) => run((l) => api.assignLead(l.ref, l.version, id || null))}
          />
        </Section>
      ) : null}
      {canWork && (rights.team || rights.agencyOwner) ? <LeadActions lead={lead} /> : null}

      <Section testID="sec-history" title={t(lang, 'history')}>
        {timeline.length ? timeline.map((event, index) => (
          <TimelineEntry key={event.id} at={event.at} title={eventText(event, lang)} actor={event.by}
            lang={lang} first={index === 0} last={index === timeline.length - 1} />
        )) : <Text style={{ color: colors.muted }}>{lang === 'ar' ? 'مفيش نشاط لسه.' : 'No activity yet.'}</Text>}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs, gap: spacing.xs },
  caption: { marginTop: spacing.xs },
  content: { padding: spacing.lg, gap: spacing.md },
  panel: { padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderRadius: radius.card },
  flex: { flex: 1 },
  box: { gap: spacing.sm },
});
