import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ApiLead, Lang } from '@wehdathub/shared';
import { rowDate } from '../dates';
import { stageLabel, t } from '../i18n';
import { greenGradient, radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Chevron, Icon } from './Icon';
import { looksLikePhone, PhoneText } from './PhoneText';
import { Pill } from './Pill';
import { InitialAvatar } from './InitialAvatar';

export const LeadCard = memo(function LeadCard({ lead, lang, phoneVisibility = 'masked', selected, disabled = false, onPress, onLongPress }: {
  lead: ApiLead;
  lang: Lang;
  phoneVisibility?: 'masked' | 'full' | 'hidden';
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  const phone = phoneVisibility === 'hidden' ? null : lead.phones[0];
  const due = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
  const overdue = due !== null && due.getTime() < Date.now();
  return (
    <Pressable testID={`lead-card-${lead.ref}`} accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled}
      onPress={onPress} onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, { backgroundColor: selected ? colors.primarySoft : colors.card, borderColor: selected ? colors.primary : colors.border, opacity: disabled ? 0.6 : pressed ? 0.84 : 1 }]}>
      <InitialAvatar name={lead.name} />
      <View style={styles.content}>
        {looksLikePhone(lead.name)
          ? <PhoneText value={lead.name!} style={[styles.name, { color: colors.text }]} numberOfLines={2} />
          : <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{lead.name || lead.ref}</Text>}
        <View style={styles.chips}>
          <Pill tone="primary" label={stageLabel(lang, lead.stage)} />
          {lead.name && lead.name !== lead.ref ? <Pill label={lead.ref} /> : null}
        </View>
        {phone ? <PhoneText testID={`lead-card-phone-${lead.ref}`} value={phoneVisibility === 'full' ? phone : `•••${phone.slice(-4)}`} style={[styles.caption, { color: colors.muted }]} /> : null}
        {lead.assignee || phoneVisibility === 'full' ? <Text style={[styles.caption, { color: colors.muted }]}>{lead.assignee ?? t(lang, 'unassigned')}</Text> : null}
        {due ? <View style={styles.due}>
          <Icon name="calendar" color={overdue ? colors.danger : colors.primaryInk} size={14} />
          <Text style={[styles.caption, styles.dueText, { color: overdue ? colors.danger : colors.primaryInk }]}>{overdue ? `${t(lang, 'tabOverdue')} · ` : ''}{rowDate(lang, due)}</Text>
        </View> : null}
      </View>
      {selected === undefined ? <Chevron rtl={lang === 'ar'} color={colors.muted} /> : (
        <View style={[styles.check, { borderColor: selected ? colors.primary : colors.border }, selected && greenGradient]}>
          {selected ? <Icon name="check" color={colors.onPrimary} size={14} /> : null}
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderRadius: radius.card },
  content: { flex: 1, minWidth: 0, gap: spacing.xs },
  name: { fontSize: 16, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  caption: { fontSize: 12 },
  due: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dueText: { flex: 1, fontWeight: '600' },
  check: { width: 22, height: 22, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});
