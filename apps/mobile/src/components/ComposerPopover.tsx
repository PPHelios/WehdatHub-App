import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, ReduceMotion } from 'react-native-reanimated';
import type { AssistantMode, Nav, Rights } from '@wehdathub/shared';
import { hasNavApp, useRightsState } from '../rights';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Chip } from './Chip';
import { priorityPrompt, priorityTitle } from '../assistant/priorityCopy';
import { Icon, type IconName } from './Icon';

interface Shortcut {
  id: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

/**
 * Anchored popover above the search composer: mode switcher (Auto/Resale/Primary/Reports),
 * role & nav-gated shortcuts, and last 3 recent searches.
 */
export function ComposerPopover({
  visible,
  mode,
  onSelectMode,
  onRunQuery,
  onNavigateSources,
  recent,
  rights,
  nav,
  role,
  ar,
  onClose,
}: {
  visible: boolean;
  mode: AssistantMode;
  onSelectMode: (m: AssistantMode) => void;
  onRunQuery: (q: string) => void;
  onNavigateSources?: () => void;
  recent: string[];
  rights: Rights;
  nav?: Nav;
  role?: string;
  ar: boolean;
  onClose: () => void;
}) {
  const { colors, elev } = useTheme();
  const { workspace } = useRightsState();
  if (!visible) return null;

  const isSolo = Boolean(workspace?.solo || workspace?.mode === 'solo');
  const canReports = Boolean(rights.manager || rights.teamLead || rights.agencyOwner);
  const canSources = Boolean(!isSolo && rights.manager && hasNavApp(nav, 'Sources') && onNavigateSources);
  const isDataEntry = (role ?? '').toLowerCase() === 'data_entry' || rights.dataEntry;

  const modes: { id: AssistantMode; label: string }[] = [
    { id: 'auto', label: ar ? 'تلقائي' : 'Auto' },
    { id: 'resale', label: ar ? 'ريسيل' : 'Resale' },
    { id: 'primary', label: ar ? 'برايمري' : 'Primary' },
    ...(canReports ? [{ id: 'reports' as const, label: isSolo ? (ar ? 'إحصائياتي' : 'My stats') : (ar ? 'تقارير' : 'Reports') }] : []),
  ];

  const lang = ar ? 'ar' : 'en';
  const shortcuts: Shortcut[] = isDataEntry
    ? [
        { id: 'search', icon: 'search', label: ar ? 'شقق التجمع' : 'New Cairo apartments', onPress: () => onRunQuery(ar ? 'شقة في التجمع' : 'apartment in New Cairo') },
      ]
    : canReports && isSolo
      ? [
          { id: 'today', icon: 'today', label: ar ? 'متابعات النهارده' : 'Follow-ups today', onPress: () => onRunQuery(ar ? 'متابعات النهارده' : 'follow-ups today') },
          { id: 'uncontacted', icon: 'leads', label: ar ? 'عملاء ماتكلموش' : 'Uncontacted leads', onPress: () => onRunQuery(ar ? 'عملاء محدش كلمهم' : 'uncontacted leads') },
          { id: 'overdue', icon: 'bell', label: priorityTitle('overdue', lang), onPress: () => onRunQuery(priorityPrompt('overdue', lang) ?? '') },
        ]
      : canReports
        ? [
            { id: 'waiting', icon: 'bell', label: ar ? 'انتظار > ساعة' : 'Waiting > 1h', onPress: () => onRunQuery(priorityPrompt('waiting-over-1h', lang) ?? '') },
            { id: 'discipline', icon: 'team', label: ar ? 'مين مبيحدّثش؟' : 'Who is not updating?', onPress: () => onRunQuery(ar ? 'مين مبيحدثش العملاء؟' : 'who is not updating leads?') },
            { id: 'overdue', icon: 'today', label: priorityTitle('overdue', lang), onPress: () => onRunQuery(priorityPrompt('overdue', lang) ?? '') },
            ...(canSources ? [{ id: 'sources', icon: 'funnel' as const, label: ar ? 'مصادر العملاء' : 'Lead sources', onPress: () => onNavigateSources?.() }] : []),
          ]
        : [
            ...(rights.leads
              ? [
                  { id: 'today', icon: 'today' as const, label: ar ? 'متابعات النهارده' : 'Follow-ups today', onPress: () => onRunQuery(ar ? 'متابعات النهارده' : 'follow-ups today') },
                  { id: 'uncontacted', icon: 'leads' as const, label: ar ? 'عملاء ماتكلموش' : 'Uncontacted leads', onPress: () => onRunQuery(ar ? 'عملاء محدش كلمهم' : 'uncontacted leads') },
                ]
              : []),
            { id: 'search', icon: 'search', label: ar ? 'شقق التجمع' : 'New Cairo apartments', onPress: () => onRunQuery(ar ? 'شقة في التجمع' : 'apartment in New Cairo') },
          ];

  return (
    <Animated.View
      testID="composer-popover"
      entering={FadeInDown.springify().damping(18).stiffness(220).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)}
      style={[styles.box, elev('md'), { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.muted }]}>{ar ? 'الوضع' : 'Mode'}</Text>
        <View style={styles.chips}>
          {modes.map((m) => (
            <Chip
              key={m.id}
              testID={`popover-mode-${m.id}`}
              label={m.label}
              selected={mode === m.id}
              onPress={() => {
                onSelectMode(m.id);
                onClose();
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.muted }]}>{ar ? 'اختصارات سريعة' : 'Quick actions'}</Text>
        {shortcuts.map((s) => (
          <Pressable
            key={s.id}
            testID={`popover-shortcut-${s.id}`}
            accessibilityRole="button"
            onPress={() => {
              onClose();
              s.onPress();
            }}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.cardSubtle : 'transparent' }]}
          >
            <Icon name={s.icon} size={18} color={colors.primaryInk} />
            <Text style={[styles.rowText, { color: colors.text }]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {recent.length ? (
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.muted }]}>{ar ? 'الأخيرة' : 'Recent'}</Text>
          {recent.slice(0, 3).map((q, i) => (
            <Pressable
              key={`${q}-${i}`}
              testID={`popover-recent-${i + 1}`}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                onRunQuery(q);
              }}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.cardSubtle : 'transparent' }]}
            >
              <Icon name="search" size={16} color={colors.muted} />
              <Text numberOfLines={1} style={[styles.rowText, { color: colors.text }]}>{q}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  section: { gap: spacing.xs },
  label: { fontSize: 12, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  rowText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
