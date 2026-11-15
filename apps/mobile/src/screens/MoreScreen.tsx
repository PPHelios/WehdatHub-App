import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';

/** Role names for the test switch (the test number only). */
const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  owner: { ar: 'مالك', en: 'Owner' },
  manager: { ar: 'مدير', en: 'Manager' },
  team_lead: { ar: 'قائد فريق', en: 'Team lead' },
  broker: { ar: 'بروكر', en: 'Broker' },
  data_entry: { ar: 'إدخال بيانات', en: 'Data entry' },
};
import { listsStore } from '../lists';
import { clearDraft } from '../draft';
import { t } from '../i18n';
import { lockAvailable, useLock } from '../lock';
import { useRights } from '../rights';
import { moreItems, navPlan } from '../roleNav';
import type { MoreScreenName } from '../roleNav';
import { stopPush } from '../push';
import { spacing, useTheme } from '../theme';
import { usePrefs } from '../prefs';
import { APP_BUILD, APP_VERSION } from '../config';
import { syncDirection } from '../direction';

export function MoreScreen({ onOpen }: { onOpen?: (screen: MoreScreenName) => void } = {}) {
  const { colors } = useTheme();
  const { broker, agencyName, signOut } = useAuth();
  const queries = useQueryClient();
  const { appearance, clientLang, setAppearance, setClientLang } = usePrefs();
  const setLang = useAuth((a) => a.setLang);
  // The app language button: saved on the server too, so the website and the bot follow. The layout flips once the app is reopened.
  const changeLang = async (l: 'ar' | 'en') => {
    await api.setLang(l).catch(() => undefined);
    await setLang(l);
    if (syncDirection(l)) Alert.alert(t(l, 'restartForLayout'));
  };
  const [busy, setBusy] = useState(false);
  const lang = broker?.lang ?? 'ar';
  const rights = useRights();
  const { enabled, enable, disable } = useLock();
  const [lockMsg, setLockMsg] = useState<string | null>(null);
  const [canLock, setCanLock] = useState(true);
  useEffect(() => {
    void lockAvailable().then(setCanLock);
  }, []);
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.me(), staleTime: 5 * 60_000 });
  const ts = me.data?.testSwitch ?? null;
  const items = moreItems(rights, navPlan(rights).tabs, Boolean(me.data?.platformOwner));
  // A switch changes what the app may show, so every query is refetched after it.
  const switchRole = async (role: string) => {
    await api.testRole(role).catch(() => {});
    await queries.invalidateQueries();
  };
  const switchView = async (view: 'home' | 'other') => {
    await api.testView(view).catch(() => {});
    await queries.invalidateQueries();
  };
  const toggleLock = async (on: boolean) => {
    setLockMsg(null);
    if (!on) return disable();
    if (!(await enable())) setLockMsg(t(lang, 'lockUnavailable'));
  };
  const out = async () => {
    setBusy(true);
    try {
      await stopPush(); // while the session still works
      await api.logout().catch(() => {}); // the phone signs out even when the server can't be reached
      queries.clear();
      await listsStore.removeClient();
      await clearDraft();
      await useLock.getState().disable();
      await signOut();
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.body, { backgroundColor: colors.bg }]}>
      <Text style={[styles.name, { color: colors.text }]}>{broker?.name}</Text>
      {agencyName ? <Text style={[styles.agency, { color: colors.muted }]}>{t(lang, 'agency')}: {agencyName}</Text> : null}
      {onOpen ? items.map((it) => <Button key={it.id} testID={`open-${it.id}`} label={`${it.icon} ${t(lang, it.label)}`} variant="secondary" onPress={() => onOpen(it.screen)} />) : null}
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]} testID="app-settings">
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t(lang, 'appearance')}</Text>
        <Chips testID="appearance" value={appearance} options={[{ value: 'system' as const, label: t(lang, 'appSystem') }, { value: 'light' as const, label: t(lang, 'appLight') }, { value: 'dark' as const, label: t(lang, 'appDark') }]} onChange={setAppearance} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t(lang, 'languageTitle')}</Text>
        <Chips testID="app-lang" value={lang} options={[{ value: 'ar' as const, label: 'العربية' }, { value: 'en' as const, label: 'English' }]} onChange={(l) => { void changeLang(l); }} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t(lang, 'clientLangTitle')}</Text>
        <Chips testID="client-lang" value={clientLang} options={[{ value: 'ar' as const, label: 'العربية' }, { value: 'en' as const, label: 'English' }]} onChange={setClientLang} />
        <Text style={{ color: colors.muted }}>{t(lang, 'clientLangHint')}</Text>
      </View>
      {ts ? (
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]} testID="test-switch">
          <Text style={[styles.cardTitle, { color: colors.text }]}>{lang === 'ar' ? 'تبديل الاختبار' : 'Test switch'}</Text>
          <Chips testID="test-role" value={ts.role} options={ts.roles.map((r) => ({ value: r, label: ROLE_LABELS[r]?.[lang] ?? r }))} onChange={(r) => { void switchRole(r); }} />
          {ts.canView ? (
            <Chips testID="test-view" value={ts.viewing ? 'other' : 'home'} options={[{ value: 'home' as const, label: lang === 'ar' ? 'شركة التجربة' : 'Test agency' }, { value: 'other' as const, label: lang === 'ar' ? 'NCH (للقراءة فقط)' : 'NCH (read only)' }]} onChange={(v) => { void switchView(v); }} />
          ) : null}
        </View>
      ) : null}
      {canLock || enabled ? <View style={styles.switchRow}><Text style={[styles.flex, { color: colors.text }]}>{t(lang, 'lockSetting')}</Text><Switch testID="lock-switch" value={enabled} onValueChange={toggleLock} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={enabled ? colors.onPrimary : colors.muted} /></View> : null}
      {lockMsg ? <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, textAlign: lang === 'ar' ? 'right' : 'left' }}>{lockMsg}</Text> : null}
      <Text testID="app-version" style={{ color: colors.muted }}>{t(lang, 'appVersionLabel')}: {APP_VERSION} ({APP_BUILD})</Text>
      <Button testID="sign-out" label={t(lang, 'signOut')} onPress={out} loading={busy} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 1, padding: spacing.xl, gap: spacing.md },
  name: { fontSize: 22, fontWeight: '700' },
  agency: { fontSize: 16, marginBottom: spacing.lg },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  card: { borderWidth: 1, borderRadius: 16, padding: spacing.md, gap: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  flex: { flex: 1 },
});
