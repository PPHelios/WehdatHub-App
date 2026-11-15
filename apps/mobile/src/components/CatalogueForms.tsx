import React, { useState } from 'react';
import { Text } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { errorText } from '../errors';
import { t } from '../i18n';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Field } from './Field';
import { Section } from './Section';

/** Managers add a developer or a project (name, place, delivery); files and price sheets stay on the website. */
export function CatalogueForms() {
  const { colors } = useTheme();
  const lang = currentLang();
  const qc = useQueryClient();
  const [dev, setDev] = useState({ name: '', contact_name: '', contact_phone: '' });
  const [pr, setPr] = useState({ name: '', city: '', district: '', delivery_year: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
      setMsg(t(lang, 'savedOk'));
      await qc.invalidateQueries({ queryKey: ['catalogue'] });
    } catch (e) {
      setMsg(errorText(e, lang));
    }
  };
  return (
    <>
      <Section testID="sec-add-developer" title={t(lang, 'addDeveloper')}>
        <Field label={t(lang, 'catName')} value={dev.name} onChangeText={(v) => setDev({ ...dev, name: v })} />
        <Field label={t(lang, 'catContact')} value={dev.contact_name} onChangeText={(v) => setDev({ ...dev, contact_name: v })} />
        <Field label={t(lang, 'catPhone')} value={dev.contact_phone} onChangeText={(v) => setDev({ ...dev, contact_phone: v })} keyboardType="phone-pad" />
        <Button testID="developer-save" label={t(lang, 'save')} onPress={() => run(() => api.saveDeveloper(dev))} disabled={!dev.name.trim()} />
      </Section>
      <Section testID="sec-add-project" title={t(lang, 'addProject')}>
        <Field label={t(lang, 'catName')} value={pr.name} onChangeText={(v) => setPr({ ...pr, name: v })} />
        <Field label={t(lang, 'fCity')} value={pr.city} onChangeText={(v) => setPr({ ...pr, city: v })} />
        <Field label={t(lang, 'fDistrict')} value={pr.district} onChangeText={(v) => setPr({ ...pr, district: v })} />
        <Field label={t(lang, 'fDelivery')} value={pr.delivery_year} onChangeText={(v) => setPr({ ...pr, delivery_year: v })} keyboardType="number-pad" />
        <Button testID="project-save" label={t(lang, 'save')} onPress={() => run(() => api.saveProject(pr))} disabled={!pr.name.trim()} />
      </Section>
      {msg ? <Text style={{ color: colors.accent }}>{msg}</Text> : null}
    </>
  );
}
