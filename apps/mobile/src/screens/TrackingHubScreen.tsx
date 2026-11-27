import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { currentLang } from '../auth';
import { HubTabs, type HubTabItem } from '../components/HubTabs';
import { t } from '../i18n';
import { SentLinksScreen } from './SentLinksScreen';
import { LeasesScreen } from './LeasesScreen';
import { SavedSearchesScreen } from './SavedSearchesScreen';
import type { RootStackParams } from '../navigation';
import { useTheme } from '../theme';

export type TrackingHubTab = 'links' | 'leases' | 'searches';

export function TrackingHubScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const route = useRoute<RouteProp<RootStackParams, 'TrackingHub'>>();
  const [tab, setTab] = useState<TrackingHubTab>(route.params?.initialTab ?? 'links');

  const tabs: readonly HubTabItem<TrackingHubTab>[] = [
    { id: 'links', label: t(lang, 'hb_links'), testID: 'hub-tab-links' },
    { id: 'leases', label: t(lang, 'hb_leases'), testID: 'hub-tab-leases' },
    { id: 'searches', label: t(lang, 'hb_searches'), testID: 'hub-tab-searches' },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <HubTabs tabs={tabs} active={tab} onSelect={setTab} testID="tracking-hub-tabs" />
      <View style={styles.flex}>
        {tab === 'links' ? <SentLinksScreen /> : null}
        {tab === 'leases' ? <LeasesScreen /> : null}
        {tab === 'searches' ? <SavedSearchesScreen /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
