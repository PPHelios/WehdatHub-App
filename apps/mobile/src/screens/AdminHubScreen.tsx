import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { currentLang } from '../auth';
import { HubTabs, type HubTabItem } from '../components/HubTabs';
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
  const route = useRoute<RouteProp<RootStackParams, 'AdminHub'>>();
  const [tab, setTab] = useState<AdminHubTab>(route.params?.initialTab ?? 'team');

  const tabs: readonly HubTabItem<AdminHubTab>[] = [
    { id: 'team', label: ar ? 'فريق العمل' : 'Team Members', testID: 'hub-tab-team' },
    { id: 'rules', label: ar ? 'قواعد التوزيع' : 'Lead Rules', testID: 'hub-tab-rules' },
    { id: 'requests', label: ar ? 'طلبات البيانات الخاصة' : 'Access Requests', testID: 'hub-tab-requests' },
    { id: 'portals', label: ar ? 'استفسارات البوابات' : 'Portal Inquiries', testID: 'hub-tab-portals' },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <HubTabs tabs={tabs} active={tab} onSelect={setTab} testID="admin-hub-tabs" />
      <View style={styles.flex}>
        {tab === 'team' ? <TeamScreen /> : null}
        {tab === 'rules' ? <LeadRulesScreen /> : null}
        {tab === 'requests' ? <RequestsScreen /> : null}
        {tab === 'portals' ? <PortalScreen /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
