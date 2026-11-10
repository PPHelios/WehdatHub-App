import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
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
import { useLock } from '../lock';
import { useRights } from '../rights';
import { stopPush } from '../push';
import { spacing, useTheme } from '../theme';

export function MoreScreen({ onOpen }: { onOpen?: (screen: 'Calendar' | 'SentLinks' | 'Team' | 'Ask') => void } = {}) {
  const { colors } = useTheme();
  const { broker, agencyName, signOut } = useAuth();
  const queries = useQueryClient();
  const [busy, setBusy] = useState(false);
  const lang = broker?.lang ?? 'ar';
  const rights = useRights();
  const { enabled, enable, disable } = useLock();
  const [lockMsg, setLockMsg] = useState<string | null>(null);
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.me(), staleTime: 5 * 60_000 });
  const ts = me.data?.testSwitch ?? null;
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
    <View style={[styles.body, { backgroundColor: colors.bg }]}>
      <Text style={[styles.name, { color: colors.text }]}>{broker?.name}</Text>
      {agencyName ? <Text style={[styles.agency, { color: colors.muted }]}>{t(lang, 'agency')}: {agencyName}</Text> : null}
      {onOpen ? <Button testID="open-calendar" label={`🗓 ${t(lang, 'calendar')}`} variant="secondary" onPress={() => onOpen('Calendar')} /> : null}
      {onOpen ? <Button testID="open-ask" label={`💬 ${t(lang, 'ask')}`} variant="secondary" onPress={() => onOpen('Ask')} /> : null}
      {onOpen && rights.team ? <Button testID="open-team" label={`👥 ${t(lang, 'team')}`} variant="secondary" onPress={() => onOpen('Team')} /> : null}
      {onOpen ? <Button testID="open-links" label={`🔗 ${t(lang, 'sentLinks')}`} variant="secondary" onPress={() => onOpen('SentLinks')} /> : null}
      {ts ? (
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]} testID="test-switch">
          <Text style={[styles.cardTitle, { color: colors.text }]}>{lang === 'ar' ? 'تبديل الاختبار' : 'Test switch'}</Text>
          <Chips testID="test-role" value={ts.role} options={ts.roles.map((r) => ({ value: r, label: ROLE_LABELS[r]?.[lang] ?? r }))} onChange={(r) => { void switchRole(r); }} />
          {ts.canView ? (
            <Chips testID="test-view" value={ts.viewing ? 'other' : 'home'} options={[{ value: 'home' as const, label: lang === 'ar' ? 'شركة التجربة' : 'Test agency' }, { value: 'other' as const, label: lang === 'ar' ? 'NCH (للقراءة فقط)' : 'NCH (read only)' }]} onChange={(v) => { void switchView(v); }} />
          ) : null}
        </View>
      ) : null}
      <View style={styles.switchRow}><Text style={[styles.flex, { color: colors.text }]}>{t(lang, 'lockSetting')}</Text><Switch testID="lock-switch" value={enabled} onValueChange={toggleLock} /></View>
      {lockMsg ? <Text style={{ color: colors.danger }}>{lockMsg}</Text> : null}
      <Button testID="sign-out" label={t(lang, 'signOut')} onPress={out} loading={busy} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: spacing.xl, gap: spacing.md },
  name: { fontSize: 22, fontWeight: '700' },
  agency: { fontSize: 16, marginBottom: spacing.lg },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  card: { borderWidth: 1, borderRadius: 16, padding: spacing.md, gap: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  flex: { flex: 1 },
});
