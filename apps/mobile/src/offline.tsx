import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { currentLang } from './auth';
import { t } from './i18n';
import { spacing, useTheme } from './theme';

/** Tells react-query when the phone is offline, and shows a banner meanwhile. Saved lists stay readable. */
export function OfflineBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    return NetInfo.addEventListener((s) => {
      const off = s.isConnected === false || s.isInternetReachable === false;
      setOffline(off);
      onlineManager.setOnline(!off);
    });
  }, []);
  if (!offline) return null;
  return (
    <Text accessibilityRole="alert" style={[styles.bar, { backgroundColor: colors.danger, color: '#FFFFFF', paddingTop: insets.top + spacing.xs }]}>
      {t(currentLang(), 'offlineBanner')}
    </Text>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, start: 0, end: 0, textAlign: 'center', paddingBottom: spacing.xs, fontWeight: '700', fontSize: 14 },
});
