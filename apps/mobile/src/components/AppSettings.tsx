import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { BusySwitch } from './BusySwitch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppSettingsSwitches } from '@wehdathub/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { pickPhotos } from '../photos';
import { useRights } from '../rights';
import { t } from '../i18n';
import { spacing, useTheme } from '../theme';
import { Button } from './Button';
import { Field } from './Field';

/** Draft style and quiet line for everyone, with owner switches selected by the server. */
export function AppSettings() {
  const { colors } = useTheme();
  const lang = useAuth((s) => s.broker?.lang) ?? 'ar';
  const rights = useRights();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['app-settings'], queryFn: () => api.appSettings() });
  const [style, setStyle] = useState('');
  const [quiet, setQuiet] = useState(true);
  const [sw, setSw] = useState<AppSettingsSwitches | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!q.data) return;
    setStyle(q.data.draftStyle);
    setQuiet(q.data.quietLine);
    setSw(q.data.switches);
  }, [q.data]);
  if (!q.data) return null;
  const save = async () => {
    setBusy(true);
    try {
      await api.saveAppSettings({ draftStyle: style, quietLine: quiet, ...(sw ? { switches: sw } : {}) });
      await Promise.all(['app-settings', 'me', 'unit', 'units', 'lead', 'leads', 'today'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      setMsg(t(lang, 'notifSaved'));
    } catch {
      setMsg(t(lang, 'notifSaveFail'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.box}>
      <Text style={[styles.h, { color: colors.text }]}>⚙️ {t(lang, 'myDefaults')}</Text>
      <Field label={t(lang, 'draftStyleLabel')} value={style} onChangeText={setStyle} multiline />
      <View style={styles.row}>
        <Text style={[styles.flex, { color: colors.text }]}>{t(lang, 'quietLineLabel')}</Text>
        <BusySwitch testID="quietline-switch" value={quiet} onValueChange={setQuiet} />
      </View>
      {sw ? (
        <>
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'agencySwitches')}</Text>
          {typeof sw.brokersMayWrite === 'boolean' ? (
            <View style={styles.row}>
              <Text style={[styles.flex, { color: colors.text }]}>{t(lang, 'brokersMayWriteLabel')}</Text>
              <BusySwitch testID="sw-write" value={sw.brokersMayWrite} onValueChange={(v) => setSw({ ...sw, brokersMayWrite: v })} />
            </View>
          ) : null}
          {typeof sw.dataEntryOwners === 'boolean' ? (
            <View style={styles.row}>
              <Text style={[styles.flex, { color: colors.text }]}>{t(lang, 'dataEntryOwnersLabel')}</Text>
              <BusySwitch testID="sw-owners" value={sw.dataEntryOwners} onValueChange={(v) => setSw({ ...sw, dataEntryOwners: v })} />
            </View>
          ) : null}
          {([
            ['dataEntryMissingPhotos', 'Show “Units missing photos” to data entry', 'عرض «وحدات من غير صور» لإدخال البيانات', false],
            ['dataEntryOverdueUnits', 'Show “Units needing review” to data entry', 'عرض «وحدات محتاجة مراجعة» لإدخال البيانات', false],
            ['brokersEditColleagueUnits', 'Can edit colleagues’ units', 'البروكرز يقدروا يعدّلوا وحدات زمايلهم', !sw.brokersMayWrite],
            ['brokersSeeAllLeads', 'Brokers see all shared leads', 'البروكرز يشوفوا كل العملاء المشتركين', false],
            ['brokersWorkSharedLeads', 'Brokers can work shared leads', 'البروكرز يقدروا يتابعوا العملاء المشتركين', !sw.brokersSeeAllLeads],
          ] as const).map(([key, en, ar, disabled]) => typeof sw[key] === 'boolean' && (
            <View key={key} style={styles.row}>
              <Text style={[styles.flex, { color: colors.text }]}>{lang === 'ar' ? ar : en}</Text>
              <BusySwitch testID={key} accessibilityLabel={lang === 'ar' ? ar : en} disabled={busy || disabled} value={sw[key]} onValueChange={(value) => setSw({ ...sw, [key]: value })} />
            </View>
          ))}
        </>
      ) : null}
      {rights.manager || rights.agencyOwner ? (
        <>
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'logoTitle')}</Text>
          <Button testID="logo-pick" variant="secondary" label={t(lang, 'logoPick')} onPress={async () => { const [file] = await pickPhotos(1); if (!file) return; try { await api.uploadLogo(file); setMsg(t(lang, 'notifSaved')); } catch { setMsg(t(lang, 'notifSaveFail')); } }} />
          <Button testID="logo-remove" variant="secondary" label={t(lang, 'logoRemove')} onPress={async () => { try { await api.removeLogo(); setMsg(t(lang, 'notifSaved')); } catch { setMsg(t(lang, 'notifSaveFail')); } }} />
        </>
      ) : null}
      {msg ? <Text style={{ color: colors.muted }}>{msg}</Text> : null}
      <Button testID="save-app-settings" label={t(lang, 'save')} onPress={save} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md, marginTop: spacing.md },
  h: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
