import React, { useState } from 'react';
import { timed } from '../usage';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { ApiLead } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from './Button';
import { errorText } from '../errors';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

/** Pick a team member and hand every selected lead to them, one by one (each carries its own version). */
export function BulkAssign({ leads, onDone, onCancel }: { leads: ApiLead[]; onDone: () => void; onCancel: () => void }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const team = useQuery({ queryKey: ['team'], queryFn: () => api.team() });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (brokerId: string | null) => {
    setBusy(true);
    setMessage(null);
    let failed = 0;
    let lastError: unknown = null;
    for (const l of leads) {
      try {
        await timed('lead_assign', () => api.assignLead(l.ref, l.version, brokerId), { kind: 'bulk' });
      } catch (e) {
        failed += 1;
        lastError = e;
      }
    }
    setBusy(false);
    if (!failed) return onDone();
    setMessage(`${t(lang, 'assignFailedN')} ${failed}/${leads.length} · ${errorText(lastError, lang)}`);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.back}>
        <View style={[styles.box, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>{t(lang, 'assignTo')} ({leads.length})</Text>
          {team.isPending ? <ActivityIndicator color={colors.primary} /> : null}
          <ScrollView style={styles.list}>
            {(team.data?.items ?? []).map((m) => (
              <Pressable key={m.id} testID={`assign-${m.id}`} accessibilityRole="button" disabled={busy || m.away} onPress={() => run(m.id)} style={[styles.row, { borderColor: colors.border, opacity: m.away ? 0.5 : 1 }]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{m.name}{m.me ? ` (${t(lang, 'me')})` : ''}</Text>
                <Text style={{ color: colors.muted }}>{m.away ? t(lang, 'awayShort') : `${m.open}`}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {message ? <Text testID="assign-message" style={{ color: colors.danger }}>{message}</Text> : null}
          <Button variant="secondary" label={t(lang, 'cancel')} onPress={onCancel} disabled={busy} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: spacing.lg },
  box: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, maxHeight: '80%' },
  title: { fontSize: 18, fontWeight: '700' },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, paddingVertical: spacing.md },
});
