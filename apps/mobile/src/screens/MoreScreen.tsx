import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { BusySwitch } from '../components/BusySwitch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button } from '../components/Button';
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
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  rtl: boolean;
  testID: string;
  onPress: () => void;
}) {
  const { colors, elev } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.hubCard,
        elev('sm'),
        { borderColor: colors.border, backgroundColor: colors.card },
        pressed && { backgroundColor: colors.primarySoft },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} color={colors.primaryInk} size={22} />
      </View>
      <View style={styles.hubCopy}>
        <Text style={[styles.hubTitle, { color: colors.text }]}>{title}</Text>
        <Text numberOfLines={2} style={[styles.hubSubtitle, { color: colors.muted }]}>
          {subtitle}
        </Text>
      </View>
      <Chevron rtl={rtl} color={colors.muted} />
    </Pressable>
  );
}

export function MoreScreen({ onOpen, mode = 'menu' }: { onOpen?: (screen: MoreScreenName) => void; mode?: 'menu' | 'settings' } = {}) {
  const { colors, elev } = useTheme();
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
  const ar = lang === 'ar';
  const rtl = ar;
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
            pressed && { opacity: 0.9 },
          ]}
        >
          <Avatar name={broker?.name ?? null} uri={broker?.avatarUrl} />
          <View style={styles.profileCopy}>
            <Text style={[styles.profileName, { color: colors.text }]}>{broker?.name}</Text>
            <Text style={{ color: colors.muted }}>
              {agencyName ? `${agencyName} · ` : ''}
              {ar ? 'الحساب والإعدادات ⚙️' : 'Account & Settings ⚙️'}
            </Text>
          </View>
          <Chevron rtl={rtl} color={colors.primaryInk} />
        </Pressable>
      ) : (
        <>
          <Text style={[styles.name, { color: colors.text }]}>{broker?.name}</Text>
          {agencyName ? <Text style={[styles.agency, { color: colors.muted }]}>{t(lang, 'agency')}: {agencyName}</Text> : null}
        </>
      )}

      {mode === 'menu' ? (
        <View style={styles.hubContainer}>
          <HubCard
            testID="hub-clients"
            title={ar ? 'العملاء' : 'Clients'}
            subtitle={ar ? 'التقويم والمعاينات · مراحل العملاء · طلبات العملاء · مقارنة الوحدات' : 'Calendar & Viewings · Client Pipeline · Client Requests · Compare Units'}
            icon="leads"
            rtl={rtl}
            onPress={() => onOpen?.('ClientsHub')}
          />
          <HubCard
            testID="hub-projects"
            title={ar ? 'المشاريع' : 'Projects'}
            subtitle={ar ? 'مشاريع الشركة · مكتبة المطورين · سعر المتر · اسأل المساعد' : 'Agency Projects · Developer Library · Price per m² · Ask Assistant'}
            icon="catalogue"
            rtl={rtl}
            onPress={() => onOpen?.('ProjectsHub')}
          />
          <HubCard
            testID="hub-tracking"
            title={ar ? 'المتابعة' : 'Tracking'}
            subtitle={ar ? 'الروابط المفتوحة · عقود الإيجار · البحث المحفوظ' : 'Opened Links · Rental Leases · Saved Searches'}
            icon="link"
            rtl={rtl}
            onPress={() => onOpen?.('TrackingHub')}
          />
          <HubCard
            testID="hub-deals"
            title={ar ? 'الصفقات' : 'Deals'}
            subtitle={ar ? 'صفقات البيع · العمولات' : 'Sales Deals · Commissions'}
            icon="deal"
            rtl={rtl}
            onPress={() => onOpen?.('DealsHub')}
          />

          {isManagerOrOwner && isSolo ? (
            <>
              <HubCard
                testID="hub-mystats"
                title={ar ? 'إحصائياتي' : 'My Stats'}
                subtitle={ar ? 'ملخص العملاء والصفقات والمتابعات' : 'Your leads, deals and follow-ups summary'}
                icon="chart"
                rtl={rtl}
                onPress={() => onOpen?.('Dashboard')}
              />
              {(!nav || hasNavApp(nav, 'Portal')) ? (
                <HubCard
                  testID="hub-portal"
                  title={t(lang, 'portal')}
                  subtitle={ar ? 'استفسارات البوابات العقارية' : 'Portal enquiries directory'}
                  icon="building"
                  rtl={rtl}
                  onPress={() => onOpen?.('Portal')}
                />
              ) : null}
              {(!nav || hasNavApp(nav, 'Plan')) ? (
                <HubCard
                  testID="hub-plan-teammate"
                  title={ar ? 'أضف عضو فريق / الباقة' : 'Add teammate / Plan'}
                  subtitle={ar ? 'ترقية الباقة وإضافة أعضاء للفريق' : 'Upgrade plan and invite teammates'}
                  icon="plan"
                  rtl={rtl}
                  onPress={() => onOpen?.('Plan')}
                />
              ) : null}
            </>
          ) : null}

          {isManagerOrOwner && !isSolo ? (
            <>
              {(rights.team || !nav || hasNavApp(nav, 'Team') || hasNavApp(nav, 'LeadRules') || hasNavApp(nav, 'Requests') || hasNavApp(nav, 'Portal')) ? (
                <HubCard
                  testID="hub-admin"
                  title={ar ? 'إدارة الشركة' : 'Agency Admin'}
                  subtitle={ar ? 'فريق العمل · قواعد التوزيع · طلبات البيانات الخاصة · استفسارات البوابات' : 'Team Members · Lead Rules · Access Requests · Portal Inquiries'}
                  icon="team"
                  rtl={rtl}
                  onPress={() => onOpen?.('AdminHub')}
                />
              ) : null}
              {(!nav || hasNavApp(nav, 'Dashboard') || hasNavApp(nav, 'WinLoss') || hasNavApp(nav, 'Sources') || hasNavApp(nav, 'ActivityLog')) ? (
                <HubCard
                  testID="hub-reports"
                  title={ar ? 'تقارير الشركة' : 'Agency Reports'}
                  subtitle={ar ? 'لوحة الشركة · المكسب والخسارة · مصادر العملاء · سجل النشاط' : 'Agency Dashboard · Win & Loss · Lead Sources · Activity Log'}
                  icon="chart"
                  rtl={rtl}
                  onPress={() => onOpen?.('ReportsHub')}
                />
              ) : null}
            </>
          ) : null}

          {rights.owners ? (
            <Pressable
              testID="open-owners"
              accessibilityRole="button"
              onPress={() => onOpen?.('Owners')}
              style={({ pressed }) => [
                styles.hubCard,
                elev('sm'),
                { borderColor: colors.border, backgroundColor: colors.card },
                pressed && { backgroundColor: colors.primarySoft },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
                <Icon name="owners" color={colors.primaryInk} size={22} />
              </View>
              <View style={styles.hubCopy}>
                <Text style={[styles.hubTitle, { color: colors.text }]}>{t(lang, 'owners')}</Text>
                <Text style={[styles.hubSubtitle, { color: colors.muted }]}>{ar ? 'بيانات المُلّاك ووحداتهم' : 'Property owners directory'}</Text>
              </View>
              <Chevron rtl={rtl} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {mode === 'settings' ? (
        <>
          <Text testID="settings-me" style={[styles.section, { color: colors.text }]}>{ar ? 'أنا' : 'Me'}</Text>
          <AppSettings />
          <Button testID="settings-open-notifications" label={t(lang, 'notifications')} variant="secondary" onPress={() => onOpen?.('Notifications')} />
          <View style={[styles.card, elev('md'), { borderColor: colors.border, backgroundColor: colors.card }]} testID="app-settings">
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t(lang, 'appearance')}</Text>
            <Chips testID="appearance" value={appearance} options={[{ value: 'system' as const, label: t(lang, 'appSystem') }, { value: 'light' as const, label: t(lang, 'appLight') }, { value: 'dark' as const, label: t(lang, 'appDark') }]} onChange={setAppearance} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t(lang, 'languageTitle')}</Text>
            <Chips testID="app-lang" value={lang} options={[{ value: 'ar' as const, label: 'العربية' }, { value: 'en' as const, label: 'English' }]} onChange={(l) => { void changeLang(l); }} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t(lang, 'clientLangTitle')}</Text>
            <Chips testID="client-lang" value={clientLang} options={[{ value: 'ar' as const, label: 'العربية' }, { value: 'en' as const, label: 'English' }]} onChange={setClientLang} />
            <Text style={{ color: colors.muted }}>{t(lang, 'clientLangHint')}</Text>
          </View>

          {canLock || enabled ? (
            <View style={styles.switchRow}>
              <Text style={[styles.flex, { color: colors.text }]}>{t(lang, 'lockSetting')}</Text>
              <BusySwitch testID="lock-switch" value={enabled} onValueChange={toggleLock} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={enabled ? colors.onPrimary : colors.muted} />
            </View>
          ) : null}
          {lockMsg ? <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, textAlign: ar ? 'right' : 'left' }}>{lockMsg}</Text> : null}

          {rights.manager || rights.agencyOwner ? (
            <View testID="settings-agency" style={[styles.card, elev('md'), { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.section, { color: colors.text }]}>{ar ? 'الشركة' : 'Agency'}</Text>
              <Text style={{ color: colors.muted }}>{ar ? 'حروف الأكواد وأسعار العملات ومين يشوف البيانات الخاصة بتتغير من الموقع. اللوجو وتعديل البروكرز للوحدات فوق.' : 'Unit code letters, currency rates and who sees private details are changed on the website. The logo and brokers editing units are above.'}</Text>
              <Button testID="settings-open-usage" label={ar ? 'استهلاك الذكاء الاصطناعي' : 'AI use per person'} variant="secondary" onPress={() => onOpen?.('Usage')} />
              {rights.team ? <Button testID="settings-open-team" label={t(lang, 'team')} variant="secondary" onPress={() => onOpen?.('Team')} /> : null}
            </View>
          ) : null}

          {rights.agencyOwner ? (
            <View testID="settings-plan" style={[styles.card, elev('md'), { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.section, { color: colors.text }]}>{ar ? 'الباقة والفواتير' : 'Plan and billing'}</Text>
              <Button testID="settings-open-plan" label={t(lang, 'plan')} variant="secondary" onPress={() => onOpen?.('Plan')} />
            </View>
          ) : null}
        </>
      ) : null}

      {ts && mode === 'settings' ? (
        <View style={[styles.card, elev('md'), { borderColor: colors.border, backgroundColor: colors.card }]} testID="test-switch">
          <Text style={[styles.cardTitle, { color: colors.text }]}>{ar ? 'تبديل الاختبار' : 'Test switch'}</Text>
          <Chips testID="test-role" value={ts.role} options={ts.roles.map((r) => ({ value: r, label: ROLE_LABELS[r]?.[lang] ?? r }))} onChange={(r) => { void switchRole(r); }} />
          {ts.canView ? (
            <Chips testID="test-view" value={ts.viewing ? 'other' : 'home'} options={[{ value: 'home' as const, label: ar ? 'شركة التجربة' : 'Test agency' }, { value: 'other' as const, label: ar ? 'NCH (للقراءة فقط)' : 'NCH (read only)' }]} onChange={(v) => { void switchView(v); }} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text testID="app-version" style={{ color: colors.muted, textAlign: 'center', fontSize: 12 }}>
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
  profileCopy: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '800' },
  agency: { fontSize: 14 },
  section: { fontSize: 18, fontWeight: '700', marginTop: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  cardTitle: { fontSize: 14, fontWeight: '700', marginTop: spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  hubContainer: { gap: spacing.sm },
  hubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubCopy: { flex: 1, gap: 2 },
  hubTitle: { fontSize: 16, fontWeight: '700' },
  hubSubtitle: { fontSize: 12, lineHeight: 16 },
  footer: { marginTop: spacing.md, alignItems: 'center', gap: spacing.md },
});
