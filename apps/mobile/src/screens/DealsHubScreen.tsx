import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { currentLang } from '../auth';
import { HubTabs, type HubTabItem } from '../components/HubTabs';
import { DealsScreen, CommissionsScreen } from './DealsScreens';
import type { RootStackParams } from '../navigation';
import { useTheme } from '../theme';

export type DealsHubTab = 'deals' | 'commissions';

export function DealsHubScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const route = useRoute<RouteProp<RootStackParams, 'DealsHub'>>();
  const [tab, setTab] = useState<DealsHubTab>(route.params?.initialTab ?? 'deals');

  const tabs: readonly HubTabItem<DealsHubTab>[] = [
    { id: 'deals', label: ar ? 'صفقات البيع' : 'Sales Deals', testID: 'hub-tab-deals' },
    { id: 'commissions', label: ar ? 'العمولات' : 'Commissions', testID: 'hub-tab-commissions' },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <HubTabs tabs={tabs} active={tab} onSelect={setTab} testID="deals-hub-tabs" />
      <View style={styles.flex}>
        {tab === 'deals' ? <DealsScreen /> : null}
        {tab === 'commissions' ? <CommissionsScreen /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
