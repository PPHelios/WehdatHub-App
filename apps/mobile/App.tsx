import React from 'react';
import { I18nManager, StatusBar, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { brand, formatEgp } from '@wehdathub/shared';

I18nManager.allowRTL(true);

export default function App() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = brand[scheme];
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <Text style={[styles.title, { color: colors.text }]}>
        Wehdat<Text style={{ color: colors.azure }}>Hub</Text>
      </Text>
      <Text style={[styles.subtitle, { color: colors.copper }]}>{formatEgp(3180590)} EGP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { marginTop: 8, fontSize: 16 },
});
