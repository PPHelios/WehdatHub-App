import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { currentLang } from '../auth';
import { HubTabs, type HubTabItem } from '../components/HubTabs';
import { hasNavApp, useRightsState } from '../rights';
import { TeamScreen } from './TeamScreen';
import { LeadRulesScreen } from './LeadRulesScreen';
import { RequestsScreen } from './RequestsScreen';
import { PortalScreen } from './DealsScreens';
import type { RootStackParams } from '../navigation';
import { useTheme } from '../theme';

export type AdminHubTab = 'team' | 'rules' | 'requests' | 'portals';

export function AdminHubScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const { rights, nav, workspace } = useRightsState();
  const isSolo = Boolean(workspace?.solo || workspace?.mode === 'solo');
  const route = useRoute<RouteProp<RootStackParams, 'AdminHub'>>();
  const [tab, setTab] = useState<AdminHubTab>(route.params?.initialTab ?? 'team');

  const tabs: readonly HubTabItem<AdminHubTab>[] = [
    ...((nav ? hasNavApp(nav, 'Team') : (!isSolo && (rights.team || rights.manager || rights.agencyOwner))) ? [{ id: 'team' as const, label: ar ? 'فريق العمل' : 'Team Members', testID: 'hub-tab-team' }] : []),
    ...((nav ? hasNavApp(nav, 'LeadRules') : !isSolo) ? [{ id: 'rules' as const, label: ar ? 'قواعد التوزيع' : 'Lead Rules', testID: 'hub-tab-rules' }] : []),
    ...((nav ? hasNavApp(nav, 'Requests') : !isSolo) ? [{ id: 'requests' as const, label: ar ? 'طلبات البيانات الخاصة' : 'Access Requests', testID: 'hub-tab-requests' }] : []),
    ...((nav ? hasNavApp(nav, 'Portal') : true) ? [{ id: 'portals' as const, label: ar ? 'استفسارات البوابات' : 'Portal Inquiries', testID: 'hub-tab-portals' }] : []),
  ];
  const activeTab: AdminHubTab = tabs.some((x) => x.id === tab) ? tab : (tabs[0]?.id ?? 'portals');

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <HubTabs tabs={tabs} active={activeTab} onSelect={setTab} testID="admin-hub-tabs" />
      <View style={styles.flex}>
        {activeTab === 'team' ? <TeamScreen /> : null}
        {activeTab === 'rules' ? <LeadRulesScreen /> : null}
        {activeTab === 'requests' ? <RequestsScreen /> : null}
        {activeTab === 'portals' ? <PortalScreen /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
