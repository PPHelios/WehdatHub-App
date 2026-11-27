import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText as Text } from '../components/AppText';
import { BusySwitch } from '../components/BusySwitch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chips } from '../components/Chips';
import { AppSettings } from '../components/AppSettings';
import { Chevron, Icon, type IconName } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { listsStore } from '../lists';
import { clearDraft } from '../draft';
import { t } from '../i18n';
import { lockAvailable, useLock } from '../lock';
import { hasNavApp, useRightsState } from '../rights';
import { meOptions } from '../queries';
import type { MoreScreenName } from '../roleNav';
import { stopPush } from '../push';
import { radius, spacing, useTheme } from '../theme';
import { usePrefs } from '../prefs';
import { APP_BUILD, APP_VERSION } from '../config';
import { syncDirection } from '../direction';
import { toast } from '../components/Toast';
import { enter, layout } from '../motion';

const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  owner: { ar: 'مالك', en: 'Owner' },
  manager: { ar: 'مدير', en: 'Manager' },
  team_lead: { ar: 'قائد فريق', en: 'Team lead' },
  broker: { ar: 'بروكر', en: 'Broker' },
  data_entry: { ar: 'إدخال بيانات', en: 'Data entry' },
};

function HubCard({
  title,
  subtitle,
  icon,
  rtl,
  testID,
  index,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  rtl: boolean;
  testID: string;
  index: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={enter(Math.min(index, 8))} layout={layout}>
      <Card variant="elevated" testID={testID} onPress={onPress} style={styles.hubCard}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
          <Icon name={icon} color={colors.primaryInk} size={22} />
        </View>
        <View style={styles.hubCopy}>
          <Text variant="body" weight="bold" style={{ color: colors.text }}>{title}</Text>
          <Text variant="caption" numberOfLines={2} style={{ color: colors.muted }}>{subtitle}</Text>
        </View>
        <Chevron rtl={rtl} color={colors.muted} />
      </Card>
    </Animated.View>
  );
}

/** One row of a grouped settings list: 52px min height, chevron flips in RTL, separator drawn by the group. */
function SettingsRow({ label, testID, rtl, last, onPress }: { label: string; testID: string; rtl: boolean; last?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.setRow, !last && styles.setRowSep, !last && { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.primarySoft }]}
    >
      <Text variant="body" style={[styles.flex, { color: colors.text }]}>{label}</Text>
      <Chevron rtl={rtl} color={colors.muted} />
    </Pressable>
  );
}

export function MoreScreen({ onOpen, mode = 'menu' }: { onOpen?: (screen: MoreScreenName) => void; mode?: 'menu' | 'settings' } = {}) {
  const { colors } = useTheme();
  const { broker, agencyName, signOut } = useAuth();
  const queries = useQueryClient();
  const { appearance, clientLang, setAppearance, setClientLang } = usePrefs();
  const setLang = useAuth((a) => a.setLang);

  const changeLang = async (l: 'ar' | 'en') => {
    await api.setLang(l).catch(() => undefined);
    await setLang(l);
    if (syncDirection(l)) toast(t(l, 'restartForLayout'));
  };

  const [busy, setBusy] = useState(false);
  const lang = broker?.lang ?? 'ar';
  const rtl = lang === 'ar';
  const { rights, nav, workspace } = useRightsState();
  const isSolo = Boolean(workspace?.solo || workspace?.mode === 'solo');
  const { enabled, enable, disable } = useLock();
  const [lockMsg, setLockMsg] = useState<string | null>(null);
  const [canLock, setCanLock] = useState(true);

  useEffect(() => {
    void lockAvailable().then(setCanLock);
  }, []);

  const signedIn = useAuth((a) => a.status === 'signedIn');
  const me = useQuery(meOptions(signedIn));
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

  const signOutButton = (
    <Button testID="sign-out" label={t(lang, 'signOut')} onPress={out} loading={busy} variant="secondary" size={mode === 'menu' ? 'sm' : 'md'} />
  );

  const isManagerOrOwner = Boolean(rights.manager || rights.agencyOwner);
  let hubIndex = 0;
  const hub = (testID: string, title: string, subtitle: string, icon: IconName, target: MoreScreenName) => (
    <HubCard key={testID} testID={testID} title={title} subtitle={subtitle} icon={icon} rtl={rtl} index={hubIndex++} onPress={() => onOpen?.(target)} />
  );

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.body, { backgroundColor: colors.bg }]}>
      {mode === 'menu' ? (
        <Pressable
          testID="more-profile"
          accessibilityRole="button"
          onPress={() => onOpen?.('SettingsHub')}
          style={({ pressed }) => [
            styles.profile,
            { backgroundColor: colors.primarySoft, borderColor: colors.primaryLine },
            pressed && styles.pressed,
          ]}
        >
          <Avatar name={broker?.name ?? null} uri={broker?.avatarUrl} />
          <View style={styles.profileCopy}>
            <Text variant="body" weight="bold" style={{ color: colors.text }}>{broker?.name}</Text>
            <View style={styles.inline}>
              <Text style={{ color: colors.muted }}>{agencyName ? `${agencyName} · ` : ''}{t(lang, 'mrAccountSettings')}</Text>
              <Icon name="settings" size={14} color={colors.muted} />
            </View>
          </View>
          <Chevron rtl={rtl} color={colors.primaryInk} />
        </Pressable>
      ) : (
        <>
          <Text variant="title" style={{ color: colors.text }}>{broker?.name}</Text>
          {agencyName ? <Text variant="bodySm" style={{ color: colors.muted }}>{t(lang, 'agency')}: {agencyName}</Text> : null}
        </>
      )}

      {mode === 'menu' ? (
        <View style={styles.hubContainer}>
          {hub('hub-clients', t(lang, 'mrHubClients'), t(lang, 'mrHubClientsSub'), 'leads', 'ClientsHub')}
          {hub('hub-projects', t(lang, 'mrHubProjects'), t(lang, 'mrHubProjectsSub'), 'catalogue', 'ProjectsHub')}
          {hub('hub-tracking', t(lang, 'mrHubTracking'), t(lang, 'mrHubTrackingSub'), 'link', 'TrackingHub')}
          {hub('hub-deals', t(lang, 'mrHubDeals'), t(lang, 'mrHubDealsSub'), 'deal', 'DealsHub')}

          {isManagerOrOwner && isSolo ? (
            <>
              {hub('hub-mystats', t(lang, 'mrHubStats'), t(lang, 'mrHubStatsSub'), 'chart', 'Dashboard')}
              {(!nav || hasNavApp(nav, 'Portal')) ? hub('hub-portal', t(lang, 'portal'), t(lang, 'mrHubPortalSub'), 'building', 'Portal') : null}
              {(!nav || hasNavApp(nav, 'Plan')) ? hub('hub-plan-teammate', t(lang, 'mrHubPlanTeam'), t(lang, 'mrHubPlanTeamSub'), 'plan', 'Plan') : null}
            </>
          ) : null}

          {isManagerOrOwner && !isSolo ? (
            <>
              {(rights.team || !nav || hasNavApp(nav, 'Team') || hasNavApp(nav, 'LeadRules') || hasNavApp(nav, 'Requests') || hasNavApp(nav, 'Portal'))
                ? hub('hub-admin', t(lang, 'mrHubAdmin'), t(lang, 'mrHubAdminSub'), 'team', 'AdminHub') : null}
              {(!nav || hasNavApp(nav, 'Dashboard') || hasNavApp(nav, 'WinLoss') || hasNavApp(nav, 'Sources') || hasNavApp(nav, 'ActivityLog'))
                ? hub('hub-reports', t(lang, 'mrHubReports'), t(lang, 'mrHubReportsSub'), 'chart', 'ReportsHub') : null}
            </>
          ) : null}

          {rights.owners ? hub('open-owners', t(lang, 'owners'), t(lang, 'mrHubOwnersSub'), 'owners', 'Owners') : null}
        </View>
      ) : null}

      {mode === 'settings' ? (
        <>
          <Text testID="settings-me" variant="heading" style={[styles.section, { color: colors.text }]}>{t(lang, 'mrMe')}</Text>
          <AppSettings />
          <Card variant="elevated" style={styles.group}>
            <SettingsRow testID="settings-open-notifications" label={t(lang, 'notifications')} rtl={rtl} last onPress={() => onOpen?.('Notifications')} />
          </Card>
          <Card variant="elevated" testID="app-settings" style={styles.groupPad}>
            <Text variant="bodySm" weight="bold" style={{ color: colors.text }}>{t(lang, 'appearance')}</Text>
            <Chips testID="appearance" value={appearance} options={[{ value: 'system' as const, label: t(lang, 'appSystem') }, { value: 'light' as const, label: t(lang, 'appLight') }, { value: 'dark' as const, label: t(lang, 'appDark') }]} onChange={setAppearance} />
            <Text variant="bodySm" weight="bold" style={{ color: colors.text }}>{t(lang, 'languageTitle')}</Text>
            <Chips testID="app-lang" value={lang} options={[{ value: 'ar' as const, label: 'العربية' }, { value: 'en' as const, label: 'English' }]} onChange={(l) => { void changeLang(l); }} />
            <Text variant="bodySm" weight="bold" style={{ color: colors.text }}>{t(lang, 'clientLangTitle')}</Text>
            <Chips testID="client-lang" value={clientLang} options={[{ value: 'ar' as const, label: 'العربية' }, { value: 'en' as const, label: 'English' }]} onChange={setClientLang} />
            <Text variant="caption" style={{ color: colors.muted }}>{t(lang, 'clientLangHint')}</Text>
          </Card>

          {canLock || enabled ? (
            <Card variant="elevated" style={styles.group}>
              <View style={styles.switchRow}>
                <Text variant="body" style={[styles.flex, { color: colors.text }]}>{t(lang, 'lockSetting')}</Text>
                <BusySwitch testID="lock-switch" value={enabled} onValueChange={toggleLock} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={enabled ? colors.onPrimary : colors.muted} />
              </View>
            </Card>
          ) : null}
          {lockMsg ? <Text accessibilityLiveRegion="polite" style={[styles.start, { color: colors.danger, textAlign: rtl ? 'right' : 'left' }]}>{lockMsg}</Text> : null}

          {rights.manager || rights.agencyOwner ? (
            <Card variant="elevated" testID="settings-agency" style={styles.group}>
              <View style={styles.groupHead}>
                <Text variant="heading" style={{ color: colors.text }}>{t(lang, 'mrAgencySection')}</Text>
                <Text variant="bodySm" style={{ color: colors.muted }}>{t(lang, 'mrAgencyHint')}</Text>
              </View>
              <SettingsRow testID="settings-open-usage" label={t(lang, 'mrAiPerPerson')} rtl={rtl} last={!rights.team} onPress={() => onOpen?.('Usage')} />
              {rights.team ? <SettingsRow testID="settings-open-team" label={t(lang, 'team')} rtl={rtl} last onPress={() => onOpen?.('Team')} /> : null}
            </Card>
          ) : null}

          {rights.agencyOwner ? (
            <Card variant="elevated" testID="settings-plan" style={styles.group}>
              <View style={styles.groupHead}>
                <Text variant="heading" style={{ color: colors.text }}>{t(lang, 'mrPlanBilling')}</Text>
              </View>
              <SettingsRow testID="settings-open-plan" label={t(lang, 'plan')} rtl={rtl} last onPress={() => onOpen?.('Plan')} />
            </Card>
          ) : null}
        </>
      ) : null}

      {ts && mode === 'settings' ? (
        <Card variant="elevated" testID="test-switch" style={styles.groupPad}>
          <Text variant="bodySm" weight="bold" style={{ color: colors.text }}>{t(lang, 'mrTestSwitch')}</Text>
          <Chips testID="test-role" value={ts.role} options={ts.roles.map((r) => ({ value: r, label: ROLE_LABELS[r]?.[lang] ?? r }))} onChange={(r) => { void switchRole(r); }} />
          {ts.canView ? (
            <Chips testID="test-view" value={ts.viewing ? 'other' : 'home'} options={[{ value: 'home' as const, label: t(lang, 'mrTestAgency') }, { value: 'other' as const, label: t(lang, 'mrNchRead') }]} onChange={(v) => { void switchView(v); }} />
          ) : null}
        </Card>
      ) : null}

      <View style={styles.footer}>
        <Text variant="caption" testID="app-version" style={[styles.center, { color: colors.muted }]}>
          {t(lang, 'appVersionLabel')}: {APP_VERSION} ({APP_BUILD})
        </Text>
        {mode === 'menu' ? signOutButton : null}
      </View>
      {mode === 'settings' ? signOutButton : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  pressed: { opacity: 0.9 },
  profileCopy: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  section: { marginTop: spacing.sm },
  group: { padding: 0, overflow: 'hidden' },
  groupPad: { padding: spacing.md, gap: spacing.sm },
  groupHead: { padding: spacing.md, gap: spacing.xs },
  setRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  setRowSep: { borderBottomWidth: StyleSheet.hairlineWidth },
  switchRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  start: { paddingHorizontal: spacing.xs },
  center: { textAlign: 'center' },
  hubContainer: { gap: spacing.sm },
  hubCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hubCopy: { flex: 1, gap: 2 },
  footer: { marginTop: spacing.md, alignItems: 'center', gap: spacing.md },
});
