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
  const { colors, elev } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const box = [styles.card, elev('md'), { backgroundColor: colors.card, borderColor: colors.border }];
  const chev = lang === 'ar' ? '‹' : '›';
  const row = (key: string, text: string, onPress: () => void, side?: string) => (
    <Pressable key={key} accessibilityRole="button" onPress={onPress} style={[styles.row, { borderTopColor: colors.border }]}>
      <Text style={[styles.grow, { color: colors.text }]}>{text}</Text>
      {side ? <View style={[styles.pill, { backgroundColor: colors.bg }]}><Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>{side}</Text></View> : null}
      <Text style={{ color: colors.muted, fontSize: 18 }}>{chev}</Text>
    </Pressable>
  );
  /** An overview row: a tinted icon badge, a bold title, the figures under it, and an arrow. */
  const tile = (key: string, icon: string, title: string, detail: string, onPress: () => void, tone: string, side?: string) => (
    <Pressable key={key} accessibilityRole="button" onPress={onPress} style={[styles.tile, { borderTopColor: colors.border }, info.length === 0 && styles.first]}>
      <View style={[styles.badge, { backgroundColor: tone + '22' }]}><Text style={{ fontSize: 18 }}>{icon}</Text></View>
      <View style={styles.grow}>
        <Text style={[styles.tileTitle, { color: colors.text }]}>{title}</Text>
        {detail ? <Text style={{ color: colors.muted }}>{detail}</Text> : null}
      </View>
      {side ? <View style={[styles.pill, { backgroundColor: tone + '22' }]}><Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{side}</Text></View> : null}
      <Text style={{ color: colors.muted, fontSize: 18 }}>{chev}</Text>
    </Pressable>
  );
  const info: React.ReactNode[] = [];
  if (!only) {
    if (cards.target) {
      const g = cards.target;
      const parts = [g.targetDeals ? `${g.deals}/${g.targetDeals} ${t(lang, 'tcDeals')}` : '', g.targetCommission ? `${g.commission.toLocaleString('en-US')}/${g.targetCommission.toLocaleString('en-US')} ${t(lang, 'tcEgp')}` : ''].filter(Boolean);
      info.push(tile('target', '🎯', t(lang, 'tcTarget'), parts.join(' · '), () => nav.navigate('Deals'), colors.primary, `${g.daysLeft} ${t(lang, 'tcDaysLeft')}`.replace(/^(\d+) (.*)$/, lang === 'ar' ? '$2 $1' : '$1 $2')));
    }
    if (cards.ops) {
      const o = cards.ops;
      const bits = [o.unassigned ? `${o.unassigned} ${t(lang, 'tcNoBroker')}` : '', o.uncontactedOld ? `${o.uncontactedOld} ${t(lang, 'tcNotContacted')}` : '', o.overdue ? `${o.overdue} ${t(lang, 'tcOverdue')}` : ''].filter(Boolean);
      info.push(tile('ops', '👥', t(lang, o.team ? 'tcTeam' : 'tcAgency'), bits.join(' · '), () => nav.navigate('LeadsList', { tab: 'overdue' }), o.overdue ? colors.danger : colors.accent));
    }
    if (cards.commissions) {
      const m = cards.commissions;
      const bits = [m.overdue ? `${m.overdue} ${t(lang, 'tcOverdue')}` : '', m.registrations ? `${m.registrations} ${t(lang, 'tcRegistrations')}` : ''].filter(Boolean);
      info.push(tile('commissions', '💸', t(lang, 'tcCommissions'), bits.join(' · '), () => nav.navigate('Commissions'), colors.accent));
    }
    if (cards.approvals?.access) info.push(tile('access', '🔒', `${cards.approvals.access} ${t(lang, 'tcAccess')}`, '', () => nav.navigate('Requests'), colors.primary));
    if (cards.approvals?.names) info.push(tile('names', '✏️', `${cards.approvals.names} ${t(lang, 'tcNames')}`, '', () => nav.navigate('Owners'), colors.primary));
  }
  const showAll = onShowAll ?? (() => nav.navigate('UnitsList', { old: true }));
  const days = (n: number) => `${n} ${t(lang, 'tcDays')}`;
  return (
    <>
      {info.length ? <View testID="today-card-info" style={[box, styles.flush]}>{info}</View> : null}
      {cards.oldUnits ? (
        <View testID="today-card-old" style={box}>
          <View style={styles.head}>
            <Text style={[styles.title, styles.grow, { color: colors.text }]}>{t(lang, 'tcOldUnits')}</Text>
            <View style={[styles.pill, { backgroundColor: colors.accent + '22' }]}><Text style={{ color: colors.text, fontWeight: '700' }}>{cards.oldUnits.total}</Text></View>
          </View>
          <Text style={{ color: colors.muted }}>{t(lang, 'tcOldUnitsHint')}</Text>
          {cards.oldUnits.items.map((u) => row(u.code, `${u.code} · ${u.line}`, () => nav.navigate('Unit', { code: u.code }), u.hidden ? t(lang, 'tcHidden') : days(u.days)))}
          <Pressable testID="old-show-all" accessibilityRole="button" onPress={showAll} style={[styles.showAll, { backgroundColor: colors.primary + '14' }]}><Text style={{ color: colors.primaryInk, fontWeight: '700' }}>{t(lang, 'tcShowAll')}{cards.oldUnits.total > cards.oldUnits.items.length ? ` (+${cards.oldUnits.total - cards.oldUnits.items.length})` : ''}</Text></Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  tile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  first: { borderTopWidth: 0 },
  flush: { padding: 0, gap: 0, overflow: 'hidden' },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 15, fontWeight: '700' },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  showAll: { alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  grow: { flex: 1 },
  bold: { fontWeight: '700' },
});
