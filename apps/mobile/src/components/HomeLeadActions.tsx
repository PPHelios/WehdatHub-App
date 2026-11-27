import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type Lang, type SearchHomePriority } from '@wehdathub/shared';
import { errorText } from '../errors';
import { failed, sent } from '../haptics';
import { t } from '../i18n';
import { assignLead, nudgeLead } from '../leadActions';
import { reminderLine } from '../reminderLine';
import { spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Chip } from './Chip';
import { toast } from './Toast';

/** Priority ids that are about one lead waiting on someone; only these get inline nudge / assign. */
const LEAD_IDS = new Set(['unassigned', 'waiting-over-1h', 'uncontacted-old', 'overdue', 'stuck-leads']);

/** Nudge and assign on a Home decision card, only when the server says this person may (canNudge / canAssign). */
export function HomeLeadActions({ p, lang }: { p: SearchHomePriority; lang: Lang }) {
  const { colors } = useTheme();
  const queries = useQueryClient();
  const [nudged, setNudged] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lead = p.lead;
  if (!lead?.ref || !LEAD_IDS.has(p.id) || (!p.canNudge && !p.canAssign)) return null;
  const rec = lead.recommendedBroker;
  const reminded = reminderLine(lead.lastAutoReminderAt, lang);

  const run = async (job: () => Promise<void>, done: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      await job();
      done();
      sent();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 429) {
        done();
        toast(t(lang, 'ac_alreadyNudged'));
      } else {
        failed();
        toast(e instanceof ApiClientError && e.status === 409 ? t(lang, 'ac_conflict') : errorText(e, lang), true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      {p.canAssign && rec && !assignedTo ? (
        <Chip testID={`${p.id}-assign`} disabled={busy} label={`→ ${rec.name}`}
          onPress={() => { run(() => assignLead(queries, lead.ref, rec.id, lead.version), () => { setAssignedTo(rec.name); toast(`→ ${rec.name}`); }); }} />
      ) : null}
      {p.canNudge && lead.assigneeId ? (
        <Chip testID={`${p.id}-nudge`} disabled={busy || nudged} selected={nudged} label={t(lang, nudged ? 'ac_nudged' : 'ac_askUpdate')}
          onPress={() => { run(() => nudgeLead(lead.ref), () => { setNudged(true); toast(t(lang, 'ac_nudgeSent')); }); }} />
      ) : null}
      {p.canNudge && lead.assigneeId && reminded ? <Text testID={`${p.id}-auto`} variant="caption" style={{ color: colors.muted }}>{reminded}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
});
