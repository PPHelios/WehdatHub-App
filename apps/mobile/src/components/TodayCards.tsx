import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { TodayCards as Cards } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';
import { toast } from './Toast';

/** The cards under Today's task list, from the same result the website shows (server: services/today.js). */
export function TodayCards({ cards, only, onShowAll }: { cards: Cards; only?: 'oldUnits'; onShowAll?: () => void }) {
  const { colors, elev } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  // Opened from the units list the section starts folded, so the list under it stays in reach.
  const [open, setOpen] = useState(!only);
  const [busy, setBusy] = useState<string | null>(null);
  const qc = useQueryClient();
  // Quick action: available again (active, which vouches for the unit), sold or archived. The server decides who may.
  const quick = async (code: string, s: 'active' | 'sold' | 'archived') => {
    setBusy(code);
    try {
      await api.unitStatus(code, s);
      await Promise.all([qc.invalidateQueries({ queryKey: ['today'] }), qc.invalidateQueries({ queryKey: ['units'] }), qc.invalidateQueries({ queryKey: ['unit', code] })]);
    } catch (e) {
      toast(errorText(e, lang), true);
    } finally {
      setBusy(null);
    }
  };
  const box =[styles.card, elev('md'), { backgroundColor: colors.card, borderColor: colors.border }];
  const chev = '›'; // the glyph is bidi-mirrored, so it already points outward in RTL
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
          <Pressable testID="old-toggle" accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={[styles.head, { backgroundColor: colors.primarySoft, borderRadius: radius.sm, padding: spacing.sm }]}>
            <Text style={[styles.title, styles.grow, { color: colors.text }]}>{t(lang, 'tcOldUnits')}</Text>
            <View style={[styles.pill, { backgroundColor: colors.accent + '22' }]}><Text style={{ color: colors.text, fontWeight: '700' }}>{cards.oldUnits.total}</Text></View>
            <Text style={{ color: colors.muted, fontSize: 16 }}>{open ? '▾' : chev}</Text>
          </Pressable>
          {open ? (
            <>
              <Text style={{ color: colors.muted }}>{t(lang, 'tcOldUnitsHint')}</Text>
              <ScrollView style={only ? styles.list : undefined} nestedScrollEnabled>
                {cards.oldUnits.items.map((u) => (
                  <View key={u.code} testID={`old-row-${u.code}`} style={[styles.oldRow, { borderTopColor: colors.border }]}>
                    <Pressable accessibilityRole="button" onPress={() => nav.navigate('Unit', { code: u.code })} style={styles.oldMain}>
                      <Text style={[styles.grow, { color: colors.text }]}>{`${u.code} · ${u.line}`}</Text>
                      <View style={[styles.pill, { backgroundColor: colors.bg }]}><Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>{u.hidden ? t(lang, 'tcHidden') : days(u.days)}</Text></View>
                    </Pressable>
                    <View style={styles.actions}>
                      {([['active', 'stActive', colors.ok], ['sold', 'stSold', colors.primary], ['archived', 'stArchived', colors.muted]] as const).map(([s, key, tone]) => (
                        <Pressable key={s} testID={`old-${s}-${u.code}`} accessibilityRole="button" disabled={busy === u.code} onPress={() => quick(u.code, s)} style={[styles.action, { borderColor: tone }]}>
                          <Text style={{ color: tone, fontSize: 12, fontWeight: '700' }}>{t(lang, key)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
              <Pressable testID="old-show-all" accessibilityRole="button" onPress={showAll} style={[styles.showAll, { backgroundColor: colors.primary + '14' }]}><Text style={{ color: colors.primaryInk, fontWeight: '700' }}>{t(lang, 'tcShowAll')}{cards.oldUnits.total > cards.oldUnits.items.length ? ` (+${cards.oldUnits.total - cards.oldUnits.items.length})` : ''}</Text></Pressable>
            </>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '700' },
  oldRow: { gap: spacing.xs, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  oldMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs, borderWidth: 1, borderRadius: radius.sm },
  list: { maxHeight: 340 },
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
