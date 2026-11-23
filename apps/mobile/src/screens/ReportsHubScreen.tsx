import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { currentLang } from '../auth';
import { HubTabs, type HubTabItem } from '../components/HubTabs';
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
  const route = useRoute<RouteProp<RootStackParams, 'ReportsHub'>>();
  const [tab, setTab] = useState<ReportsHubTab>(route.params?.initialTab ?? 'dashboard');

  const tabs: readonly HubTabItem<ReportsHubTab>[] = [
    { id: 'dashboard', label: ar ? 'لوحة الشركة' : 'Agency Dashboard', testID: 'hub-tab-dashboard' },
    { id: 'winloss', label: ar ? 'المكسب والخسارة' : 'Win & Loss', testID: 'hub-tab-winloss' },
    { id: 'sources', label: ar ? 'مصادر العملاء' : 'Lead Sources', testID: 'hub-tab-sources' },
    { id: 'activity', label: ar ? 'سجل النشاط' : 'Activity Log', testID: 'hub-tab-activity' },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <HubTabs tabs={tabs} active={tab} onSelect={setTab} testID="reports-hub-tabs" />
      <View style={styles.flex}>
        {tab === 'dashboard' ? <DashboardScreen /> : null}
        {tab === 'winloss' ? <WinLossScreen /> : null}
        {tab === 'sources' ? <SourcesScreen /> : null}
        {tab === 'activity' ? <ActivityLogScreen /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
