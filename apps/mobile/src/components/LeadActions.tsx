import React, { useState } from 'react';
import { Alert, Linking, Share, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiLead } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { errorText } from '../errors';
import { t } from '../i18n';
import { leadLang } from '../prefs';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Field } from './Field';
import { Section } from './Section';

/** Draft a message, send a unit to the client, and (managers) merge a duplicate or erase the client. The server decides who may. */
export function LeadActions({ lead, manager }: { lead: ApiLead; manager: boolean }) {
  const lang = currentLang();
  const { colors } = useTheme();
  const nav = useNavigation();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [other, setOther] = useState('');
  const [mergeConfirm, setMergeConfirm] = useState('');
  const [digits, setDigits] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const guard = async (fn: () => Promise<void>, fail: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(fail || errorText(e, lang));
    } finally {
      setBusy(false);
    }
  };
  const makeDraft = () => guard(async () => setDraft((await api.leadDraft(lead.ref, leadLang(lead))).text), t(lang, 'leadDraftFail'));
  const send = () => guard(async () => { const r = await api.leadSend(lead.ref, code.trim(), leadLang(lead)); await Linking.openURL(r.url); }, t(lang, 'sendFail'));
  const merge = () => guard(async () => { await api.leadMerge(lead.ref, other.trim(), mergeConfirm.trim()); setOther(''); setMergeConfirm(''); await qc.invalidateQueries({ queryKey: ['lead', lead.ref] }); }, t(lang, 'mergeFail'));
  const erase = () =>
    Alert.alert(t(lang, 'eraseLead'), undefined, [
      { text: t(lang, 'cancel'), style: 'cancel' },
      {
        text: t(lang, 'eraseLead'),
        style: 'destructive',
        onPress: () => void guard(async () => { await api.leadErase(lead.ref, digits.trim()); Alert.alert(t(lang, 'erased')); await qc.invalidateQueries({ queryKey: ['leads'] }); nav.goBack(); }, t(lang, 'eraseFail')),
      },
    ]);

  return (
    <>
      <Section testID="sec-draft" startOpen title={t(lang, 'leadDraft')}>
        <Button testID="lead-draft" label={t(lang, 'leadDraft')} variant="secondary" loading={busy} onPress={makeDraft} />
        {draft ? (
          <View>
            <Text selectable style={{ color: colors.text }}>{draft}</Text>
            <Button label={t(lang, 'shareText')} variant="secondary" onPress={() => { void Share.share({ message: draft }); }} />
          </View>
        ) : null}
      </Section>
      <Section testID="sec-send" title={t(lang, 'sendToClient')}>
        <Field label={t(lang, 'unitCodeHint')} value={code} onChangeText={setCode} autoCapitalize="characters" />
        <Button testID="lead-send" label={t(lang, 'sendToClient')} variant="secondary" loading={busy} disabled={!code.trim()} onPress={send} />
      </Section>
      {manager ? (
        <>
          <Section testID="sec-merge" title={t(lang, 'mergeLead')}>
            <Field label={t(lang, 'mergeOther')} value={other} onChangeText={setOther} autoCapitalize="characters" />
            <Field label={`${t(lang, 'mergeConfirm')} (${lead.ref})`} value={mergeConfirm} onChangeText={setMergeConfirm} autoCapitalize="characters" />
            <Button testID="lead-merge" label={t(lang, 'mergeLead')} variant="secondary" loading={busy} disabled={!other.trim() || !mergeConfirm.trim()} onPress={merge} />
          </Section>
          <Section testID="sec-erase" title={t(lang, 'eraseLead')}>
            <Field label={t(lang, 'eraseConfirm')} value={digits} onChangeText={setDigits} keyboardType="number-pad" />
            <Button testID="lead-erase" label={t(lang, 'eraseLead')} variant="secondary" disabled={digits.trim().length < 4} onPress={erase} />
          </Section>
        </>
      ) : null}
      {msg ? <Text testID="lead-actions-message" style={{ color: colors.danger }}>{msg}</Text> : null}
    </>
  );
}
