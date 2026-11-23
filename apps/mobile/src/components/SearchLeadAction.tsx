import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@wehdathub/shared';
import type { LeadStage } from '@wehdathub/shared';
import { normalizeSearchWords } from '../searchCapabilities';
import { api } from '../api';
import { currentLang } from '../auth';
import { errorText } from '../errors';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { LeadPicker } from './LeadPicker';
import { Button } from './Button';
import { ErrorView, Loading } from './StateViews';

const stageNames: Record<string, LeadStage> = {
  new: 'new', contacted: 'contacted', interested: 'interested', viewing: 'viewing', negotiation: 'negotiation', won: 'won', lost: 'lost',
  جديد: 'new', اتكلمنا: 'contacted', مهتم: 'interested', معاينه: 'viewing', تفاوض: 'negotiation', اتقفلت: 'won', ضاعت: 'lost',
};

type Command = { ref?: string; target?: string; stage?: LeadStage; note?: string; lostReason?: string };
type Parsed = Command | 'incomplete' | null;

function leadTarget(value: string) {
  const target = value.trim().replace(/^(?:lead|العميل)\s+/i, '');
  if (/^L-\d{1,8}$/i.test(target)) return { ref: target.toUpperCase() };
  return target && !/^(?:the lead|lead|this lead|العميل)$/i.test(target) ? { target } : null;
}

export function readLeadCommand(text: string): Parsed {
  const move = /^(?:move|change|انقل|غيّر|غير)\s+(.+?)\s+(?:to|إلى|الى|الي|إلي|لـ)\s+([^;؛]+)(.*)$/i.exec(text);
  const noteOnly = /^(?:note|add (?:a )?note to|ملاحظ[ةه]|ضيف ملاحظ[ةه] (?:لـ|ل))\s+(.+?)(?:\s*:\s*|\s+(?:that|إن|ان)\s+)(.+)$/is.exec(text);
  if (noteOnly) {
    const target = leadTarget(noteOnly[1]);
    return target && noteOnly[2].trim() ? { ...target, note: noteOnly[2].trim() } : 'incomplete';
  }
  if (!move && /^(?:add (?:a )?note to|ضيف ملاحظ[ةه])\s+/i.test(text)) return 'incomplete';
  if (!move && !/^(?:move|change|note|add (?:a )?note|انقل|غير|غيّر|ملاحظ[ةه]|ضيف ملاحظ[ةه])\s+.*(?:L-\d|\blead\b|العميل)/i.test(text)) return null;
  if (!move) return 'incomplete';
  const stage = stageNames[normalizeSearchWords(move[2].trim().replace(/[.!؟]+$/, ''))];
  const suffix = move[3].trim();
  const note = /[;؛]\s*(?:note|ملاحظ[ةه])\s*:\s*([^;؛]+)/i.exec(suffix)?.[1].trim();
  const lostReason = /[;؛]\s*(?:reason|السبب)\s*:\s*([^;؛]+)/i.exec(suffix)?.[1].trim();
  const rest = suffix.replace(/[;؛]\s*(?:note|ملاحظ[ةه]|reason|السبب)\s*:\s*[^;؛]+/gi, '').trim();
  const target = leadTarget(move[1]);
  if (!target || (!stage && !/L-\d|lead|العميل/i.test(move[1]))) return target ? null : 'incomplete';
  if (!stage || rest || (stage === 'lost' && !lostReason) || (stage !== 'lost' && lostReason)) return 'incomplete';
  return { ...target, stage, note, lostReason };
}

export function SearchLeadAction({ command, onClose }: { command: Parsed; onClose: () => void }) {
  const lang = currentLang();
  const ar = lang === 'ar';
  const { colors } = useTheme();
  const qc = useQueryClient();
  const change = command && command !== 'incomplete' ? command : null;
  const [pickedRef, setPickedRef] = useState<string>();
  const ref = change?.ref ?? pickedRef;
  const detail = useQuery({ queryKey: ['lead', ref], queryFn: () => api.lead(ref!), enabled: Boolean(ref) });
  const submit = useMutation({
    mutationFn: () => api.leadUpdate(ref!, { version: detail.data!.lead.version, stage: change!.stage, note: change!.note, lostReason: change!.lostReason }),
    onSuccess: async () => {
      await Promise.all(['leads', 'lead', 'dashboard', 'today'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
    onError: async () => { await detail.refetch(); },
  });
  const lead = detail.data?.lead;
  const allowed = Boolean(detail.data?.canWork || detail.data?.canCollaborate);
  return <ScrollView contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{ar ? 'راجع تعديل العميل' : 'Review lead update'}</Text>
    {!change ? <Text style={{ color: colors.text }}>{ar ? 'اكتب اسم العميل أو رقمه أو كوده والمرحلة. مثال: انقل L-0002 إلى معاينة؛ ملاحظ[ةه]: اتفقنا على السبت' : 'Include a lead name, phone, or code and the stage or note. Example: Move L-0002 to viewing; note: Saturday agreed'}</Text> : null}
    {change?.target && !ref ? <LeadPicker initial={change.target} onPick={(lead) => setPickedRef(lead.ref)} /> : null}
    {ref && detail.isPending ? <Loading label={t(lang, 'loading')} /> : null}
    {detail.isError ? <ErrorView message={errorText(detail.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => detail.refetch()} /> : null}
    {lead && change ? <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{lead.name || lead.ref}</Text>
      <Text style={{ color: colors.muted }}>{lead.ref}</Text>
      {change.stage ? <Text style={{ color: colors.text }}>{t(lang, 'stage')} · {t(lang, `st_${lead.stage}`)} → {t(lang, `st_${change.stage}`)}</Text> : null}
      {change.note ? <Text style={{ color: colors.text }}>{t(lang, 'addNote')} · {change.note}</Text> : null}
      {change.lostReason ? <Text style={{ color: colors.text }}>{t(lang, 'lostReason')} · {change.lostReason}</Text> : null}
      {!allowed ? <Text style={{ color: colors.danger }}>{ar ? 'معندكش صلاحية تعدّل العميل ده' : 'You can’t update this lead'}</Text> : null}
      {submit.isError ? <Text style={{ color: colors.danger }}>{submit.error instanceof ApiClientError && submit.error.status === 409 ? t(lang, 'leadChanged') : errorText(submit.error, lang)}</Text> : null}
      {allowed ? <Button label={ar ? 'أكّد التعديل' : 'Confirm update'} loading={submit.isPending} disabled={detail.isFetching} onPress={() => submit.mutate()} /> : null}
    </View> : null}
    {change?.target && ref ? <Button variant="secondary" label={ar ? 'اختار عميل تاني' : 'Choose another lead'} disabled={submit.isPending} onPress={() => { submit.reset(); setPickedRef(undefined); }} /> : null}
    <Button variant="secondary" label={t(lang, 'cancel')} disabled={submit.isPending} onPress={onClose} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 90, gap: spacing.md },
  title: { fontSize: 20, fontWeight: '700' },
  card: { padding: spacing.lg, gap: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card },
});
