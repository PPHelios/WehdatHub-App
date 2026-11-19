import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { currentLang, useAuth } from '../auth';
import { usePlanState } from '../planState';
import { planT } from '../planText';
import { PlanScreen } from '../screens/MoreScreens';
import { spacing, useTheme } from '../theme';
import { Button } from './Button';
import { usePlanLock } from '../planLock';

/**
 * A stopped account (blocked) can only reach the Plan page. This covers the app: a manager gets the Plan page (payment details),
 * a broker gets "ask your manager" with no prices. (The app has no export screen; the server still allows the export call.)
 */
export function PlanBlockedGate() {
  const { colors } = useTheme();
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const { phase, manager } = usePlanState();
  const lang = currentLang();
  const lockedNow = usePlanLock((s) => s.error?.phase === 'blocked');
  if (!signedIn || (phase !== 'blocked' && !(phase === 'none' && lockedNow))) return null;
  return (
    <View testID="plan-blocked-gate" style={[styles.root, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>{planT(lang, 'titleBlocked')}</Text>
      <Text style={{ color: colors.muted, paddingHorizontal: spacing.lg }}>{planT(lang, 'bodyBlocked')}</Text>
      {manager ? (
        <View style={styles.plan}><PlanScreen /></View>
      ) : (
        <View style={styles.ask}>
          <Text testID="plan-blocked-ask" style={{ color: colors.text, fontWeight: '700', textAlign: 'center' }}>{planT(lang, 'askManager')}</Text>
          <Button variant="secondary" label={lang === 'ar' ? 'خروج' : 'Sign out'} onPress={() => useAuth.getState().signOut()} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, zIndex: 900, paddingTop: 64, gap: spacing.sm },
  title: { fontSize: 22, fontWeight: '800', paddingHorizontal: spacing.lg },
  plan: { flex: 1 },
  ask: { padding: spacing.lg, gap: spacing.lg },
});
