import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { currentLang } from '../auth';
import { t } from '../i18n';
import { useTheme } from '../theme';

const RETRIES = 2;

/** A photo with a spinner until it loads, two quiet retries when it fails, then "tap to retry". */
export function SmartImage({ uri, style, testID }: { uri: string; style: StyleProp<ViewStyle>; testID?: string }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  // A retry asks for the same picture again with a changed address so a failed answer is not reused.
  const src = attempt > 0 && /^https?:/.test(uri) ? `${uri}${uri.includes('?') ? '&' : '?'}r=${attempt}` : uri;
  const failed = () => {
    if (attempt < RETRIES) setAttempt((a) => a + 1);
    else setState('failed');
  };
  return (
    <View testID={testID} style={[style, styles.box, { backgroundColor: colors.card }]}>
      {state !== 'failed' ? <Image testID="smart-image" key={attempt} source={{ uri: src }} style={StyleSheet.absoluteFill} resizeMode="cover" onLoad={() => setState('ok')} onError={failed} /> : null}
      {state === 'loading' ? <ActivityIndicator testID="image-spinner" color={colors.primary} /> : null}
      {state === 'failed' ? (
        <Pressable testID="image-retry" accessibilityRole="button" onPress={() => { setAttempt(0); setState('loading'); }} style={styles.retry}>
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{t(lang, 'tapRetry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  retry: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
});
