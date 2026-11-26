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
import type { IconName } from './Icon';
import { HomeRow } from './HomeRow';
import { UrgencyBadge, type BadgeTone } from './SectionCard';

/** The cards under Today's task list, from the same result the website shows (server: services/today.js). */
export function OldUnitActions({ code }: { code: string }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const quick = async (status: 'active' | 'sold' | 'archived') => {
    setBusy(true);
    try {
      await api.unitStatus(code, status);
      await Promise.all([qc.invalidateQueries({ queryKey: ['today'] }), qc.invalidateQueries({ queryKey: ['units'] }), qc.invalidateQueries({ queryKey: ['unit', code] })]);
    } catch (e) {
      toast(errorText(e, lang), true);
    } finally {
      setBusy(false);
    }
  };
  return <View style={styles.actions}>
    {([['active', 'stActive', colors.primaryInk], ['sold', 'stSold', colors.primaryInk], ['archived', 'stArchived', colors.muted]] as const).map(([status, key, tone]) => (
      <Pressable key={status} testID={`old-${status}-${code}`} accessibilityRole="button" disabled={busy} onPress={() => quick(status)} style={[styles.action, { borderColor: colors.border, backgroundColor: colors.cardSubtle }]}>
        <Text style={{ color: tone, fontSize: 12, fontWeight: '700' }}>{t(lang, key)}</Text>
      </Pressable>
    ))}
  </View>;
}

export function TodayCards({ cards, only, onShowAll }: { cards: Cards; only?: 'oldUnits'; onShowAll?: () => void }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [open, setOpen] = useState(false);
  /** An overview row ordered by urgency (ops -> commissions -> approvals -> target) matching Dashboard & SearchHome. */
  const tile = (key: string, icon: IconName, title: string, detail: string, onPress: () => void, side?: string, urgencyTone?: BadgeTone) => (
    <HomeRow key={key} testID={`today-card-${key}`} icon={icon} title={title} detail={detail} value={side} urgent={urgencyTone === 'critical'} onPress={onPress}>
      {urgencyTone ? <UrgencyBadge testID={`today-badge-${key}`} tone={urgencyTone} label={urgencyTone === 'critical' ? (lang === 'ar' ? 'عاجل' : 'Urgent') : (lang === 'ar' ? 'مراجعة' : 'Review')} /> : undefined}
    </HomeRow>
  );
  const info: React.ReactNode[] = [];
  if (!only) {
    if (cards.ops) {
      const o = cards.ops;
      const bits = [o.unassigned ? `${o.unassigned} ${t(lang, 'tcNoBroker')}` : '', o.uncontactedOld ? `${o.uncontactedOld} ${t(lang, 'tcNotContacted')}` : '', o.overdue ? `${o.overdue} ${t(lang, 'tcOverdue')}` : ''].filter(Boolean);
      const tone: BadgeTone | undefined = o.unassigned || o.overdue ? 'critical' : o.uncontactedOld ? 'warn' : undefined;
      info.push(tile('ops', 'team', t(lang, o.team ? 'tcTeam' : 'tcAgency'), bits.join(' · '), () => nav.navigate('LeadsList', { tab: 'overdue' }), undefined, tone));
    }
    if (cards.commissions) {
      const m = cards.commissions;
      const bits = [m.overdue ? `${m.overdue} ${t(lang, 'tcOverdue')}` : '', m.registrations ? `${m.registrations} ${t(lang, 'tcRegistrations')}` : ''].filter(Boolean);
      info.push(tile('commissions', 'money', t(lang, 'tcCommissions'), bits.join(' · '), () => nav.navigate('Commissions', { kind: 'developers', overdue: m.overdue > 0 }), undefined, m.overdue > 0 ? 'critical' : 'warn'));
    }
    if (cards.approvals?.access) info.push(tile('access', 'lock', `${cards.approvals.access} ${t(lang, 'tcAccess')}`, '', () => nav.navigate('Requests'), undefined, 'warn'));
    if (cards.approvals?.names) info.push(tile('names', 'edit', `${cards.approvals.names} ${t(lang, 'tcNames')}`, '', () => nav.navigate('Owners'), undefined, 'warn'));
    if (cards.target) {
      const g = cards.target;
      const parts = [g.targetDeals ? `${g.deals}/${g.targetDeals} ${t(lang, 'tcDeals')}` : '', g.targetCommission ? `${g.commission.toLocaleString('en-US')}/${g.targetCommission.toLocaleString('en-US')} ${t(lang, 'tcEgp')}` : ''].filter(Boolean);
      info.push(tile('target', 'gauge', t(lang, 'tcTarget'), parts.join(' · '), () => nav.navigate('Deals'), `${g.daysLeft} ${t(lang, 'tcDaysLeft')}`.replace(/^(\d+) (.*)$/, lang === 'ar' ? '$2 $1' : '$1 $2')));
    }
  }
  const showAll = onShowAll ?? (() => nav.navigate('UnitsList', { old: true }));
  const days = (n: number) => `${n} ${t(lang, 'tcDays')}`;
  return (
    <>
      {info.length ? <View testID="today-card-info" style={styles.info}>{info}</View> : null}
      {cards.oldUnits ? (
        <View testID="today-card-old" style={styles.info}>
          <HomeRow testID="old-toggle" title={t(lang, 'tcOldUnits')} value={String(cards.oldUnits.total)} icon="units"
            expanded={open} onPress={() => setOpen((v) => !v)} />
          {open ? (
            <>
              <Text style={{ color: colors.muted }}>{t(lang, 'tcOldUnitsHint')}</Text>
              <ScrollView style={only ? styles.list : undefined} contentContainerStyle={styles.info} nestedScrollEnabled>
                {cards.oldUnits.items.map((u) => (
                  <HomeRow key={u.code} testID={`old-row-${u.code}`} title={u.code} detail={u.line}
                    value={u.hidden ? t(lang, 'tcHidden') : days(u.days)} onPress={() => nav.navigate('Unit', { code: u.code })}>
                    <OldUnitActions code={u.code} />
                  </HomeRow>
                ))}
              </ScrollView>
              <HomeRow testID="old-show-all" title={t(lang, 'tcShowAll')} onPress={showAll}
                value={cards.oldUnits.total > cards.oldUnits.items.length ? `+${cards.oldUnits.total - cards.oldUnits.items.length}` : undefined} />
            </>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs, borderWidth: 1, borderRadius: radius.sm },
  list: { maxHeight: 340 },
  info: { gap: spacing.sm },
});
