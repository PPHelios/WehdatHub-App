import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { currentLang } from '../auth';
import { HubTabs, type HubTabItem } from '../components/HubTabs';
import { t } from '../i18n';
import { hasNavApp, useRightsState } from '../rights';
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
  const { nav, workspace } = useRightsState();
  const isSolo = Boolean(workspace?.solo || workspace?.mode === 'solo');
  const route = useRoute<RouteProp<RootStackParams, 'ClientsHub'>>();
  const [tab, setTab] = useState<ClientsHubTab>(route.params?.initialTab ?? 'calendar');

  const tabs: readonly HubTabItem<ClientsHubTab>[] = [
    { id: 'calendar', label: t(lang, 'hb_calendar'), testID: 'hub-tab-calendar' },
    ...((nav ? hasNavApp(nav, 'Pipeline') : !isSolo) ? [{ id: 'pipeline' as const, label: t(lang, 'hb_pipeline'), testID: 'hub-tab-pipeline' }] : []),
    { id: 'requests', label: t(lang, 'hb_clientReq'), testID: 'hub-tab-requests' },
    { id: 'compare', label: t(lang, 'hb_compare'), testID: 'hub-tab-compare' },
  ];
  const activeTab: ClientsHubTab = tabs.some((x) => x.id === tab) ? tab : (tabs[0]?.id ?? 'calendar');

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <HubTabs tabs={tabs} active={activeTab} onSelect={setTab} testID="clients-hub-tabs" />
      <View style={styles.flex}>
        {activeTab === 'calendar' ? <CalendarScreen /> : null}
        {activeTab === 'pipeline' ? <PipelineScreen /> : null}
        {activeTab === 'requests' ? <ClientRequestsScreen /> : null}
        {activeTab === 'compare' ? <CompareScreen /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
