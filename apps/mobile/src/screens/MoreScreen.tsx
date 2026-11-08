import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button } from '../components/Button';
import { clearDraft } from '../draft';
import { t } from '../i18n';
import { useLock } from '../lock';
import { stopPush } from '../push';
import { spacing, useTheme } from '../theme';

export function MoreScreen() {
  const { colors } = useTheme();
  const { broker, agencyName, signOut } = useAuth();
  const queries = useQueryClient();
  const [busy, setBusy] = useState(false);
  const lang = broker?.lang ?? 'ar';
  const { enabled, enable, disable } = useLock();
  const [lockMsg, setLockMsg] = useState<string | null>(null);
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
  flex: { flex: 1 },
});
