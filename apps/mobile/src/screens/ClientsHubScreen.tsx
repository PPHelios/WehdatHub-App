import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { currentLang } from '../auth';
import { HubTabs, type HubTabItem } from '../components/HubTabs';
import { CalendarScreen } from './CalendarScreen';
import { PipelineScreen } from './PipelineScreen';
import { ClientRequestsScreen } from './ClientRequestsScreen';
import { CompareScreen } from './MoreScreens';
import type { RootStackParams } from '../navigation';
import { useTheme } from '../theme';

export type ClientsHubTab = 'calendar' | 'pipeline' | 'requests' | 'compare';

export function ClientsHubScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const route = useRoute<RouteProp<RootStackParams, 'ClientsHub'>>();
  const [tab, setTab] = useState<ClientsHubTab>(route.params?.initialTab ?? 'calendar');

  const tabs: readonly HubTabItem<ClientsHubTab>[] = [
    { id: 'calendar', label: ar ? 'التقويم والمعاينات' : 'Calendar & Viewings', testID: 'hub-tab-calendar' },
    { id: 'pipeline', label: ar ? 'مراحل العملاء' : 'Client Pipeline', testID: 'hub-tab-pipeline' },
    { id: 'requests', label: ar ? 'طلبات العملاء' : 'Client Requests', testID: 'hub-tab-requests' },
    { id: 'compare', label: ar ? 'مقارنة الوحدات' : 'Compare Units', testID: 'hub-tab-compare' },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <HubTabs tabs={tabs} active={tab} onSelect={setTab} testID="clients-hub-tabs" />
      <View style={styles.flex}>
        {tab === 'calendar' ? <CalendarScreen /> : null}
        {tab === 'pipeline' ? <PipelineScreen /> : null}
        {tab === 'requests' ? <ClientRequestsScreen /> : null}
        {tab === 'compare' ? <CompareScreen /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
