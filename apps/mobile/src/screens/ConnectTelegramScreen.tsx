import React, { useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { AppText as Text } from '../components/AppText';
import { Button } from '../components/Button';
import { toast } from '../components/Toast';
import { t } from '../i18n';
import { meOptions } from '../queries';
import { spacing, useTheme } from '../theme';

/** Opens the bot with a one-time start link; the tick appears when /me says Telegram is linked. */
export function ConnectTelegramScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const me = useQuery({ ...meOptions(), staleTime: 0 });
  const [busy, setBusy] = useState(false);
  const { refetch } = me;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refetch(); });
    return () => sub.remove();
  }, [refetch]);
  const connected = me.data?.onboarding?.telegramConnected === true;
  const open = async () => {
    setBusy(true);
    try {
      const { url } = await api.telegramLink();
      await Linking.openURL(url);
    } catch {
      toast(t(lang, 'connectTgFailed'), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.wrap}>
      <Text variant="heading" style={{ color: colors.text }}>{t(lang, 'connectTgTitle')}</Text>
      <Text style={{ color: colors.muted }}>{t(lang, 'connectTgBody')}</Text>
      {connected
        ? <Text testID="tg-connected" weight="bold" style={{ color: colors.primaryInk }}>{t(lang, 'connectTgDone')}</Text>
        : <Button testID="tg-open" label={t(lang, 'connectTgOpen')} onPress={open} loading={busy} disabled={busy} />}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'center' } });
