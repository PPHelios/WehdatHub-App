import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button } from '../components/Button';
import { t } from '../i18n';
import { spacing, useTheme } from '../theme';

export function MoreScreen() {
  const { colors } = useTheme();
  const { broker, agencyName, signOut } = useAuth();
  const queries = useQueryClient();
  const [busy, setBusy] = useState(false);
  const lang = broker?.lang ?? 'ar';
  const out = async () => {
    setBusy(true);
    try {
      await api.logout().catch(() => {}); // the phone signs out even when the server can't be reached
      queries.clear();
      await signOut();
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={[styles.body, { backgroundColor: colors.bg }]}>
      <Text style={[styles.name, { color: colors.text }]}>{broker?.name}</Text>
      {agencyName ? <Text style={[styles.agency, { color: colors.muted }]}>{t(lang, 'agency')}: {agencyName}</Text> : null}
      <Button testID="sign-out" label={t(lang, 'signOut')} onPress={out} loading={busy} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: spacing.xl, gap: spacing.md },
  name: { fontSize: 22, fontWeight: '700' },
  agency: { fontSize: 16, marginBottom: spacing.lg },
});
