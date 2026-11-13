import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth';
import { t } from '../i18n';
import { spacing, useTheme } from '../theme';
import { Button } from './Button';
import { Field } from './Field';

/** Draft style and quiet line for everyone; the two agency switches only when the server sends them (agency owner). */
export function AppSettings() {
  const { colors } = useTheme();
  const lang = useAuth((s) => s.broker?.lang) ?? 'ar';
  const q = useQuery({ queryKey: ['app-settings'], queryFn: () => api.appSettings() });
  const [style, setStyle] = useState('');
  const [quiet, setQuiet] = useState(true);
  const [sw, setSw] = useState<{ brokersMayWrite: boolean; dataEntryOwners: boolean } | null>(null);
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
        <Switch testID="quietline-switch" value={quiet} onValueChange={setQuiet} />
      </View>
      {sw ? (
        <>
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'agencySwitches')}</Text>
          <View style={styles.row}>
            <Text style={[styles.flex, { color: colors.text }]}>{t(lang, 'brokersMayWriteLabel')}</Text>
            <Switch testID="sw-write" value={sw.brokersMayWrite} onValueChange={(v) => setSw({ ...sw, brokersMayWrite: v })} />
          </View>
          <View style={styles.row}>
            <Text style={[styles.flex, { color: colors.text }]}>{t(lang, 'dataEntryOwnersLabel')}</Text>
            <Switch testID="sw-owners" value={sw.dataEntryOwners} onValueChange={(v) => setSw({ ...sw, dataEntryOwners: v })} />
          </View>
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
