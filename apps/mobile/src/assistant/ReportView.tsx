import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Lang, LeadQueue, LeadTab } from '@wehdathub/shared';
import { AppText as Text } from '../components/AppText';
import { Button } from '../components/Button';
import { readLeadCommand, SearchLeadAction } from '../components/SearchLeadAction';
import { SearchDeals } from '../components/SearchDeals';
import { SearchLeads } from '../components/SearchLeads';
import { DashboardScreen } from '../screens/InsightsScreens';
import { t } from '../i18n';
import { spacing, useTheme } from '../theme';

export type ReportKind = 'deals' | 'leads' | 'dashboard' | 'ranking' | 'lead-action' | 'clarify';
export type LeadFilters = { queue?: LeadQueue; tab?: LeadTab; lookup?: string; assigned?: boolean };

/** Full-screen answers that are not chat turns: lead lists, deals, the dashboard, a lead command, or "which one did you mean". */
export function ReportView({ report, lang, submitted, clarification, canSeeLeads, leadFilters, assignee, dealLastMonth, onShowLeads, onSearchInstead, onCloseAction }: {
  report: ReportKind;
  lang: Lang;
  submitted: string;
  clarification: string;
  canSeeLeads: boolean;
  leadFilters: LeadFilters;
  assignee?: string;
  dealLastMonth: boolean;
  onShowLeads: () => void;
  onSearchInstead: () => void;
  onCloseAction: () => void;
}) {
  const { colors } = useTheme();
  if (report === 'clarify') {
    return (
      <View style={styles.ask}>
        <Text style={{ color: colors.text }}>{clarification}</Text>
        {canSeeLeads ? <Button variant="secondary" label={t(lang, 'leadsTab')} onPress={onShowLeads} /> : null}
        <Button variant="secondary" label={t(lang, 'searchTab')} onPress={onSearchInstead} />
      </View>
    );
  }
  if (report === 'lead-action') return <SearchLeadAction key={submitted} command={readLeadCommand(submitted)} onClose={onCloseAction} />;
  if (report === 'dashboard' || report === 'ranking') return <DashboardScreen embedded ranking={report === 'ranking'} key={report} />;
  if (report === 'leads') {
    return <SearchLeads key={JSON.stringify([leadFilters, assignee])} assignedInitially={Boolean(leadFilters.assigned)} initialQueue={leadFilters.queue} initialTab={leadFilters.tab} lookup={leadFilters.lookup} requestedAssignee={assignee} />;
  }
  return <SearchDeals initialPeriod={dealLastMonth ? 'last' : 'recent'} key={String(dealLastMonth)} />;
}

const styles = StyleSheet.create({
  ask: { padding: spacing.xl, gap: spacing.md },
});
