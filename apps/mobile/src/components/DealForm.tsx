import React, { useRef, useState } from 'react';
import { Text } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { errorText } from '../errors';
import { t } from '../i18n';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Chips } from './Chips';
import { Field } from './Field';

const hex = () => Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

/** Records a deal: client (L-0042), unit code, price and commission (2% or an amount); the same fields as the website. One idem key per form, so a double tap saves once. */
export function DealForm({ lead, unit }: { lead?: string; unit?: string }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const qc = useQueryClient();
  const idem = useRef(hex());
  const [f, setF] = useState({ lead: lead ?? '', unit: unit ?? '', price: '', commission: '', deal_type: 'sale', status: 'pending', mark_sold: '1' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.createDeal({ ...f, idem: idem.current });
      setMsg(`${t(lang, 'dealSaved')} ${r.ref}`);
      await qc.invalidateQueries({ queryKey: ['deals'] });
    } catch (e) {
      setMsg(errorText(e, lang));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Field testID="deal-lead" label={t(lang, 'dealLead')} value={f.lead} onChangeText={(v) => setF({ ...f, lead: v })} autoCapitalize="characters" />
      <Field testID="deal-unit" label={t(lang, 'dealUnit')} value={f.unit} onChangeText={(v) => setF({ ...f, unit: v })} autoCapitalize="characters" />
      <Field testID="deal-price" label={t(lang, 'fPrice')} value={f.price} onChangeText={(v) => setF({ ...f, price: v })} />
      <Field testID="deal-commission" label={t(lang, 'dealCommission')} value={f.commission} onChangeText={(v) => setF({ ...f, commission: v })} />
      <Chips options={[{ value: 'sale', label: t(lang, 'sale') }, { value: 'rent', label: t(lang, 'rent') }]} value={f.deal_type} onChange={(v) => setF({ ...f, deal_type: v })} />
      <Button testID="deal-save" label={t(lang, 'save')} onPress={save} loading={busy} disabled={!f.commission.trim() || !f.lead.trim()} />
      {msg ? <Text testID="deal-msg" style={{ color: colors.accent }}>{msg}</Text> : null}
    </>
  );
}
