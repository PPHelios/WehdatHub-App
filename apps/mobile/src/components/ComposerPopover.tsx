import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, ReduceMotion } from 'react-native-reanimated';
import type { AssistantMode, Lang, Nav, Rights } from '@wehdathub/shared';
import { t } from '../i18n';
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

  const lang: Lang = ar ? 'ar' : ('en' as const);
  const modes: { id: AssistantMode; label: string }[] = [
    { id: 'auto', label: t(lang, 'cp_auto') },
    { id: 'resale', label: t(lang, 'cp_resale') },
    { id: 'primary', label: t(lang, 'cp_primary') },
    ...(canReports ? [{ id: 'reports' as const, label: t(lang, isSolo ? 'cp_myStats' : 'cp_reports') }] : []),
  ];

  const todayShortcut = { id: 'today', icon: 'today' as const, label: t(lang, 'cp_scToday'), onPress: () => onRunQuery(t(lang, 'cp_qToday')) };
  const uncontactedShortcut = { id: 'uncontacted', icon: 'leads' as const, label: t(lang, 'cp_scUnc'), onPress: () => onRunQuery(t(lang, 'cp_qUnc')) };
  const searchShortcut = { id: 'search', icon: 'search' as const, label: t(lang, 'cp_scApts'), onPress: () => onRunQuery(t(lang, 'cp_qApts')) };
  const shortcuts: Shortcut[] = isDataEntry
    ? [searchShortcut]
    : canReports && isSolo
      ? [
          todayShortcut,
          uncontactedShortcut,
          { id: 'overdue', icon: 'bell', label: priorityTitle('overdue', lang), onPress: () => onRunQuery(priorityPrompt('overdue', lang) ?? '') },
        ]
      : canReports
        ? [
            { id: 'waiting', icon: 'bell', label: t(lang, 'cp_scWaiting'), onPress: () => onRunQuery(priorityPrompt('waiting-over-1h', lang) ?? '') },
            { id: 'discipline', icon: 'team', label: t(lang, 'cp_scDisc'), onPress: () => onRunQuery(t(lang, 'cp_qDisc')) },
            { id: 'overdue', icon: 'today', label: priorityTitle('overdue', lang), onPress: () => onRunQuery(priorityPrompt('overdue', lang) ?? '') },
            ...(canSources ? [{ id: 'sources', icon: 'funnel' as const, label: t(lang, 'cp_scSources'), onPress: () => onNavigateSources?.() }] : []),
          ]
        : [...(rights.leads ? [todayShortcut, uncontactedShortcut] : []), searchShortcut];

  return (
    <Animated.View
      testID="composer-popover"
      entering={FadeInDown.springify().damping(18).stiffness(220).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)}
      style={[styles.box, elev('md'), { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.section}>
        <Text variant="caption" weight="bold" style={{ color: colors.muted }}>{t(lang, 'cp_mode')}</Text>
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
        <Text variant="caption" weight="bold" style={{ color: colors.muted }}>{t(lang, 'cp_quick')}</Text>
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
            <Text variant="bodySm" weight="bold" style={[styles.rowText, { color: colors.text }]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {recent.length ? (
        <View style={styles.section}>
          <Text variant="caption" weight="bold" style={{ color: colors.muted }}>{t(lang, 'cp_recent')}</Text>
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
              <Text variant="bodySm" weight="bold" numberOfLines={1} style={[styles.rowText, { color: colors.text }]}>{q}</Text>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  rowText: { flexShrink: 1 },
});
