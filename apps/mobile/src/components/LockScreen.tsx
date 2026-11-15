import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { currentLang } from '../auth';
import { t } from '../i18n';
import { useLock } from '../lock';
import { spacing, useTheme } from '../theme';
import { Button } from './Button';

export function LockScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const unlock = useLock((s) => s.unlock);
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]} testID="lock-screen">
      <Text style={[styles.title, { color: colors.text }]}>{t(lang, 'lockTitle')}</Text>
      <View style={styles.btn}><Button testID="unlock" label={t(lang, 'unlock')} onPress={async () => { await unlock(t(lang, 'lockTitle')); }} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, zIndex: 100 },
  title: { fontSize: 22, fontWeight: '800' },
  btn: { alignSelf: 'stretch', paddingHorizontal: spacing.xl },
});
