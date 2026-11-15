import React from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import type { AppConfig } from '@wehdathub/shared';
import { currentLang } from '../auth';
import { t } from '../i18n';
import { spacing, useTheme } from '../theme';
import { Button } from './Button';

/** Shown instead of the app when the server no longer supports this version. */
export function UpdateScreen({ config }: { config: AppConfig }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const url = Platform.OS === 'ios' ? config.storeUrl.ios : config.storeUrl.android;
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]} testID="update-screen">
      <Text style={[styles.title, { color: colors.text }]}>{t(lang, 'updateTitle')}</Text>
      <Text style={{ color: colors.muted, textAlign: 'center' }}>{t(lang, 'updateHint')}</Text>
      {url ? <View style={styles.btn}><Button label={t(lang, 'updateBtn')} onPress={() => Linking.openURL(url)} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  btn: { alignSelf: 'stretch' },
});
