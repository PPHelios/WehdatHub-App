import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { TodayTask } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { bannerText, preEndStatus, unitWarnPct, usePlanState } from '../planState';
import { planT, preEndText, unitCapText } from '../planText';
import { Button } from './Button';
import { TodayCards } from './TodayCards';
import { HomeRow } from './HomeRow';
import type { IconName } from './Icon';
import { EmptyView, ErrorView, Loading } from './StateViews';
import { errorText } from '../errors';
import { t, type StringKey } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

const KIND_LABEL: Record<TodayTask['kind'], StringKey> = { late: 'late', viewing: 'viewing', hot: 'hot', call: 'callTask', matches: 'matches' };
const KIND_ICON: Record<TodayTask['kind'], IconName> = { late: 'bell', viewing: 'calendar', hot: 'pulse', call: 'phone', matches: 'units' };

export function TodayCall({ phone, label }: { phone: string; label: string }) {
  return <Button label={label} variant="secondary" size="sm" onPress={() => Linking.openURL(`tel:+${phone}`)} />;
}

export function TodayDetails({ brief, suppressLoading = false }: { brief?: { ops: boolean; units: boolean; viewing: TodayTask | null; approvals?: boolean; approvalsAccess?: boolean; approvalsNames?: boolean; commissions?: boolean; leases?: boolean }; suppressLoading?: boolean } = {}) {
  const { colors } = useTheme();
  const lang = currentLang();
  const stack = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const q = useQuery({ queryKey: ['today'], queryFn: () => api.today() });
  const planState = usePlanState();

  if (q.isPending) return suppressLoading ? null : <Loading label={t(lang, 'loading')} />;
  if (q.isError || !q.data) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} altLabel={t(lang, 'openUnits')} onAlt={() => stack.navigate('UnitsList')} />;
  const { counts, tasks, moreTasks } = q.data;
  const viewing = brief?.viewing;
  const remaining = viewing ? tasks.filter((task) => !(
    task.kind === 'viewing' && task.ref === viewing.ref && task.at === viewing.at
    && (!task.phone || task.phone === viewing.phone) && (!task.unitCode || task.unitCode === viewing.unitCode)
  )) : tasks;
  const rawApprovals = q.data.cards?.approvals;
  const approvals = !rawApprovals || brief?.approvals ? null : (() => {
    const access = brief?.approvalsAccess ? 0 : rawApprovals.access;
    const names = brief?.approvalsNames ? 0 : rawApprovals.names;
    return access || names ? { access, names } : null;
  })();
  const cards = q.data.cards && {
    ...q.data.cards,
    ops: brief?.ops ? null : q.data.cards.ops,
    oldUnits: brief?.units ? null : q.data.cards.oldUnits,
    approvals,
    commissions: brief?.commissions ? null : q.data.cards.commissions,
  };
  const leases = brief?.leases ? [] : (q.data.leases ?? []);
  const stats: [StringKey, number, string][] = [['followUps', counts.followUpsToday, colors.primary], ['viewings', counts.viewings, colors.accent], ['newLeads', counts.newLeads, colors.ok]];

  const preEnd = planState.phase === 'none' ? preEndStatus(planState.allowance) : null;
  const unitPct = unitWarnPct(planState.allowance?.units);

  return (
    <View testID="today-details" style={styles.content}>
      {planState.phase !== 'none' ? (
        <View testID="today-plan-expired" style={[styles.cardAlert, { backgroundColor: colors.card, borderColor: colors.border, borderStartColor: planState.phase === 'grace' ? colors.warn : colors.danger }]}>
          <View style={styles.taskInfo}>
            <Text style={[styles.name, { color: colors.text }]}>{planState.phase === 'grace' ? (lang === 'ar' ? '⏳ فترة سماح' : '⏳ Grace period') : planState.phase === 'readonly' ? (lang === 'ar' ? '🔒 الحساب للقراءة فقط' : '🔒 Read-only') : (lang === 'ar' ? '🛑 الحساب متوقف' : '🛑 Account stopped')}</Text>
            <Text style={{ color: colors.text }}>{bannerText(lang, planState.phase, planState.daysLeft, planState.manager)}</Text>
          </View>
          {planState.manager ? <Button testID="today-plan-renew" label={planT(lang, 'renewCta')} variant="secondary" onPress={() => stack.navigate('Plan')} /> : null}
        </View>
      ) : null}

      {preEnd ? (
        <View testID="today-plan-pre-end" style={[styles.cardAlert, { backgroundColor: colors.card, borderColor: colors.border, borderStartColor: colors.warn }]}>
          <View style={styles.taskInfo}>
            <Text style={[styles.name, { color: colors.text }]}>{lang === 'ar' ? '⏳ تنبيه الباقة' : '⏳ Plan alert'}</Text>
            <Text style={{ color: colors.text }}>{preEndText(lang, preEnd.source, preEnd.daysLeft)}</Text>
            {!planState.manager ? <Text style={{ color: colors.muted }}>{planT(lang, 'askManager')}</Text> : null}
          </View>
          {planState.manager ? (
            <Button
              testID="today-pre-end-renew"
              label={preEnd.source === 'trial' ? (lang === 'ar' ? 'اختار باقة' : 'Choose plan') : planT(lang, 'renewCta')}
              variant="secondary"
              onPress={() => stack.navigate('Plan')}
            />
          ) : null}
        </View>
      ) : null}

      {unitPct !== null ? (
        <View testID="today-unit-cap-warn" style={[styles.cardAlert, { backgroundColor: colors.card, borderColor: colors.border, borderStartColor: unitPct >= 100 ? colors.danger : colors.warn }]}>
          <View style={styles.taskInfo}>
            <Text style={[styles.name, { color: colors.text }]}>{unitPct >= 100 ? (lang === 'ar' ? '🚨 حد الوحدات مكتمل' : '🚨 Unit limit reached') : (lang === 'ar' ? '⚠️ تنبيه حد الوحدات' : '⚠️ Unit limit warning')}</Text>
            <Text style={{ color: colors.text }}>{unitCapText(lang, unitPct)}</Text>
          </View>
          {planState.manager ? (
            <Button
              testID="today-unit-cap-upgrade"
              label={lang === 'ar' ? 'رقّي الباقة' : 'Upgrade plan'}
              variant="secondary"
              onPress={() => stack.navigate('Plan')}
            />
          ) : null}
        </View>
      ) : null}

      {!brief ? <View style={styles.stats}>
        {stats.map(([k, n, tone]) => (
          <View key={k} style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border, borderTopWidth: 3, borderTopColor: tone }]}>
            <Text style={[styles.statN, { color: tone }]}>{n}</Text>
            <Text style={{ color: colors.muted }}>{t(lang, k)}</Text>
          </View>
        ))}
      </View> : null}
      {!brief && !remaining.length ? (
        <View style={styles.empty}><EmptyView icon="check" title={t(lang, 'allClear')} hint={t(lang, 'allClearHint')} actionLabel={t(lang, 'openUnits')} actionVariant="primary" onAction={() => stack.navigate('UnitsList')} /></View>
      ) : (
        remaining.length ? <View style={styles.list}>
          {brief ? <Text accessibilityRole="header" style={[styles.name, { color: colors.text }]}>{lang === 'ar' ? 'مهام النهارده' : 'Today’s tasks'}</Text> : null}
          {remaining.map((task) => (
            <HomeRow key={task.ref} testID="today-task" icon={KIND_ICON[task.kind]} title={task.name || task.ref}
              detail={[t(lang, KIND_LABEL[task.kind]), task.matches, task.unitCode].filter(Boolean).join(' · ')}
              onPress={() => stack.navigate('Lead', { ref: task.ref })}>
              {task.phone ? <TodayCall phone={task.phone} label={t(lang, 'call')} /> : null}
            </HomeRow>
          ))}
        </View> : null
      )}
      {leases.length ? (
        <View testID="today-leases" style={styles.list}>
          <Text accessibilityRole="header" style={[styles.name, { color: colors.text }]}>{t(lang, 'leasesSoon')}</Text>
          {leases.map((z) => (
            <HomeRow key={z.code} testID={`today-lease-${z.code}`} icon="units" title={z.code} detail={z.tenant}
              value={`${z.daysLeft} ${t(lang, 'daysN')}`} urgent={z.daysLeft <= 60} onPress={() => stack.navigate('Unit', { code: z.code })} />
          ))}
        </View>
      ) : null}
      {cards ? <TodayCards cards={cards} /> : null}
      {moreTasks > 0 ? <Text style={[styles.more, { color: colors.muted }]}>{t(lang, 'moreTasks')} {moreTasks}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  content: { gap: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, borderWidth: 1, borderRadius: radius.card, padding: spacing.md, alignItems: 'center' },
  statN: { fontSize: 24, fontWeight: '800' },
  empty: { minHeight: 120 },
  cardAlert: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderStartWidth: 4 },
  taskInfo: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700' },
  more: { textAlign: 'center' },
});
