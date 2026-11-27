import React, { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { useQueryClient } from '@tanstack/react-query';
import { currentLang, useAuth } from '../auth';
import { usePlanLock } from '../planLock';
import { planT } from '../planText';
import { useRights } from '../rights';
import { radius, spacing, typeScale, useTheme } from '../theme';
import { Button } from './Button';
import { sx } from '../sharedStyles';

/**
 * Shown when the plan guard refuses a call (402 plan_readonly / plan_blocked), instead of a raw error. A manager is pointed
 * to the Plan page; a broker is told to ask the manager (never a price). A blocked account is covered by PlanBlockedGate.
 */
export function PlanLockSheet({ onOpenPlan }: { onOpenPlan: () => void }) {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const err = usePlanLock((s) => s.error);
  const clear = usePlanLock((s) => s.clear);
  const rights = useRights();
  const manager = rights.manager || rights.agencyOwner;
  const lang = currentLang();
  // The ladder moved: refresh where the banner reads it.
  useEffect(() => {
    if (err) qc.invalidateQueries({ queryKey: ['usage'] });
  }, [err, qc]);
  if (!err || !signedIn || err.phase === 'blocked') return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={clear}>
      <View style={styles.scrim}>
        <View testID="plan-lock-sheet" style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{planT(lang, 'titleReadonly')}</Text>
          <Text style={{ color: colors.muted }}>{planT(lang, 'bodyReadonly')}</Text>
          {manager ? (
            <Button testID="plan-lock-open" label={planT(lang, 'openPlan')} onPress={() => { clear(); onOpenPlan(); }} />
          ) : (
            <Text testID="plan-lock-ask" style={[{ color: colors.text }, sx.fontWeight700]}>{planT(lang, 'askManager')}</Text>
          )}
          <Button testID="plan-lock-close" variant="quiet" label={planT(lang, 'ok')} onPress={clear} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { padding: spacing.lg, gap: spacing.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  title: { fontSize: typeScale.heading.fontSize, fontWeight: '800' },
});
