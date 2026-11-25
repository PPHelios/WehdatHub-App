import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../auth';
import { AppText as Text } from '../components/AppText';
import { BusySwitch } from '../components/BusySwitch';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { HubTabs, type HubTabItem } from '../components/HubTabs';
import { toast } from '../components/Toast';
import { APP_BUILD, APP_VERSION } from '../config';
import { syncDirection } from '../direction';
import { clearDraft } from '../draft';
import { t } from '../i18n';
import { listsStore } from '../lists';
import { lockAvailable, useLock } from '../lock';
import type { RootStackParams } from '../navigation';
import { usePrefs } from '../prefs';
import { stopPush } from '../push';
import { meOptions } from '../queries';
import { hasNavApp, useRightsState } from '../rights';
import { radius, spacing, useTheme } from '../theme';
import { NotificationsScreen } from './NotificationsScreen';
import { UsageScreen } from './MoreScreens';
import { ReportScreen } from './InsightsScreens';

export type SettingsHubTab = 'app' | 'notifications' | 'plan' | 'support';

const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  owner: { ar: 'مالك', en: 'Owner' },
  manager: { ar: 'مدير', en: 'Manager' },
  team_lead: { ar: 'قائد فريق', en: 'Team lead' },
  broker: { ar: 'بروكر', en: 'Broker' },
  data_entry: { ar: 'إدخال بيانات', en: 'Data entry' },
};

export function SettingsHubScreen() {
  const { colors, elev } = useTheme();
  const { broker, signOut } = useAuth();
  const lang = broker?.lang ?? 'ar';
  const ar = lang === 'ar';
  const route = useRoute<RouteProp<RootStackParams, 'SettingsHub'>>();
  const [tab, setTab] = useState<SettingsHubTab>(route.params?.initialTab ?? 'app');

  const queries = useQueryClient();
  const { appearance, clientLang, setAppearance, setClientLang } = usePrefs();
  const setLang = useAuth((a) => a.setLang);

  const changeLang = async (l: 'ar' | 'en') => {
    await api.setLang(l).catch(() => undefined);
    await setLang(l);
    if (syncDirection(l)) toast(t(l, 'restartForLayout'));
  };

  const [busy, setBusy] = useState(false);
  const { enabled, enable, disable } = useLock();
  const [lockMsg, setLockMsg] = useState<string | null>(null);
  const [canLock, setCanLock] = useState(true);

  useEffect(() => {
    void lockAvailable().then(setCanLock);
  }, []);

  const signedIn = useAuth((a) => a.status === 'signedIn');
  const me = useQuery(meOptions(signedIn));
  const { rights, nav } = useRightsState();
  const ts = me.data?.testSwitch ?? null;

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
      await stopPush();
      await api.logout().catch(() => {});
      queries.clear();
      await listsStore.removeClient();
      await clearDraft();
      await useLock.getState().disable();
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  const showPlanTab = nav ? (hasNavApp(nav, 'Plan') || hasNavApp(nav, 'Usage')) : (rights.manager || rights.agencyOwner);
  const tabs: readonly HubTabItem<SettingsHubTab>[] = [
    { id: 'app', label: ar ? 'إعدادات التطبيق' : 'App Settings', testID: 'hub-tab-app' },
    { id: 'notifications', label: ar ? 'إعدادات التنبيهات' : 'Notifications', testID: 'hub-tab-notifications' },
    ...(showPlanTab ? [{ id: 'plan' as const, label: ar ? 'الباقة والاستهلاك' : 'Plan & Usage', testID: 'hub-tab-plan' }] : []),
    { id: 'support', label: ar ? 'الدعم والتطبيق' : 'Support & About', testID: 'hub-tab-support' },
  ];
  const activeTab: SettingsHubTab = tabs.some((x) => x.id === tab) ? tab : 'app';

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <HubTabs tabs={tabs} active={activeTab} onSelect={setTab} testID="settings-hub-tabs" />
      <View style={styles.flex}>
        {activeTab === 'app' ? (
          <ScrollView contentContainerStyle={styles.pad} style={{ backgroundColor: colors.bg }}>
            <View style={[styles.card, elev('md'), { borderColor: colors.border, backgroundColor: colors.card }]} testID="app-settings">
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t(lang, 'appearance')}</Text>
              <Chips
                testID="appearance"
                value={appearance}
                options={[
                  { value: 'system' as const, label: t(lang, 'appSystem') },
                  { value: 'light' as const, label: t(lang, 'appLight') },
                  { value: 'dark' as const, label: t(lang, 'appDark') },
                ]}
                onChange={setAppearance}
              />
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t(lang, 'languageTitle')}</Text>
              <Chips
                testID="app-lang"
                value={lang}
                options={[
                  { value: 'ar' as const, label: 'العربية' },
                  { value: 'en' as const, label: 'English' },
                ]}
                onChange={(l) => { void changeLang(l); }}
              />
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t(lang, 'clientLangTitle')}</Text>
              <Chips
                testID="client-lang"
                value={clientLang}
                options={[
                  { value: 'ar' as const, label: 'العربية' },
                  { value: 'en' as const, label: 'English' },
                ]}
                onChange={setClientLang}
              />
              <Text style={{ color: colors.muted }}>{t(lang, 'clientLangHint')}</Text>
            </View>

            {canLock || enabled ? (
              <View style={[styles.card, elev('sm'), { borderColor: colors.border, backgroundColor: colors.card }]}>
                <View style={styles.switchRow}>
                  <Text style={[styles.flex, { color: colors.text }]}>{t(lang, 'lockSetting')}</Text>
                  <BusySwitch
                    testID="lock-switch"
                    value={enabled}
                    onValueChange={toggleLock}
                    trackColor={{ true: colors.primary, false: colors.border }}
                    thumbColor={enabled ? colors.onPrimary : colors.muted}
                  />
                </View>
                {lockMsg ? <Text style={{ color: colors.danger, textAlign: ar ? 'right' : 'left' }}>{lockMsg}</Text> : null}
              </View>
            ) : null}

            <View style={{ marginTop: spacing.md }}>
              <Button
                testID="sign-out"
                label={t(lang, 'signOut')}
                onPress={out}
                loading={busy}
                variant="danger"
                size="md"
              />
            </View>
          </ScrollView>
        ) : null}

        {activeTab === 'notifications' ? <NotificationsScreen /> : null}

        {activeTab === 'plan' ? <UsageScreen /> : null}

        {activeTab === 'support' ? (
          <ScrollView contentContainerStyle={styles.pad} style={{ backgroundColor: colors.bg }}>
            <ReportScreen />
            {ts ? (
              <View style={[styles.card, elev('md'), { borderColor: colors.border, backgroundColor: colors.card, marginTop: spacing.md }]} testID="test-switch">
                <Text style={[styles.cardTitle, { color: colors.text }]}>{ar ? 'تبديل الاختبار' : 'Test switch'}</Text>
                <Chips
                  testID="test-role"
                  value={ts.role}
                  options={ts.roles.map((r) => ({ value: r, label: ROLE_LABELS[r]?.[lang] ?? r }))}
                  onChange={(r) => { void switchRole(r); }}
                />
                {ts.canView ? (
                  <Chips
                    testID="test-view"
                    value={ts.viewing ? 'other' : 'home'}
                    options={[
                      { value: 'home' as const, label: ar ? 'شركة التجربة' : 'Test agency' },
                      { value: 'other' as const, label: ar ? 'NCH (للقراءة فقط)' : 'NCH (read only)' },
                    ]}
                    onChange={(v) => { void switchView(v); }}
                  />
                ) : null}
              </View>
            ) : null}
            <Text testID="app-version" style={[styles.version, { color: colors.muted }]}>
              {t(lang, 'appVersionLabel')}: {APP_VERSION} ({APP_BUILD})
            </Text>
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: spacing.lg, gap: spacing.md },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  cardTitle: { fontSize: 14, fontWeight: '700', marginTop: spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  version: { textAlign: 'center', fontSize: 12, marginTop: spacing.lg },
});
