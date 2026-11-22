import { track } from '../analytics';
import React, { useEffect, useState } from 'react';
import { timed } from '../usage';
import { ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError, PlanLockedError, contactPhoneSchema } from '@wehdathub/shared';
import { phoneHelp } from '../readback';
import type { ApiLead } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { usePlanLock } from '../planLock';
import { usePlanState } from '../planState';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { spacing, useTheme } from '../theme';

const KINDS: ApiLead['kind'][] = ['buyer', 'tenant', 'seller', 'landlord'];
const KIND_LABEL: Record<ApiLead['kind'], [string, string]> = { buyer: ['مشتري', 'Buyer'], tenant: ['مستأجر', 'Tenant'], seller: ['بائع', 'Seller'], landlord: ['مؤجر', 'Landlord'] };

export function NewLeadScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const qc = useQueryClient();
  const picked = useRoute<RouteProp<RootStackParams, 'NewLead'>>().params;
  const planState = usePlanState();
  useEffect(() => {
    if (planState.phase === 'readonly') {
      usePlanLock.getState().show(new PlanLockedError('plan_readonly'));
      if (nav.canGoBack()) nav.goBack();
    }
  }, [planState.phase, nav]);
  const [name, setName] = useState(picked?.name ?? '');
  const [phone, setPhone] = useState(picked?.phone ?? '');
  const [kind, setKind] = useState<ApiLead['kind']>('buyer');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [filling, setFilling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fill = async () => {
    setFilling(true);
    setMessage(null);
    try {
      const r = await timed('lead_paste', () => api.extractLead(paste.trim()));
      // A portal enquiry (managers and the owner): its own screen, not this form.
      if (r.portal) return nav.replace('PortalEnquiry', { message: paste.trim(), enquiry: r.enquiry });
      if (r.name) setName(r.name);
      if (r.phones[0]) setPhone(r.phones[0]);
      if (r.kind) setKind(r.kind);
      if (r.note) setNotes((cur) => (cur ? `${cur}\n${r.note}` : r.note));
      setNotice(t(lang, 'pasteDone'));
    } catch (e) {
      setMessage(errorText(e, lang));
    } finally {
      setFilling(false);
    }
  };

  const save = async () => {
    setMessage(null);
    if (!contactPhoneSchema.safeParse(phone.trim()).success) return setMessage(t(lang, 'badNumber'));
    try {
      void track('lead_save_started');
      const r = await api.createLead({ phone1: phone.trim(), name: name.trim() || undefined, kind, notes: notes.trim() || undefined });
      if (r.outcome === 'created') void track('lead_created');
      await qc.invalidateQueries({ queryKey: ['leads'] });
      nav.replace('Lead', { ref: r.lead.ref });
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'colleague') return setMessage(t(lang, 'leadColleague'));
      if (e instanceof ApiClientError && (e.code === 'phone_invalid' || e.code === 'phone_required')) return setMessage(t(lang, 'badNumber'));
      setMessage(errorText(e, lang));
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Button testID="from-contacts" variant="secondary" label={`📇 ${t(lang, 'fromContacts')}`} onPress={() => nav.navigate('Contacts')} />
      <Field label={t(lang, 'pasteFrom')} value={paste} onChangeText={setPaste} multiline testID="lead-paste" placeholder={t(lang, 'pasteHint')} />
      <Button testID="lead-fill" variant="secondary" label={`✨ ${t(lang, 'pasteFill')}`} onPress={fill} disabled={filling || !paste.trim()} />
      {notice ? <Text style={{ color: colors.accentInk }}>{notice}</Text> : null}
      <Field label={t(lang, 'leadName')} value={name} onChangeText={setName} testID="lead-name" />
      <Field label={t(lang, 'leadPhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="lead-phone" hint={phoneHelp(lang)} />
      <Chips<ApiLead['kind']> options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k][lang === 'ar' ? 0 : 1] }))} value={kind} onChange={setKind} />
      <Field label={t(lang, 'leadNotes')} value={notes} onChangeText={setNotes} multiline />
      {message ? <Text testID="lead-form-message" style={{ color: colors.danger }}>{message}</Text> : null}
      <Button testID="lead-save" label={t(lang, 'save')} onPress={save} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.md } });
