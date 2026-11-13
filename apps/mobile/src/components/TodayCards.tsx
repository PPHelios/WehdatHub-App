import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { TodayCards as Cards } from '@wehdathub/shared';
import { currentLang } from '../auth';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

/** The cards under Today's task list, from the same result the website shows (server: services/today.js). */
export function TodayCards({ cards, only, onShowAll }: { cards: Cards; only?: 'oldUnits'; onShowAll?: () => void }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const box = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }];
  const row = (key: string, text: string, onPress: () => void, side?: string) => (
    <Pressable key={key} accessibilityRole="button" onPress={onPress} style={styles.row}>
      <Text style={[styles.grow, { color: colors.text }]}>{text}</Text>
      {side ? <Text style={{ color: colors.muted }}>{side}</Text> : null}
    </Pressable>
  );
  const info: React.ReactNode[] = [];
  if (!only) {
    if (cards.target) {
      const g = cards.target;
      const parts = [g.targetDeals ? `${g.deals}/${g.targetDeals} ${t(lang, 'tcDeals')}` : '', g.targetCommission ? `${g.commission.toLocaleString('en-US')}/${g.targetCommission.toLocaleString('en-US')} ${t(lang, 'tcEgp')}` : ''].filter(Boolean);
      info.push(row('target', `🎯 ${t(lang, 'tcTarget')}: ${parts.join(' · ')}`, () => nav.navigate('Deals'), `${g.daysLeft} ${t(lang, 'tcDaysLeft')}`.replace(/^(\d+) (.*)$/, lang === 'ar' ? '$2 $1' : '$1 $2')));
    }
    if (cards.ops) {
      const o = cards.ops;
      const bits = [o.unassigned ? `${o.unassigned} ${t(lang, 'tcNoBroker')}` : '', o.uncontactedOld ? `${o.uncontactedOld} ${t(lang, 'tcNotContacted')}` : '', o.overdue ? `${o.overdue} ${t(lang, 'tcOverdue')}` : ''].filter(Boolean);
      info.push(row('ops', `👥 ${t(lang, o.team ? 'tcTeam' : 'tcAgency')}: ${bits.join(' · ')}`, () => nav.navigate('LeadsList', { tab: 'overdue' })));
    }
    if (cards.commissions) {
      const m = cards.commissions;
      const bits = [m.overdue ? `${m.overdue} ${t(lang, 'tcOverdue')}` : '', m.registrations ? `${m.registrations} ${t(lang, 'tcRegistrations')}` : ''].filter(Boolean);
      info.push(row('commissions', `💸 ${t(lang, 'tcCommissions')}: ${bits.join(' · ')}`, () => nav.navigate('Commissions')));
    }
    if (cards.approvals?.access) info.push(row('access', `🔒 ${cards.approvals.access} ${t(lang, 'tcAccess')}`, () => nav.navigate('Requests')));
    if (cards.approvals?.names) info.push(row('names', `✏️ ${cards.approvals.names} ${t(lang, 'tcNames')}`, () => nav.navigate('Owners')));
  }
  const showAll = onShowAll ?? (() => nav.navigate('UnitsList', { old: true }));
  const days = (n: number) => `${n} ${t(lang, 'tcDays')}`;
  return (
    <>
      {info.length ? <View testID="today-card-info" style={box}>{info}</View> : null}
      {cards.oldUnits ? (
        <View testID="today-card-old" style={box}>
          <Text style={[styles.title, { color: colors.text }]}>{t(lang, 'tcOldUnits')} ({cards.oldUnits.total})</Text>
          <Text style={{ color: colors.muted }}>{t(lang, 'tcOldUnitsHint')}</Text>
          {cards.oldUnits.items.map((u) => row(u.code, `${u.code} · ${u.line}`, () => nav.navigate('Unit', { code: u.code }), u.hidden ? t(lang, 'tcHidden') : days(u.days)))}
          <Pressable testID="old-show-all" accessibilityRole="button" onPress={showAll}><Text style={{ color: colors.primary, fontWeight: '600' }}>{t(lang, 'tcShowAll')}{cards.oldUnits.total > cards.oldUnits.items.length ? ` (+${cards.oldUnits.total - cards.oldUnits.items.length})` : ''}</Text></Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  grow: { flex: 1 },
  bold: { fontWeight: '700' },
});
