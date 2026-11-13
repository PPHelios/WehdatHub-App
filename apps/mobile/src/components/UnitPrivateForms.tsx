import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ApiClientError } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { errorText } from '../errors';
import { t } from '../i18n';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Field } from './Field';
import { Section } from './Section';

/** Lease of a rented unit (the server says whether the unit is for rent) and the agency-only details. The server checks who may change them. */
export function UnitPrivateForms({ code }: { code: string }) {
  const lang = currentLang();
  const { colors } = useTheme();
  const lease = useQuery({ queryKey: ['unit', code, 'lease'], queryFn: () => api.unitLease(code), retry: false });
  const [f, setF] = useState({ startDate: '', months: '12', rent: '', increasePct: '', tenantName: '', remind: false });
  const [loaded, setLoaded] = useState(false);
  const [priv, setPriv] = useState({ pin: '', unitNo: '', address: '' });
  const [msg, setMsg] = useState<string | null>(null);
  if (lease.data && !loaded) {
    setLoaded(true);
    const l = lease.data.lease;
    if (l) setF({ startDate: l.startDate, months: String(l.months), rent: l.rent === null ? '' : String(l.rent), increasePct: l.increasePct === null ? '' : String(l.increasePct), tenantName: l.tenantName ?? '', remind: l.remind });
  }
  const run = async (fn: () => Promise<unknown>, bad: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg(t(lang, 'savedOk'));
      await lease.refetch();
    } catch (e) {
      setMsg(e instanceof ApiClientError && e.status === 422 ? bad : errorText(e, lang));
    }
  };
  return (
    <>
      {lease.data?.rent ? (
        <Section testID="sec-lease" title={t(lang, 'leaseTitle')}>
          <Field label={t(lang, 'leaseStart')} value={f.startDate} onChangeText={(v) => setF({ ...f, startDate: v })} />
          <Field label={t(lang, 'leaseMonths')} value={f.months} onChangeText={(v) => setF({ ...f, months: v })} keyboardType="number-pad" />
          <Field label={t(lang, 'leaseRent')} value={f.rent} onChangeText={(v) => setF({ ...f, rent: v })} keyboardType="number-pad" />
          <Field label={t(lang, 'leaseIncrease')} value={f.increasePct} onChangeText={(v) => setF({ ...f, increasePct: v })} keyboardType="decimal-pad" />
          <Field label={t(lang, 'leaseTenant')} value={f.tenantName} onChangeText={(v) => setF({ ...f, tenantName: v })} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Switch value={f.remind} onValueChange={(v) => setF({ ...f, remind: v })} />
            <Text style={{ color: colors.text, flex: 1 }}>{t(lang, 'leaseRemind')}</Text>
          </View>
          <Button testID="lease-save" label={t(lang, 'save')} onPress={() => run(() => api.saveUnitLease(code, f), t(lang, 'leaseBad'))} />
          {lease.data.lease ? <Button variant="secondary" label={t(lang, 'leaseRemove')} onPress={() => run(() => api.saveUnitLease(code, { remove: true }), t(lang, 'leaseBad'))} /> : null}
        </Section>
      ) : null}
      <Section testID="sec-private" title={t(lang, 'privateTitle')}>
        <Field label={t(lang, 'privPin')} value={priv.pin} onChangeText={(v) => setPriv({ ...priv, pin: v })} autoCapitalize="none" />
        <Field label={t(lang, 'privUnitNo')} value={priv.unitNo} onChangeText={(v) => setPriv({ ...priv, unitNo: v })} />
        <Field label={t(lang, 'privAddress')} value={priv.address} onChangeText={(v) => setPriv({ ...priv, address: v })} />
        <Button testID="private-save" label={t(lang, 'save')} onPress={() => run(() => api.saveUnitPrivate(code, priv), t(lang, 'privBad'))} />
      </Section>
      {msg ? <Text testID="unit-private-message" style={{ color: colors.accent }}>{msg}</Text> : null}
    </>
  );
}
