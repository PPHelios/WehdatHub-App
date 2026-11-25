import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { currentLang } from '../auth';
import { HubTabs, type HubTabItem } from '../components/HubTabs';
import { hasNavApp, useRightsState } from '../rights';
import { DashboardScreen, WinLossScreen } from './InsightsScreens';
import { SourcesScreen } from './DealsScreens';
import { ActivityLogScreen } from './RequestsScreen';
import type { RootStackParams } from '../navigation';
import { useTheme } from '../theme';

export type ReportsHubTab = 'dashboard' | 'winloss' | 'sources' | 'activity';

export function ReportsHubScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const { nav, workspace } = useRightsState();
  const isSolo = Boolean(workspace?.solo || workspace?.mode === 'solo');
  const route = useRoute<RouteProp<RootStackParams, 'ReportsHub'>>();
  const [tab, setTab] = useState<ReportsHubTab>(route.params?.initialTab ?? 'dashboard');

  const tabs: readonly HubTabItem<ReportsHubTab>[] = [
    { id: 'dashboard', label: isSolo ? (ar ? 'إحصائياتي' : 'My Stats') : (ar ? 'لوحة الشركة' : 'Agency Dashboard'), testID: 'hub-tab-dashboard' },
    ...((nav ? hasNavApp(nav, 'WinLoss') : !isSolo) ? [{ id: 'winloss' as const, label: ar ? 'المكسب والخسارة' : 'Win & Loss', testID: 'hub-tab-winloss' }] : []),
    ...((nav ? hasNavApp(nav, 'Sources') : !isSolo) ? [{ id: 'sources' as const, label: ar ? 'مصادر العملاء' : 'Lead Sources', testID: 'hub-tab-sources' }] : []),
    ...((nav ? hasNavApp(nav, 'ActivityLog') : !isSolo) ? [{ id: 'activity' as const, label: ar ? 'سجل النشاط' : 'Activity Log', testID: 'hub-tab-activity' }] : []),
  ];
  const activeTab: ReportsHubTab = tabs.some((x) => x.id === tab) ? tab : (tabs[0]?.id ?? 'dashboard');

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <HubTabs tabs={tabs} active={activeTab} onSelect={setTab} testID="reports-hub-tabs" />
      <View style={styles.flex}>
        {activeTab === 'dashboard' ? <DashboardScreen /> : null}
        {activeTab === 'winloss' ? <WinLossScreen /> : null}
        {activeTab === 'sources' ? <SourcesScreen /> : null}
        {activeTab === 'activity' ? <ActivityLogScreen /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
