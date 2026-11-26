import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError, contactPhoneSchema } from '@wehdathub/shared';
import type { PortalEnquiryRead } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { toast } from '../components/Toast';
import { errorText } from '../errors';
import { t } from '../i18n';
import { teamOptions } from '../queries';
import { phoneHelp } from '../readback';
import type { RootStackParams } from '../navigation';
import { spacing, useTheme } from '../theme';

/**
 * A portal enquiry (Bayut, Dubizzle, Nawy) pasted or shared in, for managers and the owner: shows what the message states,
 * then keeps it; with the client's phone and a broker it becomes a lead in the same step.
 */
export function PortalEnquiryScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const qc = useQueryClient();
  const { message, enquiry: given } = useRoute<RouteProp<RootStackParams, 'PortalEnquiry'>>().params;
  const [enquiry, setEnquiry] = useState<PortalEnquiryRead | null>(given ?? null);
  const [phone, setPhone] = useState('');
  const [brokerId, setBrokerId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const team = useQuery(teamOptions());

  useEffect(() => {
    if (enquiry) return;
    let gone = false;
    api.readPortalEnquiry(message).then((r) => { if (!gone) setEnquiry(r); }).catch((e) => {
      if (!gone) setError(e instanceof ApiClientError && e.status === 422 ? t(lang, 'peNotEnquiry') : errorText(e, lang));
    });
    return () => { gone = true; };
  }, [enquiry, message, lang]);

  const save = async () => {
    setError(null);
    const p = phone.trim();
    if (p && !contactPhoneSchema.safeParse(p).success) return setError(t(lang, 'badNumber'));
    if (!!p !== !!brokerId) return setError(t(lang, 'peNeedBoth'));
    setSaving(true);
    try {
      const r = await api.savePortalEnquiry({ message, phone: p || undefined, brokerId: brokerId || undefined });
      await Promise.all([qc.invalidateQueries({ queryKey: ['portal'] }), qc.invalidateQueries({ queryKey: ['leads'] })]);
      toast(r.assigned ? t(lang, 'peSavedLead') : r.deduped ? t(lang, 'peRepeat') : t(lang, 'peSavedOpen'));
      if (r.assigned && r.leadRef) nav.replace('Lead', { ref: r.leadRef });
      else nav.replace('Portal');
    } catch (e) {
      if (e instanceof ApiClientError && (e.code === 'phone_invalid')) setError(t(lang, 'badNumber'));
      else if (e instanceof ApiClientError && e.code === 'not_enquiry') setError(t(lang, 'peNotEnquiry'));
      else setError(errorText(e, lang));
    } finally {
      setSaving(false);
    }
  };

  const brokers = (team.data?.items ?? []).filter((m) => !m.away);
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!enquiry && !error ? <><ActivityIndicator color={colors.spinner} /><Text style={{ color: colors.muted }}>{t(lang, 'peReading')}</Text></> : null}
      {enquiry ? (
        <>
          <Text testID="pe-portal" style={[styles.h, { color: colors.text }]}>{t(lang, 'pePortal')}: {enquiry.portal}</Text>
          <Text testID="pe-name" style={{ color: colors.text }}>{t(lang, 'peName')}: {enquiry.name || '—'}</Text>
          <Text testID="pe-link" style={{ color: colors.muted }} numberOfLines={2}>{t(lang, 'peLink')}: {enquiry.link}</Text>
          <Text testID="pe-listing" style={{ color: colors.muted }}>{t(lang, 'peListing')}: {enquiry.listingNo || '—'}</Text>
          <Field label={t(lang, 'pePhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="pe-phone" hint={phoneHelp(lang)} />
          <Text style={{ color: colors.text, fontWeight: '600' }}>{t(lang, 'peBroker')}</Text>
          {team.isPending ? <ActivityIndicator color={colors.spinner} /> : null}
          <Chips<string> testID="pe-broker" options={brokers.map((m) => ({ value: m.id, label: m.me ? `${m.name} (${t(lang, 'me')})` : m.name }))} value={brokerId} onChange={(v) => setBrokerId(v === brokerId ? '' : v)} />
        </>
      ) : null}
      {error ? <Text testID="pe-error" style={{ color: colors.danger }}>{error}</Text> : null}
      <Button testID="pe-save" label={t(lang, 'peSave')} onPress={save} disabled={saving || !enquiry} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.md }, h: { fontSize: 18, fontWeight: '700' } });
