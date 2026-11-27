import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { BusySwitch } from './BusySwitch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppSettingsSwitches } from '@wehdathub/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { compressPhoto } from '../compress';
import { pickPhotos } from '../photos';
import { useRights } from '../rights';
import { t } from '../i18n';
import { spacing, typeScale, useTheme } from '../theme';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Field } from './Field';
import { Icon } from './Icon';
import { toast } from './Toast';

/** Draft style and quiet line for everyone, with owner switches selected by the server. */
export function AppSettings() {
  const { colors } = useTheme();
  const lang = useAuth((s) => s.broker?.lang) ?? 'ar';
  const me = useAuth((s) => s.broker);
  const setAvatar = useAuth((s) => s.setAvatar);
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
  const changeAvatar = async () => {
    const [file] = await pickPhotos(1);
    if (!file) return;
    try {
      const r = await api.uploadAvatar(await compressPhoto(file, 512));
      await setAvatar(r.avatarUrl);
      toast(t(lang, 'notifSaved'));
    } catch {
      toast(t(lang, 'notifSaveFail'), true);
    }
  };
  const removeAvatar = async () => {
    try {
      await api.deleteAvatar();
      await setAvatar(null);
      toast(t(lang, 'notifSaved'));
    } catch {
      toast(t(lang, 'notifSaveFail'), true);
    }
  };
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
      <View style={styles.avatarBox}>
        <View>
          <Avatar name={me?.name ?? null} uri={me?.avatarUrl} size={96} />
          <Pressable testID="avatar-pick" accessibilityRole="button" accessibilityLabel={t(lang, 'avatarChange')} onPress={changeAvatar} style={[styles.camera, { backgroundColor: colors.primary, borderColor: colors.bg }]}>
            <Icon name="edit" color={colors.onPrimary} size={16} />
          </Pressable>
        </View>
        {me?.avatarUrl ? <Button testID="avatar-remove" size="sm" variant="secondary" label={t(lang, 'avatarRemove')} onPress={removeAvatar} /> : null}
      </View>
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
            ['dataEntryMissingPhotos', 'Show “Units missing photos” to data entry and managers', 'عرض «وحدات من غير صور» لإدخال البيانات والمديرين', false],
            ['dataEntryOverdueUnits', 'Show “Units needing review” to data entry and managers', 'عرض «وحدات محتاجة مراجعة» لإدخال البيانات والمديرين', false],
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
  h: { fontSize: typeScale.heading.fontSize, fontWeight: '700' },
  avatarBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
