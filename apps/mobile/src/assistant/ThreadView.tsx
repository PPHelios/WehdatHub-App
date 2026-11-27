import React, { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import type { AssistantMode, Lang, LeadQueue, UnitStatus } from '@wehdathub/shared';
import { api } from '../api';
import { track } from '../analytics';
import { AppText as Text } from '../components/AppText';
import { Icon } from '../components/Icon';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { spacing, useTheme } from '../theme';
import { usage } from '../usage';
import { TurnView, type TurnHandlers } from './TurnView';
import type { Turn, TurnSource } from './thread';

const ASSISTANT_NAV_SCREENS = new Set(['LeadsList', 'Team', 'Dashboard', 'Deals', 'Sources', 'Commissions', 'Requests', 'Owners', 'Leases', 'UnitsList', 'WinLoss', 'Prices', 'Plan', 'Projects', 'Calendar']);

/** The conversation: a "New conversation" header, then every turn, newest at the bottom. */
export function ThreadView({ turns, lang, mode, onSend, onRetry, onSearchAnyway, onSeeAll, onNewConversation, onChangeMode, onChangeSearch, onOpenQueue, onRate, onOpenReport, onScroll }: {
  turns: Turn[];
  lang: Lang;
  mode: AssistantMode;
  onSend: (q: string, source: TurnSource, mode?: AssistantMode) => void;
  onRetry: (id: string) => void;
  onSearchAnyway: (id: string) => void;
  onSeeAll: (turn: Turn, status?: UnitStatus) => void;
  onNewConversation: () => void;
  onChangeMode: (mode: AssistantMode) => void;
  onChangeSearch: (q: string) => void;
  onOpenQueue: (queue: LeadQueue) => void;
  onRate: TurnHandlers['onRate'];
  onOpenReport: TurnHandlers['onOpenReport'];
  onScroll: React.ComponentProps<typeof Animated.ScrollView>['onScroll'];
}) {
  const { colors } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const queries = useQueryClient();
  const scroller = useRef<Animated.ScrollView>(null);
  const openUnit = (code: string) => { track('search_unit_opened'); nav.navigate('Unit', { code }); };
  const handlers: TurnHandlers = {
    onSend: (q, source) => onSend(q, source),
    onRetry,
    onRate,
    onOpenReport,
    onSearchAnyway,
    onSeeAll,
    onOpenUnit: openUnit,
    onUseFilters: () => nav.navigate('UnitsList'),
    onOpenProject: (id, name) => nav.navigate('Project', { id, name }),
    cards: {
      onAssignLead: async (ref, brokerId, version) => {
        const ver = version ?? (await api.lead(ref)).lead.version;
        await api.assignLead(ref, ver, brokerId);
        usage('lead_assign', true);
        usage('assistant_action_tapped', true, undefined, { action: 'reassign' });
        for (const key of [['leads'], ['lead', ref], ['today'], ['dashboard']]) queries.invalidateQueries({ queryKey: key });
      },
      onNudgeLead: async (ref) => {
        await api.nudgeLead(ref);
        usage('lead_nudge_sent', true);
        usage('assistant_action_tapped', true, undefined, { action: 'nudge' });
      },
      onOpenLead: (ref) => nav.navigate('Lead', { ref }),
      onOpenUnit: openUnit,
      onPivotPrimary: (q) => {
        usage('assistant_action_tapped', true, undefined, { action: 'pivot_primary' });
        usage('route_override', true, undefined, { action: 'pivot_primary', mode, to_mode: 'primary' });
        onChangeMode('primary');
        onSend(q, 'chip', 'primary');
      },
      onViewAllMarkets: (q) => {
        usage('assistant_action_tapped', true, undefined, { action: 'view_all_markets' });
        usage('route_override', true, undefined, { action: 'view_all_markets', mode, to_mode: 'auto' });
        const broadened = q.replace(/\b(?:resale|secondary)\b|ريسيل|اعاد[هة]\s*البيع/gi, ' ').replace(/\s+/g, ' ').trim() || q;
        onChangeMode('auto');
        onSend(broadened, 'chip', 'auto');
      },
      onChangeSearch: (q) => {
        usage('assistant_action_tapped', true, undefined, { action: 'change_search' });
        usage('search_corrected', true, undefined, { action: 'change_search', mode });
        onChangeSearch(q);
      },
      onShareSummary: () => usage('assistant_action_tapped', true, undefined, { action: 'share_summary' }),
      onNavigateLink: (target, params) => {
        if (ASSISTANT_NAV_SCREENS.has(target)) nav.navigate(...(params ? [target, params] : [target]) as never);
      },
      onSelectOption: (q) => onSend(q, 'chip'),
      onOpenQueue,
    },
  };
  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Pressable testID="new-conversation" accessibilityRole="button" onPress={onNewConversation} style={[styles.newButton, { borderColor: colors.border }]}>
          <Icon name="plus" size={16} color={colors.primaryInk} />
          <Text variant="bodySm" weight="bold" style={{ color: colors.primaryInk }}>{t(lang, 'newConversation')}</Text>
        </Pressable>
      </View>
      <Animated.ScrollView
        ref={scroller}
        testID="thread-list"
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={styles.content}
      >
        {turns.map((turn, i) => <TurnView key={turn.id} turn={turn} lang={lang} index={i} handlers={handlers} />)}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  newButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 36, paddingHorizontal: spacing.md, borderWidth: 1, borderRadius: 999 },
  content: { padding: spacing.lg, paddingBottom: 130, gap: spacing.xl },
});
